import type { SDKMessage, TextBlock, ToolUseBlock } from '@cursor/sdk';
import type { NormalizedEvent } from '../types.js';

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function isTextBlock(block: TextBlock | ToolUseBlock): block is TextBlock {
  return block.type === 'text';
}

/** Maps one SDK stream message to normalized events for the browser (SSE `data:` lines). */
export function sdkMessageToSsePayloads(message: SDKMessage): NormalizedEvent[] {
  switch (message.type) {
    case 'thinking':
      return message.text.trim()
        ? [{ kind: 'thinking', text: truncate(message.text, 8000) }]
        : [];
    case 'assistant': {
      const text = message.message.content
        .filter(isTextBlock)
        .map((block) => block.text)
        .join('');
      return text.trim() ? [{ kind: 'assistant', text }] : [];
    }
    case 'tool_call': {
      const argsPreview =
        message.args === undefined
          ? undefined
          : truncate(
              typeof message.args === 'string' ? message.args : JSON.stringify(message.args),
              1200,
            );
      return [
        {
          kind: 'tool',
          name: message.name,
          status: message.status,
          callId: message.call_id,
          argsPreview,
        },
      ];
    }
    case 'status':
      return [
        {
          kind: 'status',
          status: message.status,
          message: message.message ? truncate(message.message, 1000) : undefined,
        },
      ];
    case 'task':
      return [
        {
          kind: 'task',
          text: message.text ? truncate(message.text, 2000) : undefined,
          status: message.status,
        },
      ];
    case 'system':
      return message.subtype === 'init'
        ? [{ kind: 'status', status: 'INIT', message: 'Agent run connected.' }]
        : [];
    case 'request':
      return [
        {
          kind: 'status',
          status: 'REQUEST',
          message: truncate(message.request_id, 240),
        },
      ];
    default:
      return [];
  }
}
