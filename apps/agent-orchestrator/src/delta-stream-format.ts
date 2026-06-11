import type { InteractionUpdate } from '@cursor/sdk';

/**
 * Maps `agent.send({ onDelta })` payloads to the same SSE JSON shape as `stream-format.ts`
 * where possible, plus `thinking_delta` / `text_delta` / `thinking_done` for the playground UI.
 *
 * @see https://cursor.com/docs/api/sdk/typescript — "Streaming raw deltas"
 */
export function interactionUpdateToSsePayloads(update: InteractionUpdate): Record<string, unknown>[] {
  switch (update.type) {
    case 'thinking-delta':
      return update.text ? [{ kind: 'thinking_delta', text: update.text }] : [];
    case 'thinking-completed':
      return [{ kind: 'thinking_done', durationMs: update.thinkingDurationMs }];
    case 'text-delta':
      return update.text ? [{ kind: 'text_delta', text: update.text }] : [];
    default:
      return [];
  }
}
