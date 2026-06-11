import dotenv from 'dotenv';
import { setMaxListeners } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, Cursor, CursorAgentError, CursorSdkError } from '@cursor/sdk';
import type { SDKAgent } from '@cursor/sdk';
import { interactionUpdateToSsePayloads } from './delta-stream-format.js';
import { sdkMessageToSsePayloads } from './stream-format.js';

type RequestMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequest = {
  messages?: RequestMessage[];
  message?: string;
};

type LocalSettingSource = 'project' | 'user' | 'team' | 'mdm' | 'plugins' | 'all';
type AgentStreamDone = {
  kind: 'done';
  status: string;
  runId: string;
  durationMs?: number;
  model?: string;
  output?: string;
};
type JobStatus = 'queued' | 'running' | 'finished' | 'error' | 'cancelled';
type JobEventListener = (payload: unknown) => void;

type AgentJob = {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  events: unknown[];
  listeners: Set<JobEventListener>;
  messages: RequestMessage[];
  agent?: SDKAgent;
  cancelRequested: boolean;
  result?: AgentStreamDone;
  errorMessage?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const defaultRepoRoot = path.resolve(packageRoot, '..', '..');
const appEnvPath = path.resolve(packageRoot, '.env');
const repoEnvPath = path.resolve(defaultRepoRoot, '.env');

setMaxListeners(0);
dotenv.config({ path: appEnvPath, quiet: true });
dotenv.config({ path: repoEnvPath, override: false, quiet: true });

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey || apiKey === 'cursor_xxx') {
  throw new Error('Set CURSOR_API_KEY in apps/agent-orchestrator/.env before starting the API server.');
}

const requestedModel = process.env.CURSOR_MODEL?.trim() || '';
const repoRoot = process.env.DS_REPO_ROOT?.trim()
  ? path.resolve(process.env.DS_REPO_ROOT)
  : process.env.FSB_REPO_ROOT?.trim()
    ? path.resolve(process.env.FSB_REPO_ROOT)
    : defaultRepoRoot;
const port = Number.parseInt(process.env.AGENT_SERVER_PORT || '8787', 10);
const localSettingSources = process.env.CURSOR_LOCAL_SETTING_SOURCES?.trim() || 'all';
const hasFigmaMcpHint = localSettingSources === 'all';
const resolvedSettingSources: LocalSettingSource[] = hasFigmaMcpHint ? ['all'] : [];

const basePrompt = `
You are working in the DS Starter Kit monorepo (design-system playground + tokens + components).

Guardrails:
- Treat repository files and .cursor/rules as source of truth.
- Keep edits scoped to apps/web and packages/tokens unless absolutely required.
- Reuse existing DS components and var(--ds-*) token usage; never introduce client-specific branding.
- Follow WCAG 2.2 AA accessibility requirements from .cursor/rules/accessibility-wcag-eaa.mdc.
- Explain intent clearly.
`.trim();

let resolvedModelId = requestedModel;
const jobs = new Map<string, AgentJob>();
const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOB_EVENTS = 5_000;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function sendSseHeaders(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function writeSseData(res: ServerResponse, payload: unknown) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // Client may have closed the connection.
  }
}

function createJob(messages: RequestMessage[]): AgentJob {
  const now = Date.now();
  return {
    id: randomUUID(),
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    events: [],
    listeners: new Set(),
    messages,
    cancelRequested: false,
  };
}

function appendJobEvent(job: AgentJob, payload: unknown) {
  job.updatedAt = Date.now();
  job.events.push(payload);
  if (job.events.length > MAX_JOB_EVENTS) {
    job.events.shift();
  }
  for (const listener of job.listeners) {
    listener(payload);
  }
}

function updateJobStatus(job: AgentJob, status: JobStatus, errorMessage?: string) {
  job.status = status;
  job.updatedAt = Date.now();
  if (errorMessage) {
    job.errorMessage = errorMessage;
  }
}

function parseAfterOffset(req: IncomingMessage): number {
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const raw = parsed.searchParams.get('after');
    if (!raw) return -1;
    const offset = Number.parseInt(raw, 10);
    return Number.isFinite(offset) ? offset : -1;
  } catch {
    return -1;
  }
}

