import type { HookEvent } from '@anthropic-ai/claude-agent-sdk';

export type McpToolLogEntry = {
  timestamp: string;
  server: string;
  toolName: string;
  toolUseId?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  permissionDeniedReason?: string;
  durationMs?: number;
  event: 'pre' | 'post' | 'permission-denied' | 'failure';
};

const SENSITIVE_KEYS = new Set([
  'authorization',
  'auth',
  'apikey',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'password',
  'cookie',
  'session',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeForLogging(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLogging(entry));
  }
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = sanitizeForLogging(child);
  }
  return result;
}

export function buildMcpToolLogEntry(input: {
  server: string;
  toolName: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  toolUseId?: string;
  durationMs?: number;
  permissionDeniedReason?: string;
  event: McpToolLogEntry['event'];
}): McpToolLogEntry {
  return {
    timestamp: new Date().toISOString(),
    server: input.server,
    toolName: input.toolName,
    toolUseId: input.toolUseId,
    toolInput: sanitizeForLogging(input.toolInput),
    toolOutput: sanitizeForLogging(input.toolOutput),
    permissionDeniedReason: input.permissionDeniedReason,
    durationMs: input.durationMs,
    event: input.event,
  };
}

export function createMcpDebugLogger(enabled: boolean, sink: (entry: McpToolLogEntry) => void) {
  if (!enabled) {
    return () => {};
  }

  return (entry: McpToolLogEntry) => {
    sink(entry);
  };
}

export function isMcpToolEvent(eventName: HookEvent | string): boolean {
  return ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionDenied', 'PostToolBatch'].includes(eventName);
}
