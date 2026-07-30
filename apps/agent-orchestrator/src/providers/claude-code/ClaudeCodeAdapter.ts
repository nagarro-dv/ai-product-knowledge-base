import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query, type McpServerConfig, type Options, type PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import type { AiProviderAdapter, McpServerRef, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import { ClaudeCodeStreamMapper } from './stream-format.js';
import { buildMcpToolLogEntry, createMcpDebugLogger, type McpToolLogEntry } from './mcp-debug.js';
import { MCP_ALLOWED_TOOLS } from '../../mcpServers.js';

const execFileAsync = promisify(execFile);

const NOT_SIGNED_IN_MESSAGE =
  'Claude Code is installed but not signed in on this machine. Open a terminal, run `claude`, complete /login with your Claude account, then try again.';

type ClaudeAuthStatus = {
  loggedIn: boolean;
  authMethod?: string;
  subscriptionType?: string;
  email?: string;
};

export type ClaudeCodeAdapterConfig = {
  /** Preferred model ID. When omitted, Claude Code's own default is used. */
  model?: string;
  /**
   * Permission mode for the run. 'acceptEdits' (default) auto-approves file
   * edits so implementation jobs can change the repo without interactive
   * prompts; Bash and other sensitive tools are still denied unless the mode
   * is escalated to 'bypassPermissions' explicitly via env.
   */
  permissionMode?: string;
};

const VALID_PERMISSION_MODES: readonly PermissionMode[] = [
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'dontAsk',
  'auto',
];
const DEFAULT_PERMISSION_MODE: PermissionMode = 'acceptEdits';

/**
 * Runs Claude through the Claude Code runtime installed on this machine.
 *
 * Authentication: the spawned Claude Code process uses the sign-in stored on
 * this machine (typically a personal Pro/Max subscription via `claude login`).
 * The server's ANTHROPIC_API_KEY is deliberately stripped from the child
 * environment so this method never silently bills the API key — that is what
 * the separate 'api-key' method is for. Per Anthropic's terms, subscription
 * credits are individual: this method is only valid when the orchestrator runs
 * on the user's own machine. Shared/hosted deployments must use API keys.
 */
export class ClaudeCodeAdapter implements AiProviderAdapter {
  readonly id = 'claude:claude-code';
  readonly providerId = 'claude';
  readonly providerLabel = 'Claude';
  readonly label = 'Claude (Claude Code)';
  readonly authMethod = {
    id: 'claude-code',
    label: 'Claude Code (subscription)',
    kind: 'local-runtime',
    source: 'personal',
    description:
      'Runs through the Claude Code app installed on this machine, using your personal Claude sign-in. No API key needed; usage counts against your own plan.',
    signInCommand: 'claude',
    installUrl: 'https://claude.com/code',
    // Claude Code is an officially supported client for Figma's remote MCP
    // server (developers.figma.com/docs/figma-mcp-server) — 'Claude Code' is
    // named explicitly in Figma's MCP client catalog. Wired below in runJob().
    mcpServers: ['figma'],
  } as const;
  readonly capabilities = { localRepoEdits: true, streaming: true, mcp: true } as const;

  private readonly model: string;
  private readonly permissionMode: PermissionMode;
  private cliVersion = '';
  private cliPath = '';
  private cachedHealth: ProviderHealth = { ok: false };

  constructor(config: ClaudeCodeAdapterConfig = {}) {
    this.model = config.model?.trim() ?? '';
    const requestedMode = config.permissionMode?.trim() ?? '';
    if (requestedMode && !VALID_PERMISSION_MODES.includes(requestedMode as PermissionMode)) {
      throw new Error(
        `[claude-code] Invalid CLAUDE_CODE_PERMISSION_MODE '${requestedMode}'. Valid: ${VALID_PERMISSION_MODES.join(', ')}.`,
      );
    }
    this.permissionMode = (requestedMode as PermissionMode) || DEFAULT_PERMISSION_MODE;
  }

  /**
   * Checks sign-in state via `claude auth status` — a fast, non-interactive
   * CLI subcommand that reads the stored credential without starting a
   * session or spending any usage. This is the only reliable signal for
   * "is this machine logged in"; CLI presence alone does not imply it.
   */
  private async checkAuthStatus(): Promise<ClaudeAuthStatus> {
    try {
      const { stdout } = await execFileAsync('claude', ['auth', 'status'], { timeout: 10_000 });
      const parsed = JSON.parse(stdout) as Partial<ClaudeAuthStatus>;
      return {
        loggedIn: Boolean(parsed.loggedIn),
        authMethod: parsed.authMethod,
        subscriptionType: parsed.subscriptionType,
        email: parsed.email,
      };
    } catch {
      // Covers: command missing, non-zero exit, or unparsable output — all
      // treated as "not verifiably logged in" rather than throwing here, so
      // the caller can decide how to report it.
      return { loggedIn: false };
    }
  }

  async initialize(): Promise<void> {
    // Detect the CLI. Throwing here makes bootstrap record this method as
    // unavailable instead of registering it — no fake "connected" state.
    let stdout = '';
    try {
      ({ stdout } = await execFileAsync('claude', ['--version'], { timeout: 10_000 }));
    } catch {
      throw new Error(
        'Claude Code is not installed (the `claude` command was not found on PATH). Install it and sign in with `claude` to enable this method.',
      );
    }
    this.cliVersion = stdout.trim();

    // Resolve the installed binary's absolute path and drive THAT executable.
    // The SDK otherwise falls back to its own bundled binary, which on macOS
    // cannot read the keychain credentials owned by the user's installed
    // Claude Code — runs would fail with "Not logged in".
    try {
      const { stdout: whichOut } = await execFileAsync('which', ['claude'], { timeout: 5_000 });
      this.cliPath = whichOut.trim();
    } catch {
      this.cliPath = '';
    }

    // Actually verify sign-in — CLI presence is necessary but not sufficient.
    // Throwing here (like the CLI-missing case above) makes this method
    // report as 'unavailable' with an actionable message instead of a false
    // "connected" state that would only be caught later by a failed run.
    const auth = await this.checkAuthStatus();
    if (!auth.loggedIn) {
      throw new Error(NOT_SIGNED_IN_MESSAGE);
    }

    this.cachedHealth = {
      ok: true,
      cliVersion: this.cliVersion,
      permissionMode: this.permissionMode,
      ...(this.model && { model: this.model }),
      lastAuthSource: auth.authMethod === 'claude.ai' ? 'oauth' : (auth.authMethod ?? 'oauth'),
      ...(auth.subscriptionType && { subscriptionType: auth.subscriptionType }),
    };

    console.log(`[claude-code] cli: ${this.cliVersion}`);
    console.log(`[claude-code] permissionMode: ${this.permissionMode}`);
    console.log(`[claude-code] auth: ${auth.authMethod ?? 'unknown'} (${auth.subscriptionType ?? 'n/a'})`);
    if (this.model) console.log(`[claude-code] model: ${this.model}`);
  }

  health(): ProviderHealth {
    return this.cachedHealth;
  }

  /**
   * Only servers this adapter actually declares in `authMethod.mcpServers`
   * are wired — a caller passing an unrecognized name (e.g. a server another
   * adapter supports) is silently ignored rather than blindly trusted.
   */
  private resolveMcpServers(requested: Record<string, McpServerRef> | undefined): Record<string, McpServerConfig> | undefined {
    if (!requested) return undefined;
    const supported: readonly string[] = this.authMethod.mcpServers ?? [];
    const entries = Object.entries(requested).filter(([name]) => supported.includes(name));
    if (entries.length === 0) return undefined;
    const resolved: Record<string, McpServerConfig> = {};
    for (const [name, ref] of entries) {
      resolved[name] = { type: ref.type, url: ref.url };
    }
    return resolved;
  }

  async runJob(input: RunJobInput): Promise<RunJobResult> {
    const { prompt, cwd, onEvent, signal, readOnly } = input;
    const startMs = Date.now();
    // 'plan' mode formulates a plan without executing any file edit — this is
    // an SDK-enforced boundary, not a prompt instruction the model could
    // misread. Always wins over the adapter's own configured permission mode.
    const effectivePermissionMode: PermissionMode = readOnly ? 'plan' : this.permissionMode;

    if (signal.aborted) {
      return { runId: '', status: 'cancelled', model: this.model || undefined };
    }

    const abortController = new AbortController();
    const onAbort = () => abortController.abort();
    signal.addEventListener('abort', onAbort, { once: true });

    // Strip the server's API key so the child authenticates with the local
    // Claude sign-in — the whole point of this auth method.
    const childEnv: Record<string, string | undefined> = { ...process.env, ANTHROPIC_API_KEY: undefined };

    const mcpServers = this.resolveMcpServers(input.mcpServers);
    // MCP tools are NOT covered by 'acceptEdits' (it only auto-approves file
    // edits), and a headless run has no permission prompt to answer — without
    // these allow rules every MCP call is auto-denied before it reaches the
    // server. Only the read/inspect tools listed per server are allowed;
    // write-capable Figma tools stay gated. See MCP_ALLOWED_TOOLS.
    const allowedTools = mcpServers ? Object.keys(mcpServers).flatMap((name) => MCP_ALLOWED_TOOLS[name] ?? []) : [];

    const enableMcpDebug = process.env.NODE_ENV !== 'production' || process.env.CLAUDE_CODE_DEBUG_MCP === '1';
    const logger = createMcpDebugLogger(enableMcpDebug, (entry: McpToolLogEntry) => {
      console.log('[claude-code][mcp]', JSON.stringify(entry));
    });

    const options: Options = {
      cwd,
      abortController,
      env: childEnv,
      includePartialMessages: true,
      // Explicit, not left to the SDK default — this is what actually makes
      // genuine model reasoning available to stream to the UI instead of
      // synthesized "Working — …" filler. 'summarized' matches what Claude.ai
      // itself shows: real reasoning, condensed to what's worth reading live.
      thinking: { type: 'adaptive', display: 'summarized' },
      ...(enableMcpDebug && { includeHookEvents: true }),
      ...(this.cliPath && { pathToClaudeCodeExecutable: this.cliPath }),
      permissionMode: effectivePermissionMode,
      ...(effectivePermissionMode === 'bypassPermissions' && { allowDangerouslySkipPermissions: true }),
      // Load project-level settings (CLAUDE.md, .claude/) so repo guardrails apply.
      settingSources: ['project'],
      ...(this.model && { model: this.model }),
      // Host-declared MCP servers (e.g. Figma) — passed directly per-run, not
      // via a checked-in .mcp.json, since the connected workspace repository
      // (this call's `cwd`) can be any external repo the user pointed the
      // Accelerator at, not necessarily this codebase.
      ...(mcpServers && { mcpServers }),
      ...(allowedTools.length > 0 && { allowedTools }),
      ...(enableMcpDebug && {
        hooks: {
          PreToolUse: [
            {
              hooks: [
                async (input) => {
                  logger(
                    buildMcpToolLogEntry({
                      server: Object.keys(mcpServers ?? {})[0] ?? 'mcp',
                      toolName: input.tool_name,
                      toolInput: input.tool_input,
                      toolUseId: input.tool_use_id,
                      event: 'pre',
                    }),
                  );
                  return { continue: true };
                },
              ],
            },
          ],
          PostToolUse: [
            {
              hooks: [
                async (input) => {
                  logger(
                    buildMcpToolLogEntry({
                      server: Object.keys(mcpServers ?? {})[0] ?? 'mcp',
                      toolName: input.tool_name,
                      toolInput: input.tool_input,
                      toolOutput: input.tool_response,
                      toolUseId: input.tool_use_id,
                      durationMs: input.duration_ms,
                      event: 'post',
                    }),
                  );
                  return { continue: true };
                },
              ],
            },
          ],
          PermissionDenied: [
            {
              hooks: [
                async (input) => {
                  logger(
                    buildMcpToolLogEntry({
                      server: Object.keys(mcpServers ?? {})[0] ?? 'mcp',
                      toolName: input.tool_name,
                      toolInput: input.tool_input,
                      toolUseId: input.tool_use_id,
                      permissionDeniedReason: input.reason,
                      event: 'permission-denied',
                    }),
                  );
                  return { continue: true };
                },
              ],
            },
          ],
          PostToolUseFailure: [
            {
              hooks: [
                async (input) => {
                  logger(
                    buildMcpToolLogEntry({
                      server: Object.keys(mcpServers ?? {})[0] ?? 'mcp',
                      toolName: input.tool_name,
                      toolInput: input.tool_input,
                      toolOutput: input.error,
                      toolUseId: input.tool_use_id,
                      durationMs: input.duration_ms,
                      event: 'failure',
                    }),
                  );
                  return { continue: true };
                },
              ],
            },
          ],
        },
      }),
    };

    const mapper = new ClaudeCodeStreamMapper();
    let runId = '';
    let model = this.model;
    let output = '';
    let failureMessage = '';

    try {
      for await (const message of query({ prompt, options })) {
        if (signal.aborted) break;

        if (message.type === 'system' && message.subtype === 'init') {
          runId = message.session_id;
          model = message.model;
          // Rebuilt without spreading the previous cachedHealth: a run that
          // reaches init() proves auth is currently valid, so any stale
          // lastRunError/subscriptionType from an earlier failure must not
          // survive into this fresh, healthy state.
          this.cachedHealth = {
            ok: true,
            model: message.model,
            cliVersion: message.claude_code_version,
            permissionMode: this.permissionMode,
            lastAuthSource: message.apiKeySource,
          };
        }

        if (message.type === 'result') {
          runId = message.session_id || runId;
          if (message.subtype === 'success') {
            output = message.result;
          } else {
            failureMessage = `Claude Code run failed (${message.subtype}).`;
          }
        }

        for (const event of mapper.map(message)) {
          onEvent(event);
        }
      }

      if (signal.aborted) {
        return { runId, status: 'cancelled', model: model || undefined, durationMs: Date.now() - startMs };
      }

      if (failureMessage) {
        onEvent({ kind: 'error', message: failureMessage } satisfies NormalizedEvent);
        return { runId, status: 'error', model: model || undefined, durationMs: Date.now() - startMs };
      }

      return {
        runId,
        status: 'finished',
        durationMs: Date.now() - startMs,
        output,
        model: model || undefined,
      };
    } catch (error) {
      if (signal.aborted) {
        return { runId, status: 'cancelled', model: model || undefined, durationMs: Date.now() - startMs };
      }
      const raw = error instanceof Error ? error.message : 'Unexpected Claude Code error.';
      // The CLI reports a missing sign-in as a run error — translate it into
      // an actionable instruction and flag it on health so the AI Providers
      // page shows "Needs attention" instead of a silent failure loop. This
      // is a defense-in-depth signal for a session going stale mid-use
      // (e.g. logout in another terminal); the authoritative check is
      // `checkAuthStatus()` in initialize()/refreshHealth(), re-run on demand.
      const notSignedIn = /not logged in/i.test(raw);
      const message = notSignedIn ? NOT_SIGNED_IN_MESSAGE : raw;
      if (notSignedIn) {
        this.cachedHealth = { ...this.cachedHealth, ok: false, lastRunError: message };
      }
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId, status: 'error', model: model || undefined, durationMs: Date.now() - startMs };
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
}
