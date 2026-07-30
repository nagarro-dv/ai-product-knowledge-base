import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..', '..');

/**
 * Persistence for NON-SECRET integration configuration (e.g. the Storybook
 * URL). Secrets never go here — they live in the Keychain-backed stores.
 * Plain JSON file, gitignored, so a connected Storybook survives restarts.
 */
const CONFIG_PATH = path.join(packageRoot, '.integrations.json');

export type IntegrationsConfig = {
  storybook?: { url: string };
  /**
   * The workspace's writable repository connection. See workspace/RepositoryProvider.ts.
   * Non-secret only — the GitHub access token lives in the Keychain-backed store, never here.
   * `null` is a distinct, persisted state from "key absent": it means the user explicitly
   * disconnected, so boot-time restore must NOT fall back to seeding a default repository —
   * only a genuinely unset key (never configured) should do that.
   */
  repository?:
    | { kind: 'local'; path: string }
    | { kind: 'github'; owner: string; repo: string; defaultBranch: string; clonePath: string; htmlUrl: string }
    | null;
  /** Timestamp bookkeeping for the Figma MCP integration. Credentials live in Claude Code's own OAuth store, never here. */
  figma?: { lastConnectedAt?: number };
};

export async function readIntegrationsConfig(): Promise<IntegrationsConfig> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as IntegrationsConfig;
  } catch {
    return {};
  }
}

export async function patchIntegrationsConfig(patch: Partial<IntegrationsConfig>): Promise<void> {
  const current = await readIntegrationsConfig();
  const next: IntegrationsConfig = { ...current, ...patch };
  // Drop keys explicitly set to undefined (disconnect).
  for (const key of Object.keys(next) as (keyof IntegrationsConfig)[]) {
    if (next[key] === undefined) delete next[key];
  }
  if (Object.keys(next).length === 0) {
    await rm(CONFIG_PATH, { force: true });
    return;
  }
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
}
