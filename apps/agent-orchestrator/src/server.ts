import dotenv from 'dotenv';
import { setMaxListeners } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdapter, getAdapter, listAdapters } from './providers/registry.js';
import { buildRunMcpServers } from './mcpServers.js';
import { IntegrationsRouter } from './integrationsRouter.js';
import { ProposalsRouter } from './proposalsRouter.js';
import { StandardsRouter } from './standardsRouter.js';
import { QaRouter } from './qaRouter.js';
import { ProductDiscoveryRouter } from './productDiscoveryRouter.js';
import {
  buildProvidersPayload,
  connectPersonalKey,
  disconnectMethod,
  disconnectPersonalKey,
  reconnectMethod,
  syncProviders,
} from './providersCatalog.js';
import { isDemoMode } from './demo/fixtures.js';
import { seedDemoRepo } from './demo/seedDemoRepo.js';

type RequestMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequest = {
  messages?: RequestMessage[];
  message?: string;
  /** AI provider family to use (e.g. 'claude'). Defaults to DEFAULT_PROVIDER when omitted. */
  provider?: string;
  /** Authentication method within the provider (e.g. 'api-key', 'claude-code'). Provider default when omitted. */
  authMethod?: string;
  /** Optional Figma URLs from the accelerator request; translated into MCP server config for compatible adapters. */
  figmaUrls?: string[];
};

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
  provider: string;
  /** Auth method within the provider ('' = provider default). */
  authMethod: string;
  createdAt: number;
  updatedAt: number;
  events: unknown[];
  listeners: Set<JobEventListener>;
  messages: RequestMessage[];
  /** Optional Figma URLs from the web request; turned into MCP server config for compatible adapters. */
  figmaUrls?: string[];
  /** Abort this controller to cancel a running job. Cleared when the job settles. */
  abortController?: AbortController;
  result?: AgentStreamDone;
  errorMessage?: string;
};

/** Provider id used when the request omits the provider field. */
const DEFAULT_PROVIDER = 'claude';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const defaultRepoRoot = path.resolve(packageRoot, '..', '..');
const appEnvPath = path.resolve(packageRoot, '.env');
const repoEnvPath = path.resolve(defaultRepoRoot, '.env');

setMaxListeners(0);
dotenv.config({ path: appEnvPath, quiet: true });
dotenv.config({ path: repoEnvPath, override: false, quiet: true });

const repoRoot = process.env.DS_REPO_ROOT?.trim()
  ? path.resolve(process.env.DS_REPO_ROOT)
  : process.env.FSB_REPO_ROOT?.trim()
    ? path.resolve(process.env.FSB_REPO_ROOT)
    : defaultRepoRoot;
const port = Number.parseInt(process.env.AGENT_SERVER_PORT || '8787', 10);

// DS Accelerator prompt — owned here, not by any provider adapter. Kept
// deliberately generic: the accelerator points at an arbitrary connected
// repository (see IntegrationsRouter.resolveJobCwd), so nothing here may
// assume this monorepo's own paths, tokens, or rule files. Quality/DS/a11y
// expectations live in the standards catalog (packages/standards) and are
// composed into the client-built prompt instead — see prompts.ts.
//
// The one thing genuinely worth stating from the server, not the browser: an
// ABSOLUTE anchor for the staging directory. `cwd` below is the CONNECTED
// repo's working copy (so reads/understanding target the real repo), but
// staged direction/QA files must always land under this orchestrator's own
// checkout — where Vite actually serves them from — regardless of cwd. The
// browser-built prompt only knows a cwd-relative-looking path
// (`apps/web/src/accelerator/.generated/...`); this absolute note is what
// makes that resolve correctly even when cwd points elsewhere.
const generatedStagingRoot = path.join(repoRoot, 'apps/web/src/accelerator/.generated');
const basePrompt = `
You are a coding assistant helping a designer change a UI component in a connected repository.

Guardrails:
- Treat the repository's own files (CLAUDE.md, docs, existing code) as source of truth for its conventions.
- Explain your intent clearly as you work.
- Whenever a prompt below asks you to write staged/generated files under a path starting with "apps/web/src/accelerator/.generated/", that path is ALWAYS relative to this absolute directory, never to your current working directory: ${generatedStagingRoot}
`.trim();

