import type { RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import type { NormalizedEvent } from '../types.js';

/**
 * Stateful mapper for the Anthropic raw message stream.
 *
 * Must be stateful because Anthropic streaming is a state machine:
 * `content_block_start` announces the type of a block (thinking/text),
 * `content_block_delta` sends chunks of it, and `content_block_stop` closes
 * it — but the stop event carries only an index, so without remembering what
 * started at that index we cannot know whether to emit `thinking_done` or nothing.
 *
 * Create one instance per runJob() call; do not share across jobs.
 */
export class ClaudeStreamMapper {
  private readonly blockTypes = new Map<number, 'thinking' | 'text'>();
  private thinkingBlockStartMs = 0;

  map(event: RawMessageStreamEvent): NormalizedEvent[] {
    switch (event.type) {
      case 'message_start':
        return [{ kind: 'status', status: 'RUNNING', message: 'Claude is responding…' }];

      case 'content_block_start': {
        const { index, content_block } = event;
        if (content_block.type === 'thinking') {
          this.blockTypes.set(index, 'thinking');
          this.thinkingBlockStartMs = Date.now();
        } else if (content_block.type === 'text') {
          this.blockTypes.set(index, 'text');
        }
        // Other block types (tool_use, server_tool_use, etc.) are not tracked.
        return [];
      }

      case 'content_block_delta': {
        const { delta } = event;
        if (delta.type === 'thinking_delta') {
          // Note: Anthropic SDK uses `.thinking` not `.text` on ThinkingDelta.
          return delta.thinking ? [{ kind: 'thinking_delta', text: delta.thinking }] : [];
        }
        if (delta.type === 'text_delta') {
          return delta.text ? [{ kind: 'text_delta', text: delta.text }] : [];
        }
        return [];
      }

      case 'content_block_stop': {
        const blockType = this.blockTypes.get(event.index);
        this.blockTypes.delete(event.index);
        if (blockType === 'thinking') {
          const durationMs = Date.now() - this.thinkingBlockStartMs;
          return [{ kind: 'thinking_done', durationMs }];
        }
        // Text blocks and others: no terminal event needed.
        return [];
      }

      // message_delta carries stop_reason and usage; message_stop is the final sentinel.
      // Neither produces a user-visible event — the server emits `done` from RunJobResult.
      case 'message_delta':
      case 'message_stop':
        return [];

      default:
        return [];
    }
  }
}
