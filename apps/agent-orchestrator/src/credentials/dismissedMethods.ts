import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..', '..');

/**
 * Tracks which `local-runtime` auth methods (Claude Code, Cursor CLI) the
 * user has explicitly disconnected from within DS Accelerator.
 *
 * There is no secret to store here — a local-runtime method authenticates by
 * delegating entirely to an external CLI's own sign-in state (its own
 * Keychain entry, outside this app's control; see credentials/store.ts's
 * doc comment on personal API keys for the contrast). "Disconnect" for a
 * method like this can only mean one honest thing: stop treating it as
 * connected in THIS app, without touching the external tool's session —
 * signing the user out of `claude`/`cursor-agent` globally on their machine
 * just because they clicked one button in a settings page would silently
 * break any other, unrelated use of that CLI on the same machine. This file
 * is the plain-JSON record of that in-app-only choice; a 0600 permission
 * file is enough since it holds no secret, just booleans.
 */
const DISMISSED_PATH = path.join(packageRoot, '.dismissed-methods.json');

function methodKey(providerId: string, methodId: string): string {
  return `${providerId}:${methodId}`;
}

async function readDismissed(): Promise<Set<string>> {
  try {
    const raw = await readFile(DISMISSED_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

async function writeDismissed(keys: Set<string>): Promise<void> {
  if (keys.size === 0) {
    await rm(DISMISSED_PATH, { force: true });
    return;
  }
  await writeFile(DISMISSED_PATH, JSON.stringify([...keys], null, 2), 'utf8');
}

export async function isMethodDismissed(providerId: string, methodId: string): Promise<boolean> {
  const keys = await readDismissed();
  return keys.has(methodKey(providerId, methodId));
}

export async function setMethodDismissed(providerId: string, methodId: string, dismissed: boolean): Promise<void> {
  const keys = await readDismissed();
  const key = methodKey(providerId, methodId);
  if (dismissed) keys.add(key);
  else keys.delete(key);
  await writeDismissed(keys);
}