async function runJob(job: AgentJob) {
  updateJobStatus(job, 'running');
  const prompt = buildPrompt(job.messages);
  const agent = await Agent.create({
    apiKey,
    model: { id: resolvedModelId },
    local: { cwd: repoRoot, settingSources: resolvedSettingSources },
  });
  job.agent = agent;

  try {
    const run = await agent.send(prompt, {
      model: {
        id: resolvedModelId,
        params: [{ id: 'thinking', value: 'high' }],
      },
      onDelta: ({ update }) => {
        if (job.cancelRequested) {
          return;
        }
        const payloads = interactionUpdateToSsePayloads(update);
        for (const payload of payloads) {
          appendJobEvent(job, payload);
        }
      },
    });

    if (!run.supports('stream')) {
      const message = run.unsupportedReason('stream') ?? 'Stream is not supported for this run.';
      appendJobEvent(job, { kind: 'error', message });
      updateJobStatus(job, 'error', message);
      return;
    }

    for await (const message of run.stream()) {
      if (job.cancelRequested) break;
      const payloads = sdkMessageToSsePayloads(message);
      for (const payload of payloads) {
        appendJobEvent(job, payload);
      }
    }

    if (job.cancelRequested) {
      const cancelledDone: AgentStreamDone = {
        kind: 'done',
        status: 'cancelled',
        runId: job.id,
        model: resolvedModelId,
        output: '',
      };
      job.result = cancelledDone;
      appendJobEvent(job, cancelledDone);
      updateJobStatus(job, 'cancelled');
      return;
    }

    const result = await run.wait();
    const donePayload: AgentStreamDone = {
      kind: 'done',
      status: result.status,
      runId: result.id,
      durationMs: result.durationMs,
      model: resolvedModelId,
      output: result.result ?? '',
    };
    job.result = donePayload;
    appendJobEvent(job, donePayload);
    updateJobStatus(job, result.status === 'finished' ? 'finished' : 'error');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected job error.';
    appendJobEvent(job, { kind: 'error', message });
    if (job.cancelRequested) {
      updateJobStatus(job, 'cancelled');
    } else {
      updateJobStatus(job, 'error', message);
    }
  } finally {
    try {
      if (job.agent) {
        await disposeAgent(job.agent);
      }
    } finally {
      job.agent = undefined;
      job.listeners.clear();
      job.updatedAt = Date.now();
    }
  }
}

async function disposeAgent(agent: SDKAgent): Promise<void> {
  const withDispose = agent as SDKAgent & {
    [Symbol.asyncDispose]?: () => Promise<void>;
    close?: () => void;
  };
  try {
    if (typeof withDispose[Symbol.asyncDispose] === 'function') {
      await withDispose[Symbol.asyncDispose]();
      return;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof withDispose.close === 'function') {
      withDispose.close();
    }
  } catch {
    // ignore
  }
}

/**
 * Safe pathname for routing. Avoids `new URL("//api/…", base)` parsing `//` as a
 * host-relative URL (pathname would become `/agent/…` and every chat would 404).
 */
function requestPathname(req: IncomingMessage): string {
  const raw = req.url;
  if (!raw) return '/';
  let pathPart = raw.split('?')[0] || '/';
  pathPart = pathPart.replace(/^\/+/, '/');
  if (pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
    try {
      const pathname = new URL(pathPart).pathname.replace(/\/+$/, '') || '/';
      return pathname;
    } catch {
      return '/';
    }
  }
  try {
    const pathname = new URL(pathPart, 'http://localhost').pathname.replace(/\/+$/, '') || '/';
    return pathname;
  } catch {
    return '/';
  }
}

function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });

    req.on('error', reject);
  });
}

function normalizeMessages(body: ChatRequest): RequestMessage[] {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages
      .filter(
        (entry): entry is RequestMessage =>
          (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string',
      )
      .map((entry) => ({ role: entry.role, content: entry.content.trim() }))
      .filter((entry) => entry.content.length > 0)
      .slice(-20);
  }

  const fallbackMessage = body.message?.trim();
  if (fallbackMessage) {
    return [{ role: 'user', content: fallbackMessage }];
  }

  return [];
}

