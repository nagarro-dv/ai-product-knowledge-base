import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMcpToolLogEntry, sanitizeForLogging } from './mcp-debug.js';

test('sanitizeForLogging redacts secrets while preserving safe values', () => {
  const input = {
    url: 'https://example.com',
    token: 'abc123',
    headers: { Authorization: 'Bearer secret', 'x-safe': 'ok' },
    nested: { accessToken: 'topsecret', allowed: true },
  };

  const sanitized = sanitizeForLogging(input);

  assert.equal(sanitized.url, 'https://example.com');
  assert.equal(sanitized.token, '[REDACTED]');
  assert.equal(sanitized.headers.Authorization, '[REDACTED]');
  assert.equal(sanitized.headers['x-safe'], 'ok');
  assert.equal(sanitized.nested.accessToken, '[REDACTED]');
  assert.equal(sanitized.nested.allowed, true);
});

test('buildMcpToolLogEntry formats a compact tool event record', () => {
  const entry = buildMcpToolLogEntry({
    server: 'figma',
    toolName: 'get_design_context',
    toolInput: { url: 'https://figma.com/file/abc?node-id=1-2' },
    toolOutput: { ok: true, data: { nodeId: '1-2' } },
    toolUseId: 'toolu_123',
    durationMs: 421,
    permissionDeniedReason: undefined,
  });

  assert.equal(entry.server, 'figma');
  assert.equal(entry.toolName, 'get_design_context');
  assert.equal(entry.toolInput.url, 'https://figma.com/file/abc?node-id=1-2');
  assert.equal(entry.toolOutput.ok, true);
  assert.equal(entry.durationMs, 421);
  assert.equal(entry.permissionDeniedReason, undefined);
});
