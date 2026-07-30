import { execFile, spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AiProviderAdapter, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import { CursorCliStreamMapper } from './cli-stream-format.js';

const execFileAsync = promisify(execFile);

const NOT_SIGNED_IN_MESSAGE =
  "Cursor CLI is installed but not signed in on this machine. Open a terminal, run `cursor-agent login`, complete the browser sign-in with your Cursor account, then try again.";

// Cursor's own installer places the binary here; the server process's PATH
// may not include it (e.g. launched by a process manager without a login
// shell), so this is a documented, known-good fallback location — not a
// guess. See https://cursor.com/docs/cli.
const FALLBACK_INSTALL_PATH = path.join(homedir(), '.local', 'bin', 'cursor-agent');

type CursorCliStatus = {
  isAuthenticated: boolean;
  message?: string;
};

type CursorCliAbout = {
  cliVersion?: string;
  model?: string;
  subscriptionTier?: string | null;
  userEmail?: string | null;
};

export type CursorCliAdapterConfig = {
  /** Preferred model ID (e.g. 'sonnet-4-thinking', 'gpt-5'). Omitted = Cursor's own "Auto" selection. */
  model?: string;
};

/**
 * Runs Cursor through the official Cursor CLI (`cursor-agent`) installed on
 * this machine — a separate product from `@cursor/sdk` (which is API-key
 * only). The CLI supports `cursor-agent login`, a real browser OAuth flow
 * against the user's Cursor account, with the resulting session reused by
 * every subsequent CLI invocation on this machine — the same trust model
 * ClaudeCodeAdapter already uses for the `claude` CLI.
 *
 * Authentication: never reads Cursor's stored credential file directly (its
 * location and format are undocumented); always shells out to the CLI's own
 * documented commands (`status`, `about`, `-p`) and lets it manage its own
 * session. Per Cursor's terms, subscription usage is individual — this
 * method is only valid when the orchestrator runs on the user's own machine.
 */
export class CursorCliAdapter implements AiProviderAdapter {
  readonly id = 'cursor:cli';
  readonly providerId = 'cursor';
  readonly providerLabel = 'Cursor';
  readonly label = 'Cursor (Cursor CLI)';
  readonly authMethod = {
    id: 'cli',
    label: 'Cursor CLI (subscription)',
    kind: 'local-runtime',
    source: 'personal',
    description:
      'Runs through the Cursor CLI installed on this machine, using your personal Cursor sign-in. No API key needed; usage counts against your own plan.',
    signInCommand: 'cursor-agent login',
    installUrl: 'https://cursor.com/cli',
  } as const;
  readonly capabilities = { localRepoEdits: true, streaming: true, mcp: true } as const;

  private readonly model: string;
  private binaryPath = 'cursor-agent';
  private cliVersion = '';
  private cachedHealth: ProviderHealth = { ok: false };

  constructor(config: CursorCliAdapterConfig = {}) {
    this.model = config.model?.trim() ?? '';
  }

  /** Resolves which invocation of the binary actually works — bare name via PATH, or the documented install-path fallback. */
  private async resolveBinary(): Promise<string> {
    try {
      await execFileAsync('cursor-agent', ['--version'], { timeout: 10_000 });
      return 'cursor-agent';
    } catch (bareError) {
      try {
        await access(FALLBACK_INSTALL_PATH, constants.X_OK);
        await execFileAsync(FALLBACK_INSTALL_PATH, ['--version'], { timeout: 10_000 });
        return FALLBACK_INSTALL_PATH;
      } catch {
        throw bareError;
      }
    }
  }

  private async checkStatus(): Promise<CursorCliStatus> {
    try {
      const { stdout } = await execFileAsync(this.binaryPath, ['status', '--format', 'json'], { timeout: 10_000 });
      const parsed = JSON.parse(stdout) as Partial<CursorCliStatus>;
      return { isAuthenticated: Boolean(parsed.isAuthenticated), message: parsed.message };
    } catch {
      return { isAuthenticated: false };
    }
  }

  private async checkAbout(): Promise<CursorCliAbout> {
    try {
      const { stdout } = await execFileAsync(this.binaryPath, ['about', '--format', 'json'], { timeout: 10_000 });
      return JSON.parse(stdout) as CursorCliAbout;
    } catch {
      return {};
    }
  }

  async initialize(): Promise<void> {
    try {
      this.binaryPath = await this.resolveBinary();
    } catch {
      throw new Error(
        'Cursor CLI is not installed (the `cursor-agent` command was not found). Install it from https://cursor.com/cli and sign in with `cursor-agent login` to enable this method.',
      );
    }

    const status = await this.checkStatus();
    if (!status.isAuthenticated) {
      throw new Error(NOT_SIGNED_IN_MESSAGE);
    }

    const about = await this.checkAbout();
    this.cliVersion = about.cliVersion ?? '';

    this.cachedHealth = {
      ok: true,
      cliVersion: this.cliVersion,
      lastAuthSource: 'oauth',
      ...(this.model && { model: this.model }),
      ...(about.subscriptionTier && { subscriptionType: about.subscriptionTier }),
      ...(about.userEmail && { signedInAs: about.userEmail }),
    };

    console.log(`[cursor-cli] cli: ${this.cliVersion} (${this.binaryPath})`);
    console.log(`[cursor-cli] auth: oauth (${about.subscriptionTier ?? 'n/a'})`);
    if (this.model) console.log(`[cursor-cli] model: ${this.model}`);
  }

  health(): ProviderHealth {
    return this.cachedHealth;
  }

  async runJob(input: RunJobInput): Promise<RunJobResult> {
    const { prompt, cwd, onEvent, signal, readOnly } = input;
    const startMs = Date.now();

    if (signal.aborted) {
      return { runId: '', status: 'cancelled', model: this.model || undefined };
    }

    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--trust', '--workspace', cwd];
    if (this.model) args.push('--model', this.model);
    // '--mode ask' is a genuinely read-only, non-executing mode enforced by
    // the CLI itself (like Claude's SDK-level 'plan' mode) — not a prompt
    // instruction the model could misread.
    if (readOnly) args.push('--mode', 'ask');

    const mapper = new CursorCliStreamMapper();
    let runId = '';
    let model = this.model;
    let output = '';
    let failureMessage = '';
    let stderrBuffer = '';

    const child = spawn(this.binaryPath, args, { cwd, env: process.env });

    const onAbort = () => {
      child.kill('SIGTERM');
    };
    signal.addEventListener('abort', onAbort, { once: true });

    let stdoutBuffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue; // malformed/partial line — skip rather than crash the job
        }
        this.handleEvent(parsed, mapper, onEvent, (r) => {
          runId = r.runId ?? runId;
          model = r.model ?? model;
          output = r.output ?? output;
          failureMessage = r.failureMessage ?? failureMessage;
        });
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf8');
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('close', (code) => resolve(code));
      child.on('error', () => resolve(-1));
    });

    signal.removeEventListener('abort', onAbort);

    if (signal.aborted) {
      return { runId, status: 'cancelled', model: model || undefined, durationMs: Date.now() - startMs };
    }

    if (exitCode !== 0 && !output) {
      const raw = stderrBuffer.trim() || failureMessage || `Cursor CLI exited with code ${exitCode}.`;
      const notSignedIn = /authentication required|not logged in/i.test(raw);
      const message = notSignedIn ? NOT_SIGNED_IN_MESSAGE : raw;
      if (notSignedIn) {
        this.cachedHealth = { ...this.cachedHealth, ok: false, lastRunError: message };
      }
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId, status: 'error', model: model || undefined, durationMs: Date.now() - startMs };
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
  }

  private handleEvent(
    raw: unknown,
    mapper: CursorCliStreamMapper,
    onEvent: (event: NormalizedEvent) => void,
    onResult: (r: { runId?: string; model?: string; output?: string; failureMessage?: string }) => void,
  ): void {
    if (typeof raw !== 'object' || raw === null) return;
    const event = raw as Record<string, unknown>;

    if (event.type === 'result') {
      const sessionId = typeof event.session_id === 'string' ? event.session_id : undefined;
      if (event.subtype === 'success' && typeof event.result === 'string') {
        onResult({ runId: sessionId, output: event.result });
      } else {
        onResult({ runId: sessionId, failureMessage: `Cursor CLI run failed (${String(event.subtype ?? 'unknown')}).` });
      }
      return;
    }

    for (const normalized of mapper.map(event)) {
      onEvent(normalized);
    }
  }
}
