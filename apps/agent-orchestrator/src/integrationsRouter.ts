import type { IncomingMessage, ServerResponse } from 'node:http';
import { FigmaIntegration, FIGMA_MCP_URL } from './integrations/figma/FigmaIntegration.js';
import { StorybookIntegration } from './integrations/storybook/StorybookIntegration.js';
import { WorkspaceRepository } from './workspace/WorkspaceRepository.js';
import { JiraIntegration } from './integrations/jira/JiraIntegration.js';
import { DemoJiraIntegration } from './integrations/jira/DemoJiraIntegration.js';
import type { IntegrationAdapter } from './integrations/types.js';
import { readIntegrationTokens } from './integrations/store.js';
import { getAdapter } from './providers/registry.js';
import { buildRunMcpServers } from './mcpServers.js';
import { isDemoMode } from './demo/fixtures.js';

/**
 * All `/api/integrations/*` routes live here, kept out of server.ts so the
 * core provider/job router stays small. The Workspace UI (Storybook,
 * Repository, Figma, Jira cards) is entirely driven by these endpoints.
 *
 * Design mirrors the rest of the codebase: every integration is *described*
 * even when it isn't configured, so the UI shows honest "not connected /
 * ask an admin" states rather than 404-ing. Only Figma, Storybook and the
 * local-folder Repository need no admin credentials — those are fully wired.
 * Jira and GitHub need OAuth app credentials (JIRA_/GITHUB_CLIENT_ID+SECRET);
 * when those are absent the routes degrade to clear, honest errors instead
 * of pretending to work.
 */

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
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

