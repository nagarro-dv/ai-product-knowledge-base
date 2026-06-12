/**
 * Provider-neutral contract for AI adapters used by the DS Accelerator.
 *
 * Rules:
 * - Adapters must not throw from runJob(). Surface errors via onEvent({ kind: 'error' })
 *   and the returned status.
 * - Adapters must not emit a { kind: 'done' } event. The server emits it from RunJobResult.
 * - Adapters must honor signal.abort() and return status 'cancelled' when aborted.
 */

export type NormalizedEvent = Record<string, unknown>;

export type RunJobInput = {
  prompt: string;
  cwd: string;
  onEvent: (event: NormalizedEvent) => void;
  /**
   * Abort this signal to cancel the job. The adapter must stop work and return
   * { status: 'cancelled' } as quickly as the underlying provider allows.
   */
  signal: AbortSignal;
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

export interface AiProviderAdapter {
  readonly id: string;
  readonly label: string;

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
