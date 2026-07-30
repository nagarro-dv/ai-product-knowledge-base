import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..', '..');

/**
 * OAuth credential storage for context-source integrations. Same mechanism
 * as `credentials/store.ts` (macOS Keychain, file fallback elsewhere) under a
 * separate Keychain service so integration tokens and personal AI-provider
 * keys never share a namespace.
 */
const KEYCHAIN_SERVICE = 'ds-accelerator-integrations';
const FALLBACK_SECRETS_PATH = path.join(packageRoot, '.integration-tokens.json');

const isMac = process.platform === 'darwin';

export type IntegrationTokenBundle = {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  scope: string;
  cloudId: string;
  siteUrl: string;
  siteName: string;
};

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
  await chmod(filePath, 0o600);
}

/** Generic over the bundle shape so integrations with different token shapes (Jira vs GitHub) share one store. */
export async function saveIntegrationTokens<T>(integrationId: string, tokens: T): Promise<void> {
  const payload = JSON.stringify(tokens);
  if (isMac) {
    await execFileAsync('security', ['add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', integrationId, '-w', payload]);
  } else {
    const all = (await readJsonFile<Record<string, T>>(FALLBACK_SECRETS_PATH)) ?? {};
    all[integrationId] = tokens;
    await writeJsonFile(FALLBACK_SECRETS_PATH, all);
  }
}

export async function readIntegrationTokens<T = IntegrationTokenBundle>(integrationId: string): Promise<T | null> {
  if (isMac) {
    try {
      const { stdout } = await execFileAsync('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', integrationId, '-w']);
      const raw = stdout.trim();
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  const all = await readJsonFile<Record<string, T>>(FALLBACK_SECRETS_PATH);
  return all?.[integrationId] ?? null;
}

export async function deleteIntegrationTokens(integrationId: string): Promise<void> {
  if (isMac) {
    try {
      await execFileAsync('security', ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', integrationId]);
    } catch {
      // already absent
    }
  } else {
    const all = (await readJsonFile<Record<string, IntegrationTokenBundle>>(FALLBACK_SECRETS_PATH)) ?? {};
    delete all[integrationId];
    if (Object.keys(all).length === 0) await rm(FALLBACK_SECRETS_PATH, { force: true });
    else await writeJsonFile(FALLBACK_SECRETS_PATH, all);
  }
}

/**
 * Short-lived, in-memory record of an OAuth attempt in progress: the PKCE
 * verifier for this `state`, so the callback can complete the exchange
 * without trusting anything the browser sends except the opaque state value.
 * Single-use and expires after 10 minutes to bound the CSRF window.
 */
const pendingAuthorizations = new Map<string, { codeVerifier: string; expiresAt: number }>();

export function createPendingAuthorization(state: string, codeVerifier: string): void {
  pendingAuthorizations.set(state, { codeVerifier, expiresAt: Date.now() + 10 * 60_000 });
}

export function consumePendingAuthorization(state: string): { codeVerifier: string } | null {
  const entry = pendingAuthorizations.get(state);
  pendingAuthorizations.delete(state); // single-use regardless of outcome
  if (!entry || entry.expiresAt < Date.now()) return null;
  return { codeVerifier: entry.codeVerifier };
}