function buildPrompt(messages: RequestMessage[]): string {
  const transcript = messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n\n');

  return `${basePrompt}

Conversation:
${transcript}

Respond as the assistant to the final user message.`;
}

async function bootstrap() {
  const me = await Cursor.me({ apiKey });
  const models = await Cursor.models.list({ apiKey });
  if (models.length === 0) {
    throw new Error('No Cursor models available for this API key.');
  }

  if (!resolvedModelId) {
    const codexModel = models.find((model) => /codex/i.test(model.id));
    const composerModel = models.find((model) => /composer/i.test(model.id));
    resolvedModelId = codexModel?.id ?? composerModel?.id ?? models[0].id;
  } else if (!models.some((model) => model.id === resolvedModelId)) {
    const codexModel = models.find((model) => /codex/i.test(model.id));
    resolvedModelId = codexModel?.id ?? models[0].id;
    console.warn(
      `Requested model '${requestedModel}' is unavailable for key '${me.apiKeyName}'. Falling back to '${resolvedModelId}'.`,
    );
  }

  const server = createServer(async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: 'Invalid request.' });
      return;
    }

    const pathname = requestPathname(req);
    const jobStatusMatch = /^\/api\/agent\/jobs\/([^/]+)$/.exec(pathname);
    const jobStreamMatch = /^\/api\/agent\/jobs\/([^/]+)\/stream$/.exec(pathname);
    const jobCancelMatch = /^\/api\/agent\/jobs\/([^/]+)\/cancel$/.exec(pathname);

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === 'GET' && pathname === '/api/agent/health') {
      sendJson(res, 200, {
        ok: true,
        model: resolvedModelId,
        repoRoot,
        localSettingSources,
        figmaMcpAccessLikely: hasFigmaMcpHint,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/agent/jobs') {
      try {
        const body = await readJsonBody<ChatRequest>(req);
        const messages = normalizeMessages(body);
        if (messages.length === 0) {
          sendJson(res, 400, { error: 'Provide message text in `message` or `messages`.' });
          return;
        }

        const job = createJob(messages);
        jobs.set(job.id, job);
        void runJob(job);
        sendJson(res, 202, { jobId: job.id, status: job.status, eventCount: job.events.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected server error.';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (req.method === 'GET' && jobStatusMatch) {
      const jobId = jobStatusMatch[1];
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { error: 'Job not found.' });
        return;
      }
      sendJson(res, 200, {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        eventCount: job.events.length,
        result: job.result ?? null,
        error: job.errorMessage ?? null,
      });
      return;
    }

    if (req.method === 'POST' && jobCancelMatch) {
      const jobId = jobCancelMatch[1];
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { error: 'Job not found.' });
        return;
      }
      job.cancelRequested = true;
      updateJobStatus(job, 'cancelled');
      appendJobEvent(job, { kind: 'status', status: 'cancelled', message: 'Implementation run cancelled by user.' });
      if (job.agent) {
        await disposeAgent(job.agent);
        job.agent = undefined;
      }
      sendJson(res, 200, { ok: true, jobId: job.id, status: job.status });
      return;
    }

    if (req.method === 'GET' && jobStreamMatch) {
      const jobId = jobStreamMatch[1];
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { error: 'Job not found.' });
        return;
      }
      sendSseHeaders(res);
      const after = parseAfterOffset(req);
      for (let index = 0; index < job.events.length; index += 1) {
        if (index <= after) continue;
        writeSseData(res, job.events[index]);
      }

      if (job.status === 'finished' || job.status === 'error' || job.status === 'cancelled') {
        res.end();
        return;
      }

      const listener: JobEventListener = (payload) => {
        writeSseData(res, payload);
        if (job.status === 'finished' || job.status === 'error' || job.status === 'cancelled') {
          try {
            res.end();
          } catch {
            // ignore
          }
        }
      };
      job.listeners.add(listener);

      const removeListener = () => {
        job.listeners.delete(listener);
      };
      req.on('aborted', removeListener);
      res.on('close', removeListener);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/agent/chat') {
      try {
        const body = await readJsonBody<ChatRequest>(req);
        const messages = normalizeMessages(body);
        if (messages.length === 0) {
          sendJson(res, 400, { error: 'Provide message text in `message` or `messages`.' });
          return;
        }

        const result = await Agent.prompt(buildPrompt(messages), {
          apiKey,
          model: { id: resolvedModelId },
          local: { cwd: repoRoot, settingSources: resolvedSettingSources },
        });

        sendJson(res, 200, {
          status: result.status,
          runId: result.id,
          durationMs: result.durationMs,
          model: resolvedModelId,
          output: result.result ?? '',
        });
      } catch (error) {
        if (error instanceof CursorAgentError) {
          const sdkError = error as CursorSdkError;
          sendJson(res, 502, {
            error: sdkError.message,
            code: sdkError.code ?? null,
            status: sdkError.status ?? null,
            requestId: sdkError.requestId ?? null,
          });
          return;
        }

        const message = error instanceof Error ? error.message : 'Unexpected server error.';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/agent/chat/stream') {
      let clientClosed = false;
      let responseEnded = false;

      req.on('aborted', () => {
        clientClosed = true;
      });

      res.on('close', () => {
        if (!responseEnded) {
          clientClosed = true;
        }
      });

      const endSse = (res: ServerResponse) => {
        try {
          responseEnded = true;
          res.end();
        } catch {
          // ignore
        }
      };

      try {
        const body = await readJsonBody<ChatRequest>(req);
        const messages = normalizeMessages(body);
        if (messages.length === 0) {
          sendJson(res, 400, { error: 'Provide message text in `message` or `messages`.' });
          return;
        }

        const prompt = buildPrompt(messages);

        const agent = await Agent.create({
          apiKey,
          model: { id: resolvedModelId },
          local: { cwd: repoRoot, settingSources: resolvedSettingSources },
        });

        sendSseHeaders(res);

        try {
          const run = await agent.send(prompt, {
            model: {
              id: resolvedModelId,
              params: [{ id: 'thinking', value: 'high' }],
            },
            onDelta: ({ update }) => {
              if (clientClosed) {
                return;
              }
              const payloads = interactionUpdateToSsePayloads(update);
              for (const payload of payloads) {
                writeSseData(res, payload);
              }
            },
          });
          if (!run.supports('stream')) {
            writeSseData(res, {
              kind: 'error',
              message: run.unsupportedReason('stream') ?? 'Stream is not supported for this run.',
            });
            endSse(res);
            await disposeAgent(agent);
            return;
          }

          for await (const message of run.stream()) {
            if (clientClosed) {
              break;
            }
            const payloads = sdkMessageToSsePayloads(message);
            for (const payload of payloads) {
              writeSseData(res, payload);
            }
          }

          const result = await run.wait();
          writeSseData(res, {
            kind: 'done',
            status: result.status,
            runId: result.id,
            durationMs: result.durationMs,
            model: resolvedModelId,
            output: result.result ?? '',
          });
        } finally {
          await disposeAgent(agent);
        }
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Unexpected server error.',
          });
          return;
        }

        const message =
          error instanceof CursorAgentError
            ? (error as CursorSdkError).message
            : error instanceof Error
              ? error.message
              : 'Unexpected server error.';
        writeSseData(res, { kind: 'error', message });
      }

      endSse(res);
      return;
    }

    console.warn(`[agent-api] 404 ${req.method} ${req.url} → pathname ${pathname}`);
    sendJson(res, 404, { error: 'Not found.' });
  });

  server.on('connection', (socket) => {
    socket.setNoDelay(true);
  });

  setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobs.entries()) {
      if (job.status === 'running' || job.status === 'queued') continue;
      if (now - job.updatedAt > JOB_TTL_MS) {
        jobs.delete(jobId);
      }
    }
  }, 60_000);

  server.listen(port, () => {
    console.log(`Agent API listening on http://localhost:${port}`);
    console.log(`Repo root: ${repoRoot}`);
    console.log(`Model: ${resolvedModelId}`);
    console.log(`Local settingSources: ${localSettingSources}`);
    console.log(`Figma MCP access likely: ${hasFigmaMcpHint ? 'yes' : 'no'}`);
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : 'Failed to start server.';
  console.error(`Agent API bootstrap failed: ${message}`);
  process.exit(1);
});
