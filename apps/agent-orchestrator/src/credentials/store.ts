import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..', '..');

/**
 * Personal API key storage.
 *
 * Secrets live in the macOS Keychain (encrypted at rest by the OS, scoped to
 * the logged-in user) — the same mechanism Claude Code itself uses for its
 * credentials. On other platforms we fall back to a 0600-permission JSON file
 * and log a warning, because encrypting a file with a key stored on the same
 * disk would be security theater rather than security.
 *
 * A separate metadata file stores only non-secrets (provider id, the key's
 * last 4 characters, timestamp) so the UI can render "key ending ····abc4"
 * without any code path ever reading the secret for display. Secrets are
 * write-only from the API's perspective: stored, used server-side, deletable —
 * never returned.
 */
const KEYCHAIN_SERVICE = 'ds-accelerator-personal-keys';
const META_PATH = path.join(packageRoot, '.credentials-meta.json');
const FALLBACK_SECRETS_PATH = path.join(packageRoot, '.credentials.json');

const isMac = process.platform === 'darwin';

export type PersonalKeyMeta = {
  providerId: string;
  /** Last 4 characters of the key — safe to show, standard SaaS practice. */
  keyEndingIn: string;
  savedAt: number;
};

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
  await chmod(filePath, 0o600);
}

async function readMeta(): Promise<Record<string, PersonalKeyMeta>> {
  return (await readJsonFile<Record<string, PersonalKeyMeta>>(META_PATH)) ?? {};
}

export async function listPersonalKeyMeta(): Promise<Record<string, PersonalKeyMeta>> {
  return readMeta();
}

export async function savePersonalKey(providerId: string, secret: string): Promise<void> {
  if (isMac) {
    // -U updates in place when the item already exists.
    await execFileAsync('security', [
      'add-generic-password',
      '-U',
      '-s',
      KEYCHAIN_SERVICE,
      '-a',
      providerId,
      '-w',
      secret,
    ]);
  } else {
    console.warn(
      '[credentials] No OS keychain on this platform — storing the key in a permission-restricted file instead.',
    );
    const secrets = (await readJsonFile<Record<string, string>>(FALLBACK_SECRETS_PATH)) ?? {};
    secrets[providerId] = secret;
    await writeJsonFile(FALLBACK_SECRETS_PATH, secrets);
  }

  const meta = await readMeta();
  meta[providerId] = {
    providerId,
    keyEndingIn: secret.slice(-4),
    savedAt: Date.now(),
  };
  await writeJsonFile(META_PATH, meta);
}

/** Server-side use only (adapter construction). Never expose through the API. */
export async function readPersonalKey(providerId: string): Promise<string | null> {
  if (isMac) {
    try {
      const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-s',
        KEYCHAIN_SERVICE,
        '-a',
        providerId,
        '-w',
      ]);
      const secret = stdout.trim();
      return secret || null;
    } catch {
      return null;
    }
  }
  const secrets = await readJsonFile<Record<string, string>>(FALLBACK_SECRETS_PATH);
  return secrets?.[providerId] ?? null;
}

export async function deletePersonalKey(providerId: string): Promise<void> {
  if (isMac) {
    try {
      await execFileAsync('security', ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', providerId]);
    } catch {
      // Item already absent — deleting is idempotent.
    }
  } else {
    const secrets = (await readJsonFile<Record<string, string>>(FALLBACK_SECRETS_PATH)) ?? {};
    delete secrets[providerId];
    if (Object.keys(secrets).length === 0) {
      await rm(FALLBACK_SECRETS_PATH, { force: true });
    } else {
      await writeJsonFile(FALLBACK_SECRETS_PATH, secrets);
    }
  }

  const meta = await readMeta();
  delete meta[providerId];
  if (Object.keys(meta).length === 0) {
    await rm(META_PATH, { force: true });
  } else {
    await writeJsonFile(META_PATH, meta);
  }
}
