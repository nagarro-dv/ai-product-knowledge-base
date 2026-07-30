import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import type { NormalizedEvent } from '../types.js';
import { ClaudeStreamMapper } from '../claude/stream-format.js';

function authSourceLabel(apiKeySource: string): string {
  // 'none' = no API key in play → the run uses the Claude sign-in stored on
  // this machine (subscription). 'oauth' is reported by some versions for the
  // same situation. Anything else names where an API key came from.
  if (apiKeySource === 'oauth' || apiKeySource === 'none') return 'using the Claude sign-in on this machine';
  return `using an API key (${apiKeySource})`;
}

/**
 * Maps Claude Agent SDK messages to the normalized event contract.
 *
 * Delta events arrive as `stream_event` messages wrapping the same raw
 * Anthropic stream events the Messages API emits, so the existing
 * ClaudeStreamMapper is reused for them (the SDK types them as the beta
 * variant — structurally identical for the event kinds we map).
 *
 * Create one instance per runJob() call.
 */
export class ClaudeCodeStreamMapper {
  private readonly deltaMapper = new ClaudeStreamMapper();

  map(message: SDKMessage): NormalizedEvent[] {
    switch (message.type) {
      case 'system': {
        if (message.subtype === 'init') {
          return [
            {
              kind: 'status',
              status: 'RUNNING',
              message: `Claude Code ${message.claude_code_version} · ${message.model} · ${authSourceLabel(message.apiKeySource)}`,
            },
          ];
        }
        return [];
      }

      case 'stream_event':
        return this.deltaMapper.map(message.event as unknown as RawMessageStreamEvent);

      case 'assistant': {
        const events: NormalizedEvent[] = [];
        for (const block of message.message.content) {
          if (block.type === 'text' && block.text.trim()) {
            events.push({ kind: 'assistant', text: block.text });
          } else if (block.type === 'thinking' && block.thinking.trim()) {
            // Fallback for the full (non-delta) message shape — the delta
            // stream (stream_event → thinking_delta) is the primary path when
            // includePartialMessages is on, but a complete thinking block can
            // also arrive here; either way this is genuine model reasoning,
            // never synthesized filler.
            events.push({ kind: 'thinking', text: block.thinking });
          } else if (block.type === 'tool_use') {
            let argsPreview = '';
            try {
              argsPreview = JSON.stringify(block.input).slice(0, 120);
            } catch {
              // non-serializable input — omit the preview
            }
            events.push({ kind: 'tool', name: block.name, status: 'started', callId: block.id, argsPreview });
          }
        }
        return events;
      }

      // The terminal `result` message becomes RunJobResult in the adapter;
      // the server emits the `done` event from it. Everything else (hooks,
      // task notifications, tool progress, …) is internal detail.
      default:
        return [];
    }
  }
}
