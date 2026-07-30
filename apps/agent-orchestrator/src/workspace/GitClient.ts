import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Thin wrapper over the system `git` binary — no `simple-git`/`isomorphic-git`
 * dependency, matching this codebase's existing convention of shelling out via
 * `execFile` for OS-level operations (see `credentials/store.ts`'s use of the
 * `security` binary for the macOS Keychain).
 *
 * Auth is passed per-call via a transient `-c http.extraHeader=...` flag, never
 * written into the clone's `.git/config` or a remote URL — so a token never
 * persists on disk and never shows up in `git remote -v`.
 */

export class GitCommandError extends Error {
  constructor(message: string, readonly command: string[]) {
    super(message);
    this.name = 'GitCommandError';
  }
}

export type GitAuth = { token: string };

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join('***');
  }
  return out;
}

function authHeaderArgs(auth: GitAuth): string[] {
  const basic = Buffer.from(`x-access-token:${auth.token}`).toString('base64');
  return ['-c', `http.extraHeader=AUTHORIZATION: basic ${basic}`];
}

async function run(args: string[], opts: { cwd?: string; secrets?: string[] } = {}): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: opts.cwd,
      maxBuffer: 1024 * 1024 * 32,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return stdout.trim();
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr: unknown }).stderr) : '';
    const message = stderr.trim() || (error instanceof Error ? error.message : String(error));
    const secrets = opts.secrets ?? [];
    const authArgIndex = args.findIndex((a) => a.startsWith('http.extraHeader='));
    const redactedCommand = args.map((a, i) => (i === authArgIndex ? 'http.extraHeader=***' : a));
    throw new GitCommandError(redact(message, secrets), redactedCommand);
  }
}

export async function isGitRepository(dir: string): Promise<boolean> {
  try {
    await access(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

export async function cloneRepository(input: {
  httpsUrl: string;
  branch: string;
  destination: string;
  auth: GitAuth;
}): Promise<void> {
  await run(
    [...authHeaderArgs(input.auth), 'clone', '--branch', input.branch, '--single-branch', input.httpsUrl, input.destination],
    { secrets: [input.auth.token] },
  );
}

export async function fetchOrigin(input: { cwd: string; branch: string; auth: GitAuth }): Promise<void> {
  await run([...authHeaderArgs(input.auth), 'fetch', 'origin', input.branch], { cwd: input.cwd, secrets: [input.auth.token] });
}

/** Checks out `branch` and hard-resets it to match `origin/<branch>` — used only on the default branch, which this product never writes to directly. */
export async function syncBranchToRemote(input: { cwd: string; branch: string }): Promise<void> {
  await run(['checkout', input.branch], { cwd: input.cwd });
  await run(['reset', '--hard', `origin/${input.branch}`], { cwd: input.cwd });
}

export async function createLocalBranch(input: { cwd: string; branch: string }): Promise<void> {
  await run(['checkout', '-b', input.branch], { cwd: input.cwd });
}

export async function branchExistsLocally(input: { cwd: string; branch: string }): Promise<boolean> {
  try {
    await run(['rev-parse', '--verify', input.branch], { cwd: input.cwd });
    return true;
  } catch {
    return false;
  }
}

export async function checkoutLocalBranch(input: { cwd: string; branch: string }): Promise<void> {
  await run(['checkout', input.branch], { cwd: input.cwd });
}

export async function currentBranch(input: { cwd: string }): Promise<string> {
  return run(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: input.cwd });
}

export async function isWorkingTreeDirty(input: { cwd: string }): Promise<boolean> {
  const out = await run(['status', '--porcelain'], { cwd: input.cwd });
  return out.length > 0;
}

const BOT_IDENTITY = ['-c', 'user.name=DS Accelerator', '-c', 'user.email=ds-accelerator@local'];

/** Stages everything and commits — a no-op (not an error) when there's nothing to commit. */
export async function commitAll(input: { cwd: string; message: string }): Promise<{ committed: boolean }> {
  await run(['add', '-A'], { cwd: input.cwd });
  const staged = await run(['diff', '--cached', '--name-only'], { cwd: input.cwd });
  if (!staged) return { committed: false };
  await run([...BOT_IDENTITY, 'commit', '-m', input.message], { cwd: input.cwd });
  return { committed: true };
}

export async function pushBranch(input: { cwd: string; branch: string; auth: GitAuth }): Promise<void> {
  await run([...authHeaderArgs(input.auth), 'push', '-u', 'origin', `HEAD:refs/heads/${input.branch}`], {
    cwd: input.cwd,
    secrets: [input.auth.token],
  });
}
