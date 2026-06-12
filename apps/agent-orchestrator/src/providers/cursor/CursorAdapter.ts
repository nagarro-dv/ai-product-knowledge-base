import { Agent, Cursor } from '@cursor/sdk';
import type { SDKAgent } from '@cursor/sdk';
import type { AiProviderAdapter, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import { sdkMessageToSsePayloads } from './stream-format.js';
import { interactionUpdateToSsePayloads } from './delta-stream-format.js';

type LocalSettingSource = 'project' | 'user' | 'team' | 'mdm' | 'plugins' | 'all';

export type CursorAdapterConfig = {
  apiKey: string;
  /** Preferred model ID. When omitted or unavailable, falls back to codex → composer → first available. */
  requestedModel?: string;
  /**
   * Cursor local setting sources. Pass ['all'] to load MCP servers (e.g. Figma).
   * Uses string[] so callers don't need to import the Cursor-specific union type.
   */
  settingSources?: string[];
};

export class CursorAdapter implements AiProviderAdapter {
  readonly id = 'cursor';
  readonly label = 'Cursor';

  private readonly apiKey: string;
  private readonly requestedModel: string;
  private readonly settingSources: string[];
  private resolvedModelId = '';
  private cachedHealth: ProviderHealth = { ok: false };

  constructor(config: CursorAdapterConfig) {
    this.apiKey = config.apiKey;
    this.requestedModel = config.requestedModel ?? '';
    this.settingSources = config.settingSources ?? ['all'];
  }

  async initialize(): Promise<void> {
    const me = await Cursor.me({ apiKey: this.apiKey });
    const models = await Cursor.models.list({ apiKey: this.apiKey });

    if (models.length === 0) {
      throw new Error('No Cursor models available for this API key.');
    }

    if (!this.requestedModel) {
      const codex = models.find((m) => /codex/i.test(m.id));
      const composer = models.find((m) => /composer/i.test(m.id));
      this.resolvedModelId = codex?.id ?? composer?.id ?? models[0].id;
    } else if (!models.some((m) => m.id === this.requestedModel)) {
      const codex = models.find((m) => /codex/i.test(m.id));
      this.resolvedModelId = codex?.id ?? models[0].id;
      console.warn(
        `[cursor] Requested model '${this.requestedModel}' unavailable for key '${me.apiKeyName}'. ` +
          `Falling back to '${this.resolvedModelId}'.`,
      );
    } else {
      this.resolvedModelId = this.requestedModel;
    }

    const hasFigmaMcpHint = this.settingSources.includes('all');
    this.cachedHealth = {
      ok: true,
      model: this.resolvedModelId,
      localSettingSources: this.settingSources.join(',') || 'all',
      figmaMcpAccessLikely: hasFigmaMcpHint,
    };

    console.log(`[cursor] model: ${this.resolvedModelId}`);
    console.log(`[cursor] settingSources: ${this.settingSources.join(',')}`);
    console.log(`[cursor] figmaMcpAccessLikely: ${hasFigmaMcpHint}`);
  }

  health(): ProviderHealth {
    return this.cachedHealth;
  }

  async runJob(input: RunJobInput): Promise<RunJobResult> {
    const { prompt, cwd, onEvent, signal } = input;

    if (signal.aborted) {
      return { runId: '', status: 'cancelled', model: this.resolvedModelId };
    }

    // agentRef allows the abort listener to force-dispose the SDK agent the
    // moment abort() is called — same behaviour as the old cancel endpoint
    // calling disposeAgent(job.agent) directly.
    let agentRef: SDKAgent | undefined;

    const onAbort = () => {
      if (agentRef) {
        this.disposeAgent(agentRef).catch(() => {});
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      const agent = await Agent.create({
        apiKey: this.apiKey,
        model: { id: this.resolvedModelId },
        local: { cwd, settingSources: this.settingSources as LocalSettingSource[] },
      });
      agentRef = agent;

      const run = await agent.send(prompt, {
        model: {
          id: this.resolvedModelId,
          params: [{ id: 'thinking', value: 'high' }],
        },
        onDelta: ({ update }) => {
          if (signal.aborted) return;
          for (const event of interactionUpdateToSsePayloads(update)) {
            onEvent(event);
          }
        },
      });

      if (!run.supports('stream')) {
        const message = run.unsupportedReason('stream') ?? 'Stream not supported for this run.';
        onEvent({ kind: 'error', message } satisfies NormalizedEvent);
        return { runId: '', status: 'error', model: this.resolvedModelId };
      }

      for await (const message of run.stream()) {
        if (signal.aborted) break;
        for (const event of sdkMessageToSsePayloads(message)) {
          onEvent(event);
        }
      }

      if (signal.aborted) {
        return { runId: '', status: 'cancelled', model: this.resolvedModelId };
      }

      const result = await run.wait();
      return {
        runId: result.id,
        status: result.status === 'finished' ? 'finished' : 'error',
        durationMs: result.durationMs,
        output: result.result ?? '',
        model: this.resolvedModelId,
      };
    } catch (error) {
      if (signal.aborted) {
        return { runId: '', status: 'cancelled', model: this.resolvedModelId };
      }
      const message = error instanceof Error ? error.message : 'Unexpected agent error.';
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId: '', status: 'error', model: this.resolvedModelId };
    } finally {
      signal.removeEventListener('abort', onAbort);
      if (agentRef) {
        await this.disposeAgent(agentRef);
      }
    }
  }

  private async disposeAgent(agent: SDKAgent): Promise<void> {
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
      // fall through to close()
    }
    try {
      if (typeof withDispose.close === 'function') {
        withDispose.close();
      }
    } catch {
      // ignore
    }
  }
}
