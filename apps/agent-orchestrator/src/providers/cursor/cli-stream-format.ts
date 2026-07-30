import type { NormalizedEvent } from '../types.js';

/**
 * Maps Cursor CLI's `--output-format stream-json --verbose` NDJSON events to
 * the normalized event contract.
 *
 * Event shapes here are NOT fully covered by Cursor's public docs — this is
 * built from real captured examples (a community write-up cross-checked
 * against guidance from a Cursor staff member) rather than the official
 * reference, which only documents the top-level format, not per-event
 * fields. Treat every field access as best-effort: unknown/future shapes are
 * silently ignored rather than thrown on, matching this codebase's existing
 * "honest gaps, never crash on a provider payload" convention.
 *
 * Confirmed event kinds:
 * - `user`             — echo of the input prompt. Ignored.
 * - `assistant`        — text content. Cursor deliberately emits the SAME
 *                         text three times in different shapes (their staff's
 *                         own documented dedup rule): a real streaming delta
 *                         has `timestamp_ms` and NO `model_call_id`; a
 *                         buffered flush right before a tool call has BOTH;
 *                         a final full-text flush has NEITHER. Only the first
 *                         form is treated as a delta — the other two would
 *                         double- or triple-print the same text.
 * - `tool_call`        — `subtype: "started" | "completed"`, `tool_call` is
 *                         an object keyed by a single camelCase name like
 *                         `readToolCall`/`writeToolCall` (the key IS the tool
 *                         identity; Cursor has not published an enumeration).
 * - `result`           — terminal. Canonical final answer lives in `.result`.
 * - `system` (init)    — only emitted with `--verbose`; used here just to
 *                         confirm the session started.
 */
export class CursorCliStreamMapper {
  map(raw: unknown): NormalizedEvent[] {
    if (typeof raw !== 'object' || raw === null) return [];
    const event = raw as Record<string, unknown>;
    const type = typeof event.type === 'string' ? event.type : '';

    switch (type) {
      case 'system':
        return this.mapSystem(event);
      case 'assistant':
        return this.mapAssistant(event);
      case 'tool_call':
        return this.mapToolCall(event);
      // 'user' is an echo of our own prompt; 'result' becomes RunJobResult in
      // the adapter (the server emits the terminal `done` event from it).
      default:
        return [];
    }
  }

  private mapSystem(event: Record<string, unknown>): NormalizedEvent[] {
    if (event.subtype !== 'init') return [];
    const model = typeof event.model === 'string' ? event.model : '';
    return [
      {
        kind: 'status',
        status: 'RUNNING',
        message: model ? `Cursor CLI · ${model} · using the Cursor sign-in on this machine` : 'Cursor CLI · using the Cursor sign-in on this machine',
      },
    ];
  }

  private mapAssistant(event: Record<string, unknown>): NormalizedEvent[] {
    // The three-form dedup rule from Cursor's own staff guidance (see class doc).
    const hasTimestamp = typeof event.timestamp_ms === 'number';
    const hasModelCallId = typeof event.model_call_id === 'string' && event.model_call_id.length > 0;
    if (!hasTimestamp || hasModelCallId) return [];

    const message = event.message as { content?: unknown } | undefined;
    const content = Array.isArray(message?.content) ? message!.content : [];
    const events: NormalizedEvent[] = [];
    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;
      if (b.type === 'text' && typeof b.text === 'string' && b.text.length > 0) {
        events.push({ kind: 'text_delta', text: b.text });
      }
    }
    return events;
  }

  private mapToolCall(event: Record<string, unknown>): NormalizedEvent[] {
    const subtype = event.subtype === 'completed' ? 'completed' : 'started';
    const callId = typeof event.call_id === 'string' ? event.call_id : undefined;
    const toolCall = event.tool_call as Record<string, unknown> | undefined;
    const rawKey = toolCall && typeof toolCall === 'object' ? Object.keys(toolCall)[0] : undefined;
    if (!rawKey) return [];

    const name = humanizeToolCallKey(rawKey);
    const inner = toolCall![rawKey] as Record<string, unknown> | undefined;
    let argsPreview = '';
    try {
      if (inner?.args) argsPreview = JSON.stringify(inner.args).slice(0, 120);
    } catch {
      // non-serializable args — omit the preview
    }

    return [{ kind: 'tool', name, status: subtype, callId, argsPreview }];
  }
}

/** `readToolCall` → `Read`, `runTerminalCmdToolCall` → `RunTerminalCmd`, etc. — best-effort, Cursor hasn't published the full key enumeration. */
function humanizeToolCallKey(key: string): string {
  const stripped = key.replace(/ToolCall$/, '') || key;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
