import { GoogleGenAI } from '@google/genai';
import type { AiProviderAdapter, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import { GeminiStreamMapper } from './stream-format.js';

export type GeminiAdapterConfig = {
  apiKey: string;
  /** Preferred model ID. Defaults to DEFAULT_MODEL when omitted or empty. */
  model?: string;
  /** Maximum output tokens. Default 8192. */
  maxTokens?: number;
};

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_MAX_TOKENS = 8192;

export class GeminiAdapter implements AiProviderAdapter {
  readonly id = 'gemini:api-key';
  readonly providerId = 'gemini';
  readonly providerLabel = 'Gemini';
  readonly label = 'Gemini (API key)';
  readonly authMethod = {
    id: 'api-key',
    label: 'Managed by organisation',
    kind: 'api-key',
    source: 'organisation',
    description: 'Uses a Google AI API key configured centrally by your workspace admin. Billed to the organisation.',
  } as const;
  readonly capabilities = { localRepoEdits: false, streaming: true, mcp: false } as const;

  private readonly ai: GoogleGenAI;
  private readonly requestedModel: string;
  private readonly maxTokens: number;
  private resolvedModel = '';
  private cachedHealth: ProviderHealth = { ok: false };

  constructor(config: GeminiAdapterConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.requestedModel = config.model?.trim() ?? '';
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async initialize(): Promise<void> {
    const pager = await this.ai.models.list();
    let hasModels = false;
    for await (const _model of pager) {
      hasModels = true;
      break;
    }
    if (!hasModels) {
      throw new Error('No Gemini models available for this API key.');
    }

    this.resolvedModel = this.requestedModel || DEFAULT_MODEL;
    this.cachedHealth = { ok: true, model: this.resolvedModel };
    console.log(`[gemini] model: ${this.resolvedModel}`);
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

    const mapper = new GeminiStreamMapper();
    let runId = '';
    let textOutput = '';

    try {
      const stream = await this.ai.models.generateContentStream({
        model: this.resolvedModel,
        contents: prompt,
        config: {
          maxOutputTokens: this.maxTokens,
          abortSignal: signal,
        },
      });

      for await (const chunk of stream) {
        if (signal.aborted) break;

        if (!runId && chunk.responseId) runId = chunk.responseId;

        const text = chunk.text;
        if (text) textOutput += text;

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
      const message = error instanceof Error ? error.message : 'Unexpected Gemini error.';
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId, status: 'error', model: this.resolvedModel, durationMs: Date.now() - startMs };
    }
  }
}
