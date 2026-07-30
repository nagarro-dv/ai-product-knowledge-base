import type OpenAI from 'openai';
import type { NormalizedEvent } from '../types.js';

type ChatCompletionChunk = OpenAI.ChatCompletionChunk;

/**
 * Stateless mapper for OpenAI chat completion stream chunks.
 *
 * OpenAI streaming is self-contained per chunk — each chunk carries its delta
 * independently with no cross-chunk state (unlike Anthropic, which requires
 * tracking which block type opened at which index). A class is used for
 * consistency with ClaudeStreamMapper; no instance state is needed.
 *
 * Create one instance per runJob() call.
 */
export class OpenAIStreamMapper {
  map(chunk: ChatCompletionChunk): NormalizedEvent[] {
    const choice = chunk.choices[0];
    if (!choice) return [];

    const { delta } = choice;
    const events: NormalizedEvent[] = [];

    // The first chunk carries role: 'assistant' — use it as the RUNNING signal.
    if (delta.role === 'assistant') {
      events.push({ kind: 'status', status: 'RUNNING', message: 'OpenAI is responding…' });
    }

    // Text content maps directly to text_delta, matching Claude's streaming output contract.
    if (delta.content) {
      events.push({ kind: 'text_delta', text: delta.content });
    }

    // finish_reason === 'stop' is the terminal signal — no event needed here;
    // RunJobResult.status = 'finished' is the authoritative end marker.

    return events;
  }
}
