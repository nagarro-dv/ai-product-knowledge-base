import type { McpServerRef } from './providers/types.js';

export const FIGMA_MCP_SERVER_NAME = 'figma';
export const FIGMA_MCP_URL = 'https://mcp.figma.com/mcp';

/**
 * Read/inspect-only tools auto-allowed for runs that wire the given server.
 *
 * Why this exists: `permissionMode: 'acceptEdits'` only auto-approves file
 * edits. MCP tool calls still go through the permission prompt, and a
 * headless SDK run has no UI to answer it — so without an explicit allow
 * rule every Figma call is auto-denied with "Claude requested permissions to
 * use mcp__figma__…, but you haven't granted it yet", which the model then
 * reports as a permissions error and falls back to repo-only analysis.
 *
 * Write-capable Figma tools (create_new_file, upload_assets, generate_figma_design, …)
 * are deliberately NOT listed: an analysis/implementation run must never get
 * blanket write access to the user's Figma account.
 */
export const MCP_ALLOWED_TOOLS: Record<string, readonly string[]> = {
  [FIGMA_MCP_SERVER_NAME]: [
    'mcp__figma__get_design_context',
    'mcp__figma__get_screenshot',
    'mcp__figma__get_metadata',
    'mcp__figma__get_variable_defs',
    'mcp__figma__get_code_connect_map',
    'mcp__figma__whoami',
  ],
};

export function buildRunMcpServers(figmaUrls: readonly string[] | undefined): Record<string, McpServerRef> | undefined {
  const hasFigmaUrls = Array.isArray(figmaUrls) && figmaUrls.some((value) => typeof value === 'string' && value.trim().length > 0);
  if (!hasFigmaUrls) return undefined;

  return {
    [FIGMA_MCP_SERVER_NAME]: {
      type: 'http',
      url: FIGMA_MCP_URL,
    },
  };
}