function queryParam(req: IncomingMessage, key: string): string | undefined {
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * "Test connection" runs a real, minimal, read-only Claude Code job against
 * the `figma` MCP server — the only way to confirm actual communication (not
 * just `claude mcp get`'s reported status). `whoami` is a documented remote
 * Figma MCP tool with no side effects.
 */
const FIGMA_TEST_CONNECTION_PROMPT = [
  'You are performing a lightweight connectivity test. Call the `whoami` tool on the `figma` MCP server now.',
  'Do not call any other tool, do not read or write any repository file.',
  'After the tool call, respond with EXACTLY one fenced json code block and nothing else, using this schema:',
  '```json',
  '{"ok": true, "email": "string or null", "team": "string or null", "raw": "one-sentence summary"}',
  '```',
  'Set "ok" to true only if the whoami tool call actually succeeded and returned real account data — put the email in "email" if present, the team/workspace name in "team" if present.',
  'If the figma MCP server is unavailable, needs authentication, or the tool call fails for any reason, set "ok" to false, leave "email"/"team" as null, and put the exact reason in "raw".',
].join('\n');

function parseFigmaTestOutput(output: string): { ok: boolean; account?: { email?: string; team?: string }; error?: string } {
  const match = /```json\s*([\s\S]*?)```/i.exec(output);
  if (!match) return { ok: false, error: 'Could not understand the test result.' };
  try {
    const parsed = JSON.parse(match[1]) as { ok?: unknown; email?: unknown; team?: unknown; raw?: unknown };
    if (parsed.ok === true) {
      const account: { email?: string; team?: string } = {};
      if (typeof parsed.email === 'string' && parsed.email.trim()) account.email = parsed.email.trim();
      if (typeof parsed.team === 'string' && parsed.team.trim()) account.team = parsed.team.trim();
      return { ok: true, account };
    }
    return {
      ok: false,
      error: typeof parsed.raw === 'string' && parsed.raw.trim() ? parsed.raw.trim() : 'The Figma MCP tool call failed.',
    };
  } catch {
    return { ok: false, error: 'Could not understand the test result.' };
  }
}

export class IntegrationsRouter {
  private readonly storybook = new StorybookIntegration();
  private readonly figma = new FigmaIntegration();
  private readonly repository = new WorkspaceRepository();
  private readonly jira: IntegrationAdapter | null;
  private readonly githubConfigured: boolean;

  constructor(private readonly repoRoot: string) {
    if (isDemoMode()) {
      this.jira = new DemoJiraIntegration();
    } else {
      const jiraId = process.env.JIRA_CLIENT_ID?.trim();
      const jiraSecret = process.env.JIRA_CLIENT_SECRET?.trim();
      this.jira = jiraId && jiraSecret ? new JiraIntegration({ clientId: jiraId, clientSecret: jiraSecret }) : null;
    }
    this.githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
  }

  async init(): Promise<void> {
    // Restore any previously connected state. Failures degrade to error
    // status inside each module — they must never crash startup.
    await Promise.all([
      this.storybook.initFromConfig(),
      this.figma.initFromConfig(),
      this.repository.initFromConfig(this.repoRoot),
    ]);
    console.log(`[integrations] jira ${this.jira ? 'configured' : 'not configured'}, github ${this.githubConfigured ? 'configured' : 'not configured'}`);
  }

  /** The single connected workspace repository — used by ProposalsRouter to promote a chosen direction onto the real repo. */
  getRepository(): WorkspaceRepository {
    return this.repository;
  }

  /**
   * Live, authoritative signal for whether a run may actually reach Figma's
   * MCP server right now — never trust a client-reported capability flag for
   * this, since it can only ever say "this engine supports Figma MCP in
   * general," not "this specific machine is signed in at this moment."
   */
  isFigmaConnected(): boolean {
    return this.figma.summary().status === 'connected';
  }

  /** Working-copy path for the connected repository, for AI job cwd. Falls back to repoRoot. */
  async resolveJobCwd(): Promise<string> {
    try {
      if (this.repository.isConnected()) return await this.repository.resolveWorkingCopyPath();
    } catch {
      // fall through to repoRoot
    }
    return this.repoRoot;
  }

  /** Returns true if the request was an integrations route (and has been answered). */
  async handle(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
    if (!pathname.startsWith('/api/integrations')) return false;

    try {
      // ---- List ----
      if (method === 'GET' && pathname === '/api/integrations') {
        const jiraEntry = this.jira
          ? { id: 'jira', label: 'Jira', configured: true, ...(await this.jira.health()) }
          : { id: 'jira', label: 'Jira', configured: false, status: 'not-connected' as const };
        sendJson(res, 200, {
          integrations: [this.storybook.summary(), this.repository.summary(), this.figma.summary(), jiraEntry],
        });
        return true;
      }

      // ---- Figma ----
      if (method === 'POST' && pathname === '/api/integrations/figma/connect') {
        sendJson(res, 200, { summary: await this.figma.connect() });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/figma/recheck') {
        sendJson(res, 200, { summary: await this.figma.recheck() });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/figma/disconnect') {
        sendJson(res, 200, { summary: await this.figma.disconnect() });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/figma/test') {
        sendJson(res, 200, { summary: await this.runFigmaTest() });
        return true;
      }

      // ---- Storybook ----
      if (method === 'POST' && pathname === '/api/integrations/storybook/connect') {
        const body = await readJsonBody<{ url?: string }>(req);
        sendJson(res, 200, { summary: await this.storybook.connect(body.url ?? '') });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/storybook/disconnect') {
        await this.storybook.disconnect();
        sendJson(res, 200, { summary: this.storybook.summary() });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/storybook/refresh') {
        sendJson(res, 200, { summary: await this.storybook.refresh() });
        return true;
      }
      if (method === 'GET' && pathname === '/api/integrations/storybook/components') {
        sendJson(res, 200, {
          summary: this.storybook.summary(),
          components: this.storybook.searchComponents(queryParam(req, 'q')),
        });
        return true;
      }

      // ---- Repository (local folder) ----
      if (method === 'POST' && pathname === '/api/integrations/repository/connect') {
        const body = await readJsonBody<{ path?: string }>(req);
        sendJson(res, 200, { summary: await this.repository.connectLocal(body.path ?? '') });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/repository/disconnect') {
        await this.repository.disconnect();
        sendJson(res, 200, { summary: this.repository.summary() });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/repository/recheck') {
        sendJson(res, 200, { summary: await this.repository.recheck() });
        return true;
      }

      // ---- GitHub (OAuth — only when the server admin has configured it) ----
      if (method === 'GET' && pathname === '/api/integrations/github/status') {
        const connected = this.githubConfigured ? Boolean(await readIntegrationTokens('github')) : false;
        sendJson(res, 200, { configured: this.githubConfigured, connected, login: null, avatarUrl: null });
        return true;
      }
      if (pathname === '/api/integrations/github/connect' || pathname.startsWith('/api/integrations/repository/github/')) {
        sendJson(res, this.githubConfigured ? 501 : 400, {
          error: this.githubConfigured
            ? 'GitHub connection is not available in this build.'
            : "GitHub isn't set up on this server. An admin needs to set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then restart the assistant service. You can use a local folder instead.",
        });
        return true;
      }
      if (method === 'POST' && pathname === '/api/integrations/repository/publish') {
        sendJson(res, 400, {
          error: 'Publishing to GitHub requires a connected GitHub repository. Connect one, or use a local folder.',
        });
        return true;
      }

      // ---- Jira ----
      if (pathname.startsWith('/api/integrations/jira/')) {
        return await this.handleJira(req, res, pathname, method);
      }

      sendJson(res, 404, { error: 'Unknown integrations route.' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected integrations error.';
      // Headers may already be sent for a streamed route; guard just in case.
      if (!res.headersSent) sendJson(res, 400, { error: message });
      else res.end();
      return true;
    }
  }

  private async handleJira(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
    if (!this.jira) {
      // Unconfigured: connect is a redirect the UI never reaches (card shows
      // "ask admin"); the data routes answer honestly.
      if (pathname === '/api/integrations/jira/search') {
        sendJson(res, 200, { tickets: [] });
        return true;
      }
      sendJson(res, 400, {
        error: 'Jira is not configured on this server. Ask an admin to set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.',
      });
      return true;
    }

    if (method === 'POST' && pathname === '/api/integrations/jira/disconnect') {
      await this.jira.disconnect();
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (method === 'GET' && pathname === '/api/integrations/jira/search') {
      const mode = (queryParam(req, 'mode') as 'search' | 'recent' | 'assigned-to-me') || 'recent';
      const tickets = await this.jira.searchTickets({ mode, query: queryParam(req, 'q') });
      sendJson(res, 200, { tickets });
      return true;
    }
    const ticketMatch = /^\/api\/integrations\/jira\/tickets\/([^/]+)$/.exec(pathname);
    if (method === 'GET' && ticketMatch) {
      const ticket = await this.jira.getTicket(decodeURIComponent(ticketMatch[1]));
      sendJson(res, 200, { ticket });
      return true;
    }
    sendJson(res, 404, { error: 'Unknown Jira route.' });
    return true;
  }

  /** Real read-only MCP round trip via the Claude Code adapter. */
  private async runFigmaTest() {
    const adapter = getAdapter('claude', 'claude-code') ?? getAdapter('claude');
    if (!adapter) {
      return this.figma.recordTestResult({
        ok: false,
        error: 'Claude Code needs to be connected to run the Figma connection test.',
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let output = '';
    try {
      const result = await adapter.runJob({
        prompt: FIGMA_TEST_CONNECTION_PROMPT,
        cwd: this.repoRoot,
        onEvent: () => {},
        signal: controller.signal,
        readOnly: true,
        mcpServers: buildRunMcpServers([FIGMA_MCP_URL]),
      });
      output = result.output ?? '';
    } catch (error) {
      return this.figma.recordTestResult({
        ok: false,
        error: error instanceof Error ? error.message : 'The Figma connection test failed.',
      });
    } finally {
      clearTimeout(timer);
    }
    const parsed = parseFigmaTestOutput(output);
    return this.figma.recordTestResult(parsed);
  }
}
