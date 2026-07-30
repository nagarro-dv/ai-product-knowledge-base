import OpenAI from 'openai';
import type { AiProviderAdapter, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import { OpenAIStreamMapper } from './stream-format.js';

export type OpenAIAdapterConfig = {
  apiKey: string;
  /** Preferred model ID. Defaults to DEFAULT_MODEL when omitted or empty. */
  model?: string;
  /** Maximum output tokens. Default 8192. */
  maxTokens?: number;
};

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 8192;

export class OpenAIAdapter implements AiProviderAdapter {
  readonly id = 'openai:api-key';
  readonly providerId = 'openai';
  readonly providerLabel = 'ChatGPT';
  readonly label = 'ChatGPT (API key)';
  readonly authMethod = {
    id: 'api-key',
    label: 'Managed by organisation',
    kind: 'api-key',
    source: 'organisation',
    description: 'Uses an OpenAI API key configured centrally by your workspace admin. Billed to the organisation.',
  } as const;
  readonly capabilities = { localRepoEdits: false, streaming: true, mcp: false } as const;

  private readonly client: OpenAI;
  private readonly requestedModel: string;
  private readonly maxTokens: number;
  private resolvedModel = '';
  private cachedHealth: ProviderHealth = { ok: false };

  constructor(config: OpenAIAdapterConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.requestedModel = config.model?.trim() ?? '';
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async initialize(): Promise<void> {
    // Validate the API key with a real network call.
    // An invalid key causes models.list() to throw — startup halts, same pattern as
    // CursorAdapter and ClaudeAdapter.
    const page = await this.client.models.list();
    if (!page.data.length) {
      throw new Error('No OpenAI models available for this API key.');
    }

    // Use the requested model or the default. We intentionally do NOT validate the model
    // against the full OpenAI model list: it contains hundreds of fine-tuned and deprecated
    // entries, so strict membership is not a reliable availability signal. A bad model name
    // surfaces naturally as a clear API error on the first runJob() call.
    this.resolvedModel = this.requestedModel || DEFAULT_MODEL;

    this.cachedHealth = {
      ok: true,
      model: this.resolvedModel,
    };

    console.log(`[openai] model: ${this.resolvedModel}`);
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

    const mapper = new OpenAIStreamMapper();
    let runId = '';
    let textOutput = '';

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.resolvedModel,
          max_tokens: this.maxTokens,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        },
        { signal },
      );

      for await (const chunk of stream) {
        if (signal.aborted) break;

        // Every chunk shares the same completion id; capture it once.
        if (!runId) runId = chunk.id;

        // Accumulate text for the RunJobResult.output field.
        const content = chunk.choices[0]?.delta.content;
        if (content) textOutput += content;

        for (const normalized of mapper.map(chunk)) {
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
      const message = error instanceof Error ? error.message : 'Unexpected OpenAI error.';
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId, status: 'error', model: this.resolvedModel, durationMs: Date.now() - startMs };
    }
  }
}
