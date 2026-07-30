/**
 * Provider-neutral contract for AI adapters used by the DS Accelerator.
 *
 * Rules:
 * - Adapters must not throw from runJob(). Surface errors via onEvent({ kind: 'error' })
 *   and the returned status.
 * - Adapters must not emit a { kind: 'done' } event. The server emits it from RunJobResult.
 * - Adapters must honor signal.abort() and return status 'cancelled' when aborted.
 */

/**
 * Every event an adapter may emit via onEvent(). The terminal { kind: 'done' } event
 * is server-generated from RunJobResult — adapters must never emit it directly.
 *
 * This union is the shared contract between the server and the web client
 * (apps/web/src/agentSseClient.ts — AgentStreamEvent mirrors it).
 */
export type NormalizedEvent =
  | { kind: 'thinking'; text: string }
  | { kind: 'thinking_delta'; text: string }
  | { kind: 'thinking_done'; durationMs?: number }
  | { kind: 'text_delta'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; status: string; callId?: string; argsPreview?: string }
  | { kind: 'status'; status: string; message?: string }
  | { kind: 'task'; text?: string; status?: string }
  | { kind: 'error'; message: string };

export type RunJobInput = {
  prompt: string;
  cwd: string;
  onEvent: (event: NormalizedEvent) => void;
  /**
   * Abort this signal to cancel the job. The adapter must stop work and return
   * { status: 'cancelled' } as quickly as the underlying provider allows.
   */
  signal: AbortSignal;
  /**
   * When true, the adapter must not execute file edits for this call,
   * regardless of its own configured permission mode. Set whenever the
   * caller has no legitimate write target (e.g. no workspace repository is
   * connected) — the prompt text alone is not a safety boundary. Adapters
   * without file-edit capability (`capabilities.localRepoEdits: false`) can
   * ignore this; they never had write access to begin with.
   */
  readOnly?: boolean;
  /**
   * Named MCP servers to make available to this run, keyed by server name
   * (e.g. 'figma'). Only adapters that declare the matching name in their
   * `authMethod.mcpServers` actually wire this up — others must ignore it
   * silently rather than error, so callers can pass it unconditionally.
   */
  mcpServers?: Record<string, McpServerRef>;
};

/** Minimal, adapter-agnostic description of a remote MCP server to connect to. */
export type McpServerRef = {
  type: 'http' | 'sse';
  url: string;
};

export type RunJobResult = {
  /**
   * Provider-native run ID. Use '' when unavailable (the server falls back to
   * job.id when emitting the terminal `done` SSE event).
   */
  runId: string;
  status: 'finished' | 'error' | 'cancelled';
  durationMs?: number;
  output?: string;
  model?: string;
};

export type ProviderHealth = {
  ok: boolean;
  model?: string;
  /** Adapters may add provider-specific keys. */
  [key: string]: unknown;
};

/**
 * How an adapter authenticates against its provider.
 *
 * - `api-key`       — server-held secret configured by an administrator (.env today).
 * - `local-runtime` — delegates to a tool installed and signed in on this machine
 *                     (e.g. Claude Code with a personal Pro/Max subscription).
 * - `oauth`         — per-user browser OAuth flow (not implemented yet).
 * - `gateway`       — company-managed AI gateway with central credentials (future).
 */
export type AuthMethodKind = 'api-key' | 'local-runtime' | 'oauth' | 'gateway';

export type AuthMethodInfo = {
  /** Stable id, unique within a provider (e.g. 'api-key', 'personal-api-key', 'claude-code'). */
  id: string;
  /** Human label, e.g. 'Managed by organisation' or 'Claude Code (subscription)'. */
  label: string;
  kind: AuthMethodKind;
  /**
   * Who owns the credential: 'organisation' = configured centrally by an
   * admin (server .env); 'personal' = belongs to the individual user on this
   * machine (their own API key or their own signed-in client).
   */
  source: 'organisation' | 'personal';
  /** One-sentence user-facing description of what this method means. */
  description: string;
  /**
   * For `kind: 'local-runtime'` methods only: the exact command a user types
   * in a terminal on this machine to sign in (e.g. 'claude' or
   * 'cursor-agent login'). Drives the generic connect-instructions UI so no
   * provider-specific copy is hardcoded on the frontend.
   */
  signInCommand?: string;
  /** For `kind: 'local-runtime'` methods only: docs URL for installing the CLI if it's missing. */
  installUrl?: string;
  /**
   * Named MCP servers this specific adapter has real, working wiring for
   * (e.g. ['figma']) — not just generic MCP capability. A caller passing
   * `RunJobInput.mcpServers.figma` only has an effect if 'figma' appears
   * here; otherwise the adapter never had a wired connection for it and the
   * name is a no-op. Absent or empty = no named MCP servers wired.
   */
  mcpServers?: readonly string[];
};

/** What a provider+auth-method runtime can actually do. Surfaced to the UI — never overstate. */
export type AdapterCapabilities = {
  /** Can edit files in the local repository (agentic runtime), vs. text-only suggestions. */
  localRepoEdits: boolean;
  streaming: boolean;
  /** Can reach MCP servers/tools configured on this machine. */
  mcp: boolean;
};

export interface AiProviderAdapter {
  /** Unique adapter id: `${providerId}:${authMethod.id}`. */
  readonly id: string;
  /** Provider family this adapter belongs to (e.g. 'claude'). Job requests select by this id. */
  readonly providerId: string;
  /** Human label for the provider family (e.g. 'Claude'). */
  readonly providerLabel: string;
  /** Human label for this specific runtime (e.g. 'Claude (Claude Code)'). */
  readonly label: string;
  readonly authMethod: AuthMethodInfo;
  readonly capabilities: AdapterCapabilities;

  /**
   * Called once at server startup. Validates credentials and resolves the
   * model to use. Throws if the provider cannot be used — this halts startup.
   */
  initialize(): Promise<void>;

  /**
   * Runs a single AI job to completion (finished, error, or cancelled).
   * Must never throw. Fires normalized events via onEvent for every
   * meaningful update; the caller accumulates and streams them.
   */
  runJob(input: RunJobInput): Promise<RunJobResult>;

  /**
   * Returns the last-known health state. Synchronous so the health endpoint
   * stays instant. Populated during initialize() and updated on each runJob().
   */
  health(): ProviderHealth;
}
