import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { patchIntegrationsConfig, readIntegrationsConfig } from '../configStore.js';

const execFileAsync = promisify(execFile);

/**
 * Bridges the DS Accelerator's "Workspace" surface to Figma's official
 * remote MCP server, via the `claude` CLI's own MCP management commands —
 * there is no separate Figma SDK or OAuth app of our own here.
 *
 * ARCHITECTURE, RESEARCHED NOT GUESSED (see PR discussion for full sourcing):
 * - Figma's remote MCP server (developers.figma.com/docs/figma-mcp-server)
 *   supports ONLY interactive OAuth 2.1 sign-in. It does not accept a
 *   personal access token or API key as a Bearer header — confirmed via
 *   Figma's own docs (silent on any such option) and an open Figma Community
 *   feature request asking for exactly this, still unresolved.
 * - Its OAuth client is allowlisted to a fixed set of MCP clients (VS Code,
 *   Cursor, Claude Code) — Figma's docs state new clients must join a
 *   waitlist. There is no Dynamic Client Registration (RFC 7591) available,
 *   so this app cannot register its own OAuth application with Figma and
 *   run an independent first-party auth flow the way it does for GitHub/Jira.
 * - The Claude Agent SDK does not run OAuth flows on an app's behalf either
 *   — MCP OAuth in Claude Code is entirely owned by the `claude` CLI's own
 *   `mcp login`/`/mcp` flow, which requires a real interactive terminal by
 *   design (confirmed by reproducing it directly: it refuses non-TTY stdin
 *   even when a browser could otherwise open).
 * Conclusion: there is no better, more automatable, officially-supported
 * architecture available. `claude mcp login figma`, completed once by the
 * user in their own terminal, is the correct, sanctioned integration point
 * — not a workaround. This class therefore never attempts to run that
 * command on the user's behalf (an earlier version tried, via a PTY wrapper;
 * that only works when the orchestrator itself happens to be launched from a
 * real terminal, which is not guaranteed, and surfaces raw terminal
 * diagnostics when it isn't — exactly what this redesign removes). Instead
 * it registers the server (a fast, side-effect-free, always-safe step) and
 * guides the user through the one manual step that truly requires them.
 *
 * What this class does:
 * - `add`s the server once (idempotent, user scope).
 * - Shells out to `claude mcp get figma` to read real status — the ONLY
 *   signal available; Claude Code does not expose a separate "reachable but
 *   unauthenticated" state for OAuth HTTP servers, so `needs-auth` and
 *   `connected` are the two meaningful states beyond "not yet added".
 * - `logout` clears the stored credential without removing the server
 *   registration (Disconnect never needs to re-add on reconnect).
 * - `recordTestResult()` is populated by server.ts after running a real,
 *   read-only Claude Code job that calls the Figma MCP's own `whoami` tool —
 *   the only way to prove actual communication, and to surface which
 *   account is connected.
 */

export const FIGMA_MCP_SERVER_NAME = 'figma';
export const FIGMA_MCP_URL = 'https://mcp.figma.com/mcp';
export const FIGMA_LOGIN_COMMAND = 'claude mcp login figma';

export type FigmaMcpStatus = 'not-connected' | 'needs-auth' | 'connected' | 'cli-missing' | 'network-error' | 'error';

export type FigmaAccount = {
  email?: string;
  team?: string;
};

export type FigmaSummary = {
  id: 'figma';
  label: 'Figma';
  configured: true;
  status: FigmaMcpStatus;
  mcpUrl: string;
  loginCommand: string;
  lastCheckedAt?: number;
  /** Epoch ms of the last time status was confirmed 'connected'. Survives restarts (see configStore). */
  lastConnectedAt?: number;
  /** Epoch ms of the last successful "Test connection" (real MCP round trip), if any. */
  lastVerifiedAt?: number;
  account?: FigmaAccount;
  error?: string;
  /** Raw CLI diagnostic text — only ever surfaced behind an explicit "Advanced diagnostics" disclosure, never in primary copy. */
  diagnostic?: string;
};

function timeoutMs(): { timeout: number } {
  return { timeout: 15_000 };
}