const jobs = new Map<string, AgentJob>();
const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOB_EVENTS = 5_000;

// All /api/integrations/* routes (Workspace: Storybook, Repository, Figma, Jira).
const integrations = new IntegrationsRouter(repoRoot);
// /api/agent/proposals/* — staging → preview → apply lifecycle for generated directions.
const proposals = new ProposalsRouter(repoRoot, integrations.getRepository());
// /api/standards — the project's quality checklist (packages/standards baseline + persisted overrides).
const standards = new StandardsRouter();
// /api/agent/qa/static — QA mode's file-content checks, read from the connected repo.
const qa = new QaRouter(() => integrations.resolveJobCwd());
// /api/product-discovery/* — sends initiatives to Jira Product Discovery as ideas (JPD_* in .env).
const productDiscovery = new ProductDiscoveryRouter([appEnvPath, repoEnvPath]);

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

function resolveTarget(body: ChatRequest): { provider: string; authMethod: string } {
  let provider = body.provider?.trim() ?? '';
  let authMethod = body.authMethod?.trim() ?? '';
  // Tolerate composite adapter ids ('claude:claude-code') — clients that
  // cached the briefly-exposed composite format keep working.
  if (provider.includes(':')) {
    const [family, method] = provider.split(':', 2);
    provider = family;
    if (!authMethod && method) authMethod = method;
  }
  if (!provider) {
    provider = getAdapter(DEFAULT_PROVIDER) ? DEFAULT_PROVIDER : (listAdapters()[0]?.providerId ?? DEFAULT_PROVIDER);
  }
  return { provider, authMethod };
}

function describeAvailableTargets(): string {
  return listAdapters()
    .map((adapter) => `${adapter.providerId} (${adapter.authMethod.id})`)
    .join(', ');
}

