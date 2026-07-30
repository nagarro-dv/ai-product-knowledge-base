import Anthropic from '@anthropic-ai/sdk';
import type { AiProviderAdapter, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import { ClaudeStreamMapper } from './stream-format.js';

export type ClaudeAdapterConfig = {
  apiKey: string;
  /** Preferred model ID. Defaults to DEFAULT_MODEL when omitted or empty. */
  model?: string;
  /** Maximum output tokens. Must exceed thinkingBudget when extendedThinking is true. Default 8192. */
  maxTokens?: number;
  /** Enable extended thinking. When true, thinking_delta/thinking_done events are emitted. Default false. */
  extendedThinking?: boolean;
  /** Token budget for extended thinking. Must be >= 1024 and < maxTokens. Default 5000. */
  thinkingBudget?: number;
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_THINKING_BUDGET = 5000;

export class ClaudeAdapter implements AiProviderAdapter {
  readonly id = 'claude:api-key';
  readonly providerId = 'claude';
  readonly providerLabel = 'Claude';
  readonly label = 'Claude (API key)';
  readonly authMethod = {
    id: 'api-key',
    label: 'Managed by organisation',
    kind: 'api-key',
    source: 'organisation',
    description: 'Uses an Anthropic API key configured centrally by your workspace admin. Billed to the organisation.',
  } as const;
  readonly capabilities = { localRepoEdits: false, streaming: true, mcp: false } as const;

  private readonly client: Anthropic;
  private readonly requestedModel: string;
  private readonly maxTokens: number;
  private readonly extendedThinking: boolean;
  private readonly thinkingBudget: number;
  private resolvedModel = '';
  private cachedHealth: ProviderHealth = { ok: false };

  constructor(config: ClaudeAdapterConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.requestedModel = config.model?.trim() ?? '';
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.extendedThinking = config.extendedThinking ?? false;
    this.thinkingBudget = config.thinkingBudget ?? DEFAULT_THINKING_BUDGET;
  }

  async initialize(): Promise<void> {
    // Validate the API key and discover available models with a real network call.
    // If the key is invalid, models.list() throws and startup halts — same pattern as CursorAdapter.
    const page = await this.client.models.list({ limit: 100 });
    const modelIds = page.data.map((m) => m.id);

    if (modelIds.length === 0) {
      throw new Error('No Claude models available for this API key.');
    }

    if (this.extendedThinking && this.thinkingBudget >= this.maxTokens) {
      throw new Error(
        `[claude] Invalid config: thinkingBudget (${this.thinkingBudget}) must be less than maxTokens (${this.maxTokens}).`,
      );
    }

    // Prefer the explicitly requested model; fall back to DEFAULT_MODEL if absent or unknown;
    // fall back further to the first available model if DEFAULT_MODEL itself is not in the list.
    const pickModel = (preferred: string): string =>
      modelIds.includes(preferred) ? preferred : (modelIds[0] as string);

    if (!this.requestedModel) {
      this.resolvedModel = pickModel(DEFAULT_MODEL);
      if (this.resolvedModel !== DEFAULT_MODEL) {
        console.warn(`[claude] Default model '${DEFAULT_MODEL}' not in account — using '${this.resolvedModel}'.`);
      }
    } else if (!modelIds.includes(this.requestedModel)) {
      const fallback = pickModel(DEFAULT_MODEL);
      console.warn(
        `[claude] Requested model '${this.requestedModel}' not found in account. Falling back to '${fallback}'.`,
      );
      this.resolvedModel = fallback;
    } else {
      this.resolvedModel = this.requestedModel;
    }

    this.cachedHealth = {
      ok: true,
      model: this.resolvedModel,
      extendedThinking: this.extendedThinking,
    };

    console.log(`[claude] model: ${this.resolvedModel}`);
    console.log(`[claude] extendedThinking: ${this.extendedThinking}`);
    if (this.extendedThinking) {
      console.log(`[claude] thinkingBudget: ${this.thinkingBudget}`);
    }
  }

  health(): ProviderHealth {
    return this.cachedHealth;
  }

  async runJob(input: RunJobInput): Promise<RunJobResult> {
    const { prompt, onEvent, signal } = input;
    const startMs = Date.now();

    if (signal.aborted) {
      return { runId: '', status: 'cancelled', model: this.resolvedModel };
    }

    const mapper = new ClaudeStreamMapper();
    let runId = '';
    let textOutput = '';

    try {
      const stream = await this.client.messages.create(
        {
          model: this.resolvedModel,
          max_tokens: this.maxTokens,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          ...(this.extendedThinking && {
            thinking: { type: 'enabled', budget_tokens: this.thinkingBudget },
          }),
        },
        { signal },
      );

      for await (const event of stream) {
        if (signal.aborted) break;

        // Capture the Anthropic message ID from the first event to use as runId.
        if (event.type === 'message_start') {
          runId = event.message.id;
        }

        // Accumulate text for the RunJobResult.output field.
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          textOutput += event.delta.text;
        }

        for (const normalized of mapper.map(event)) {
          onEvent(normalized);
        }
      }

      if (signal.aborted) {
        return { runId, status: 'cancelled', model: this.resolvedModel, durationMs: Date.now() - startMs };
      }

      return {
        runId,
        status: 'finished',
        durationMs: Date.now() - startMs,
        output: textOutput,
        model: this.resolvedModel,
      };
    } catch (error) {
      if (signal.aborted) {
        return { runId, status: 'cancelled', model: this.resolvedModel, durationMs: Date.now() - startMs };
      }
      const message = error instanceof Error ? error.message : 'Unexpected Claude error.';
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId, status: 'error', model: this.resolvedModel, durationMs: Date.now() - startMs };
    }
  }
}