function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\x1b\][^\x07]*\x07/g, '').replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export class FigmaIntegration {
  private status: FigmaMcpStatus = 'not-connected';
  private lastCheckedAt: number | undefined;
  private lastConnectedAt: number | undefined;
  private lastVerifiedAt: number | undefined;
  private account: FigmaAccount | undefined;
  private error: string | undefined;
  private diagnostic: string | undefined;

  async initFromConfig(): Promise<void> {
    const config = await readIntegrationsConfig();
    this.lastConnectedAt = config.figma?.lastConnectedAt;
    try {
      await this.refreshStatus();
      console.log(`[integrations] figma mcp: ${this.status}`);
    } catch (err) {
      // Never block startup on this — the card will show 'error' and a Re-check action.
      this.status = 'error';
      this.error = err instanceof Error ? err.message : 'Could not check the Figma MCP status.';
      console.warn(`[integrations] figma mcp check failed at boot: ${this.error}`);
    }
  }

  /** Fast, cheap presence check — avoids burning the ~3s `claude mcp get` round trip just to report "CLI not installed". */
  private async checkCliInstalled(): Promise<boolean> {
    try {
      await execFileAsync('claude', ['--version'], { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Runs `claude mcp get figma` and maps its text output to a status. There
   * is no `--json` flag on this CLI command (confirmed via `claude mcp get
   * --help`), so this parses the one line we need and deliberately discards
   * everything else — other servers' `claude mcp get <name>` output can
   * contain secrets (e.g. stdio server env vars), so this must never forward
   * raw CLI output to the frontend, even though the `figma` server itself
   * (OAuth, not env-var auth) does not.
   */
  private async refreshStatus(): Promise<void> {
    this.lastCheckedAt = Date.now();
    try {
      const { stdout } = await execFileAsync('claude', ['mcp', 'get', FIGMA_MCP_SERVER_NAME], timeoutMs());
      if (/✔\s*Connected/i.test(stdout) || /Status:\s*Connected/i.test(stdout)) {
        this.status = 'connected';
        this.error = undefined;
        this.diagnostic = undefined;
        this.lastConnectedAt = Date.now();
        await patchIntegrationsConfig({ figma: { lastConnectedAt: this.lastConnectedAt } });
        return;
      }
      if (/Needs authentication/i.test(stdout)) {
        this.status = 'needs-auth';
        this.error = undefined;
        this.diagnostic = undefined;
        return;
      }
      this.status = 'error';
      this.error = 'The Figma MCP server is registered but reported an unrecognized status.';
      this.diagnostic = stripAnsi(stdout).slice(0, 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (/No MCP server named/i.test(raw)) {
        this.status = 'not-connected';
        this.error = undefined;
        this.diagnostic = undefined;
        return;
      }
      if (/command not found|ENOENT/i.test(raw)) {
        this.status = 'cli-missing';
        this.error = undefined;
        this.diagnostic = undefined;
        return;
      }
      if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch failed/i.test(raw)) {
        this.status = 'network-error';
        this.error = "Couldn't reach Figma to check the connection status.";
        this.diagnostic = stripAnsi(raw).slice(0, 2000);
        return;
      }
      this.status = 'error';
      this.error = 'Could not check the Figma MCP status.';
      this.diagnostic = stripAnsi(raw).slice(0, 2000);
    }
  }

  /** Idempotent — tolerates "already exists" as success. */
  private async ensureRegistered(): Promise<void> {
    try {
      await execFileAsync(
        'claude',
        ['mcp', 'add', '--transport', 'http', FIGMA_MCP_SERVER_NAME, FIGMA_MCP_URL, '--scope', 'user'],
        timeoutMs(),
      );
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (!/already exists/i.test(raw)) throw err;
    }
  }

  /**
   * "Connect" — registers the server (fast, side-effect-free, always safe)
   * and re-checks status. Deliberately does NOT attempt to run the sign-in
   * command itself; see the class doc for why that's not a shortcut worth
   * taking. The UI's job from here is to show the user the one command to
   * run themselves.
   */
  async connect(): Promise<FigmaSummary> {
    if (!(await this.checkCliInstalled())) {
      this.status = 'cli-missing';
      this.error = undefined;
      this.diagnostic = undefined;
      this.lastCheckedAt = Date.now();
      return this.summary();
    }
    try {
      await this.ensureRegistered();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      this.status = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch failed/i.test(raw) ? 'network-error' : 'error';
      this.error = this.status === 'network-error' ? "Couldn't reach Figma to register the MCP server." : "Couldn't register the Figma MCP server.";
      this.diagnostic = stripAnsi(raw).slice(0, 2000);
      this.lastCheckedAt = Date.now();
      return this.summary();
    }
    await this.refreshStatus();
    return this.summary();
  }

  async recheck(): Promise<FigmaSummary> {
    await this.refreshStatus();
    return this.summary();
  }

  /** Clears the stored OAuth credential without removing the server registration. */
  async disconnect(): Promise<FigmaSummary> {
    try {
      await execFileAsync('claude', ['mcp', 'logout', FIGMA_MCP_SERVER_NAME], timeoutMs());
    } catch {
      // logout on an already-signed-out server is a no-op we can ignore; refreshStatus() below is authoritative.
    }
    this.account = undefined;
    this.lastVerifiedAt = undefined;
    await this.refreshStatus();
    return this.summary();
  }

  /** Called by server.ts after running a real MCP round trip (see figma/test route) — the only way to confirm actual communication, not just CLI-reported status. */
  recordTestResult(result: { ok: boolean; account?: FigmaAccount; error?: string }): FigmaSummary {
    if (result.ok) {
      this.lastVerifiedAt = Date.now();
      this.account = result.account;
      this.error = undefined;
    } else {
      this.error = result.error ?? 'Test connection failed.';
    }
    return this.summary();
  }

  summary(): FigmaSummary {
    return {
      id: 'figma',
      label: 'Figma',
      configured: true,
      status: this.status,
      mcpUrl: FIGMA_MCP_URL,
      loginCommand: FIGMA_LOGIN_COMMAND,
      ...(this.lastCheckedAt && { lastCheckedAt: this.lastCheckedAt }),
      ...(this.lastConnectedAt && { lastConnectedAt: this.lastConnectedAt }),
      ...(this.lastVerifiedAt && { lastVerifiedAt: this.lastVerifiedAt }),
      ...(this.account && { account: this.account }),
      ...(this.error && { error: this.error }),
      ...(this.diagnostic && { diagnostic: this.diagnostic }),
    };
  }
}