function createJob(messages: RequestMessage[], provider: string, authMethod: string, figmaUrls?: string[]): AgentJob {
  const now = Date.now();
  return {
    id: randomUUID(),
    status: 'queued',
    provider,
    authMethod,
    createdAt: now,
    updatedAt: now,
    events: [],
    listeners: new Set(),
    messages,
    figmaUrls: figmaUrls?.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
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
  const adapter = requireAdapter(job.provider, job.authMethod || undefined);
  const prompt = buildPrompt(job.messages);
  const abortController = new AbortController();
  job.abortController = abortController;

  try {
    // The connected repository's working copy, not this orchestrator's own
    // checkout — falls back to repoRoot only when nothing is connected. See
    // basePrompt above for why staged files still land correctly regardless.
    const jobCwd = await integrations.resolveJobCwd();
    const result = await adapter.runJob({
      prompt,
      cwd: jobCwd,
      onEvent: (event) => appendJobEvent(job, event),
      signal: abortController.signal,
      ...(job.figmaUrls && job.figmaUrls.length > 0 && integrations.isFigmaConnected()
        ? { mcpServers: buildRunMcpServers(job.figmaUrls) }
        : {}),
    });

    const donePayload: AgentStreamDone = {
      kind: 'done',
      status: result.status,
      runId: result.runId || job.id,
      durationMs: result.durationMs,
      model: result.model,
      output: result.output ?? '',
    };
    job.result = donePayload;
    appendJobEvent(job, donePayload);
    updateJobStatus(
      job,
      result.status === 'finished' ? 'finished' : result.status === 'cancelled' ? 'cancelled' : 'error',
    );
  } catch (error) {
    // Adapters must not throw; this is a defensive catch for unexpected failures.
    const message = error instanceof Error ? error.message : 'Unexpected job error.';
    appendJobEvent(job, { kind: 'error', message });
    updateJobStatus(job, abortController.signal.aborted ? 'cancelled' : 'error', message);
  } finally {
    job.abortController = undefined;
    job.listeners.clear();
    job.updatedAt = Date.now();
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
  if (isDemoMode()) {
    // Points the workspace repository connection at a seeded scratch repo
    // BEFORE integrations.init() reads it, so demo runs never write into
    // this orchestrator's own checkout. See demo/seedDemoRepo.ts.
    await seedDemoRepo(repoRoot);
    console.log('[demo] DEMO_MODE enabled — Storybook, Jira, the workspace repository, and the AI provider are all fixture-backed.');
  }

  // Describe every known provider auth method (Cursor, Claude, ChatGPT,
  // Gemini) and register the ones that are configured and initialize cleanly.
  await syncProviders();

  // Restore connected integrations (Storybook/Figma/Repository) before serving.
  await integrations.init();

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

    // Workspace integration routes (/api/integrations/*). Returns true once handled.
    if (await integrations.handle(req, res, pathname, req.method)) {
      return;
    }

    // Proposal staging routes (/api/agent/proposals/*). Returns true once handled.
    if (await proposals.handle(req, res, pathname, req.method)) {
      return;
    }

    // The project's quality checklist. Returns true once handled.
    if (await standards.handle(req, res, pathname, req.method)) {
      return;
    }

    // QA mode's static file-content checks. Returns true once handled.
    if (await qa.handle(req, res, pathname, req.method)) {
      return;
    }

    // Sending initiatives to Jira Product Discovery as ideas. Returns true once handled.
    if (await productDiscovery.handle(req, res, pathname, req.method)) {
      return;
    }

    if (req.method === 'GET' && pathname === '/api/agent/health') {
      const providerHealth: Record<string, unknown> = {};
      for (const adapter of listAdapters()) {
        providerHealth[adapter.id] = adapter.health();
      }
      sendJson(res, 200, { repoRoot, providers: providerHealth });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/agent/providers') {
      sendJson(res, 200, buildProvidersPayload());
      return;
    }

    // Live recheck: re-read .env and re-probe every method (user-triggered).
    if (req.method === 'POST' && pathname === '/api/agent/providers/refresh') {
      try {
        await syncProviders({ reloadEnvPaths: [appEnvPath, repoEnvPath] });
        sendJson(res, 200, buildProvidersPayload());
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Could not refresh providers.' });
      }
      return;
    }

    const personalKeyMatch = /^\/api\/agent\/providers\/([^/]+)\/personal-key$/.exec(pathname);
    if (personalKeyMatch && (req.method === 'POST' || req.method === 'DELETE')) {
      const providerId = decodeURIComponent(personalKeyMatch[1]);
      try {
        if (req.method === 'POST') {
          const body = await readJsonBody<{ apiKey?: string }>(req);
          await connectPersonalKey(providerId, body.apiKey ?? '');
        } else {
          await disconnectPersonalKey(providerId);
        }
        sendJson(res, 200, buildProvidersPayload());
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'Could not update the API key.' });
      }
      return;
    }

    // Generic disconnect/reconnect for any auth method with a real, user-owned
    // connection (personal API keys, local-runtime CLI sign-ins). See
    // providersCatalog.ts's disconnectMethod/reconnectMethod for why
    // organisation-managed methods are refused here.
    const methodLifecycleMatch = /^\/api\/agent\/providers\/([^/]+)\/methods\/([^/]+)\/(disconnect|reconnect)$/.exec(
      pathname,
    );
    if (methodLifecycleMatch && req.method === 'POST') {
      const providerId = decodeURIComponent(methodLifecycleMatch[1]!);
      const methodId = decodeURIComponent(methodLifecycleMatch[2]!);
      const action = methodLifecycleMatch[3];
      try {
        if (action === 'disconnect') await disconnectMethod(providerId, methodId);
        else await reconnectMethod(providerId, methodId);
        sendJson(res, 200, buildProvidersPayload());
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'Could not update this connection.' });
      }
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

        const target = resolveTarget(body);
        if (!getAdapter(target.provider, target.authMethod || undefined)) {
          sendJson(res, 400, {
            error: `No connected runtime for provider '${target.provider}'${target.authMethod ? ` with auth method '${target.authMethod}'` : ''}. Available: ${describeAvailableTargets() || 'none — connect a provider first'}`,
          });
          return;
        }

        const job = createJob(messages, target.provider, target.authMethod, body.figmaUrls);
        jobs.set(job.id, job);
        void runJob(job);
        sendJson(res, 202, {
          jobId: job.id,
          status: job.status,
          provider: job.provider,
          ...(job.authMethod && { authMethod: job.authMethod }),
          eventCount: job.events.length,
        });
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
        provider: job.provider,
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
      // Abort signal triggers disposal inside the adapter's runJob() finally block.
      job.abortController?.abort();
      updateJobStatus(job, 'cancelled');
      appendJobEvent(job, { kind: 'status', status: 'cancelled', message: 'Implementation run cancelled by user.' });
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

    // Legacy one-shot blocking endpoint — routes through the adapter.
    if (req.method === 'POST' && pathname === '/api/agent/chat') {
      try {
        const body = await readJsonBody<ChatRequest>(req);
        const messages = normalizeMessages(body);
        if (messages.length === 0) {
          sendJson(res, 400, { error: 'Provide message text in `message` or `messages`.' });
          return;
        }

        const target = resolveTarget(body);
        const adapter = getAdapter(target.provider, target.authMethod || undefined);
        if (!adapter) {
          sendJson(res, 400, {
            error: `No connected runtime for provider '${target.provider}'${target.authMethod ? ` with auth method '${target.authMethod}'` : ''}. Available: ${describeAvailableTargets() || 'none — connect a provider first'}`,
          });
          return;
        }

        const result = await adapter.runJob({
          prompt: buildPrompt(messages),
          cwd: await integrations.resolveJobCwd(),
          onEvent: () => {},
          signal: new AbortController().signal,
          ...(body.figmaUrls && body.figmaUrls.length > 0 && integrations.isFigmaConnected()
            ? { mcpServers: buildRunMcpServers(body.figmaUrls) }
            : {}),
        });

        sendJson(res, 200, {
          status: result.status,
          provider: target.provider,
          runId: result.runId,
          durationMs: result.durationMs,
          model: result.model,
          output: result.output ?? '',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected server error.';
        sendJson(res, 500, { error: message });
      }
      return;
    }

    // Legacy streaming endpoint — routes through the adapter with SSE output.
    if (req.method === 'POST' && pathname === '/api/agent/chat/stream') {
      let responseEnded = false;

      const endSse = () => {
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

        const target = resolveTarget(body);
        const adapter = getAdapter(target.provider, target.authMethod || undefined);
        if (!adapter) {
          sendJson(res, 400, {
            error: `No connected runtime for provider '${target.provider}'${target.authMethod ? ` with auth method '${target.authMethod}'` : ''}. Available: ${describeAvailableTargets() || 'none — connect a provider first'}`,
          });
          return;
        }

        const abortController = new AbortController();
        req.on('aborted', () => abortController.abort());
        res.on('close', () => {
          if (!responseEnded) abortController.abort();
        });

        sendSseHeaders(res);

        const result = await adapter.runJob({
          prompt: buildPrompt(messages),
          cwd: await integrations.resolveJobCwd(),
          onEvent: (event) => writeSseData(res, event),
          signal: abortController.signal,
          ...(body.figmaUrls && body.figmaUrls.length > 0 && integrations.isFigmaConnected()
            ? { mcpServers: buildRunMcpServers(body.figmaUrls) }
            : {}),
        });

        writeSseData(res, {
          kind: 'done',
          status: result.status,
          runId: result.runId,
          durationMs: result.durationMs,
          model: result.model,
          output: result.output ?? '',
        });
      } catch (error) {
        if (!res.headersSent) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Unexpected server error.',
          });
          return;
        }
        writeSseData(res, {
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unexpected server error.',
        });
      }

      endSse();
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

  // Best-effort cleanup for abandoned proposal staging dirs (browser closed before discard fired).
  void proposals.sweepStaleStagingDirs();
  setInterval(() => void proposals.sweepStaleStagingDirs(), 30 * 60 * 1000);

  server.listen(port, () => {
    console.log(`Agent API listening on http://localhost:${port}`);
    console.log(`Repo root: ${repoRoot}`);
    console.log(`Providers: ${listAdapters().map((a) => a.id).join(', ')}`);
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : 'Failed to start server.';
  console.error(`Agent API bootstrap failed: ${message}`);
  process.exit(1);
});
