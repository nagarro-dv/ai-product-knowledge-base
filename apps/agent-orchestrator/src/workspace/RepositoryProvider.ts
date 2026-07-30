import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * The Workspace's writable repository — independent from Storybook.
 *
 * Storybook tells the AI what components exist. It does NOT tell the AI
 * where the source code lives — a connected Storybook may not even be
 * backed by a repository this product has access to (e.g. a public,
 * third-party Storybook). Every place that used to assume "the repo" was a
 * single hardcoded constant now asks this module for the connected
 * repository's resolved working-copy path instead, and gets a clear "not
 * connected" signal when there isn't one.
 *
 * `RepositoryProvider` is intentionally minimal — one method. A future
 * GitHub/GitLab/Azure DevOps provider only has to implement
 * `resolveWorkingCopyPath()` (clone-or-pull, return the local checkout
 * path) for analysis, direction generation, and promote to work with it
 * unchanged; none of those consumers know or care whether the path came
 * from a local folder or a fresh git clone.
 */

export type RepositoryKind = 'local' | 'github' | 'gitlab' | 'azure-devops';

/** Kind-tagged so each provider can surface its own fields (a GitHub connection has an owner/repo/branch; a local one is just a path) without widening what other kinds have to return. */
export type RepositoryDescribe =
  | { kind: 'local'; path: string }
  | {
      kind: 'github';
      path: string;
      owner: string;
      repo: string;
      defaultBranch: string;
      htmlUrl: string;
      lastSyncedAt: number | null;
    };

export type RepositorySummary = {
  id: 'repository';
  label: 'Repository';
  configured: true;
  status: 'connected' | 'not-connected' | 'error';
  kind?: RepositoryKind;
  /** Display-friendly location — an absolute path for 'local', the clone's local path for 'github'. */
  path?: string;
  /** Present only for 'github'. */
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  htmlUrl?: string;
  lastSyncedAt?: number | null;
  error?: string;
};

export interface RepositoryProvider {
  readonly kind: RepositoryKind;
  /** Resolves to an absolute, on-disk path the agent can safely read and write. */
  resolveWorkingCopyPath(): Promise<string>;
  describe(): RepositoryDescribe;
}

/**
 * The only provider implemented today: a path on this machine, connected
 * immediately with no clone/sync step. GitHub/GitLab/Azure DevOps providers
 * will instead clone into a managed local directory on connect and
 * pull-before-run on each use — everything downstream is identical either way.
 */
export class LocalRepositoryProvider implements RepositoryProvider {
  readonly kind = 'local' as const;
  constructor(private readonly absolutePath: string) {}

  async resolveWorkingCopyPath(): Promise<string> {
    return this.absolutePath;
  }

  describe(): RepositoryDescribe {
    return { kind: 'local', path: this.absolutePath };
  }
}

/** Validates a path exists and is a directory before it's ever connected — same validate-before-store discipline as Storybook. Exported for WorkspaceRepository.ts. */
export async function validateLocalPath(rawPathInput: string): Promise<string> {
  const trimmed = rawPathInput.trim();
  if (!trimmed) throw new Error('Enter a repository path first.');
  const absolute = path.resolve(trimmed);
  let stats;
  try {
    stats = await stat(absolute);
  } catch {
    throw new Error(`No folder exists at ${absolute}.`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${absolute} isn't a folder.`);
  }
  return absolute;
}
