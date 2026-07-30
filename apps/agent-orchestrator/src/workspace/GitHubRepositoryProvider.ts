import { rm } from 'node:fs/promises';
import path from 'node:path';
import {
  branchExistsLocally,
  checkoutLocalBranch,
  cloneRepository,
  commitAll,
  createLocalBranch,
  fetchOrigin,
  isGitRepository,
  pushBranch,
  syncBranchToRemote,
} from './GitClient.js';
import type { RepositoryDescribe, RepositoryProvider } from './RepositoryProvider.js';
import {
  createPullRequest,
  fetchPullRequestForBranch,
  fetchRepoDetails,
  GitHubApiError,
  type GitHubTokenBundle,
} from '../integrations/github/GitHubClient.js';
import { readIntegrationTokens } from '../integrations/store.js';

export const GITHUB_INTEGRATION_ID = 'github';

export type GitHubRepoConnection = {
  owner: string;
  repo: string;
  /** The base branch this connection tracks — usually but not necessarily GitHub's own "default branch". */
  defaultBranch: string;
  clonePath: string;
  htmlUrl: string;
};

const DEFAULT_SYNC_THROTTLE_MS = 60_000;

/**
 * A GitHub-backed repository. `resolveWorkingCopyPath()` keeps the same
 * one-method contract as `LocalRepositoryProvider` — every read-only consumer
 * (analysis, directions generation context) just gets a path, unaware it's a
 * synced clone rather than a folder someone pointed at directly.
 *
 * Real writes only ever happen through `ensureRunBranch` + the deterministic
 * promote step (copies specific declared files, same as the local provider) —
 * directions-generation itself writes to the staging area, never here. So the
 * default branch's working tree is never dirtied; every write lands on an
 * isolated `ds-accelerator/<run>-<direction>` branch, never pushed until the
 * user explicitly publishes.
 */
export class GitHubRepositoryProvider implements RepositoryProvider {
  readonly kind = 'github' as const;
  private lastSyncedAt: number | null = null;

  constructor(private readonly connection: GitHubRepoConnection) {}

  private async requireToken(): Promise<GitHubTokenBundle> {
    const bundle = await readIntegrationTokens<GitHubTokenBundle>(GITHUB_INTEGRATION_ID);
    if (!bundle) throw new Error('GitHub is not connected. Reconnect it from Settings → Workspace.');
    return bundle;
  }

  private branchNameFor(runId: string, directionId: string): string {
    const safeRun = runId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'run';
    const safeDirection = directionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'direction';
    return `ds-accelerator/${safeRun}-${safeDirection}`;
  }

  /** Read-only consumers (analysis, context for directions generation) just want an up-to-date checkout of the base branch. */
  async resolveWorkingCopyPath(): Promise<string> {
    const stale = !this.lastSyncedAt || Date.now() - this.lastSyncedAt > DEFAULT_SYNC_THROTTLE_MS;
    if (stale) {
      const token = await this.requireToken();
      await fetchOrigin({ cwd: this.connection.clonePath, branch: this.connection.defaultBranch, auth: { token: token.accessToken } });
      await syncBranchToRemote({ cwd: this.connection.clonePath, branch: this.connection.defaultBranch });
      this.lastSyncedAt = Date.now();
    }
    return this.connection.clonePath;
  }

  /**
   * Called only from the promote route, right before it copies files in.
   * Deterministic branch name from (runId, directionId) — no in-memory "current
   * run" state, so this survives a server restart between Apply and Publish.
   */
  async ensureRunBranch(runId: string, directionId: string): Promise<string> {
    const branch = this.branchNameFor(runId, directionId);
    const token = await this.requireToken();
    await fetchOrigin({ cwd: this.connection.clonePath, branch: this.connection.defaultBranch, auth: { token: token.accessToken } });
    const exists = await branchExistsLocally({ cwd: this.connection.clonePath, branch });
    if (exists) {
      await checkoutLocalBranch({ cwd: this.connection.clonePath, branch });
    } else {
      await syncBranchToRemote({ cwd: this.connection.clonePath, branch: this.connection.defaultBranch });
      await createLocalBranch({ cwd: this.connection.clonePath, branch });
    }
    this.lastSyncedAt = Date.now();
    return branch;
  }

  /** Commits whatever Apply already wrote on this run's branch, pushes it, and opens (or reuses) a PR. Never touches the default branch. */
  async publish(input: { runId: string; directionId: string; commitMessage: string; prTitle: string; prBody: string }): Promise<{
    branch: string;
    prUrl: string;
    prNumber: number;
  }> {
    const branch = this.branchNameFor(input.runId, input.directionId);
    const exists = await branchExistsLocally({ cwd: this.connection.clonePath, branch });
    if (!exists) {
      throw new Error('Apply this direction before publishing it to GitHub.');
    }
    await checkoutLocalBranch({ cwd: this.connection.clonePath, branch });
    const token = await this.requireToken();
    await commitAll({ cwd: this.connection.clonePath, message: input.commitMessage });
    await pushBranch({ cwd: this.connection.clonePath, branch, auth: { token: token.accessToken } });

    try {
      const pr = await createPullRequest(token.accessToken, {
        owner: this.connection.owner,
        repo: this.connection.repo,
        head: branch,
        base: this.connection.defaultBranch,
        title: input.prTitle,
        body: input.prBody,
      });
      return { branch, prUrl: pr.htmlUrl, prNumber: pr.number };
    } catch (error) {
      // A PR already exists for this branch (e.g. publishing again after more
      // edits) — GitHub reports this as a 422, not a special "already exists"
      // response shape, so we re-fetch and treat it as success.
      if (error instanceof GitHubApiError && error.status === 422) {
        const existing = await fetchPullRequestForBranch(token.accessToken, {
          owner: this.connection.owner,
          repo: this.connection.repo,
          head: `${this.connection.owner}:${branch}`,
        });
        if (existing) return { branch, prUrl: existing.htmlUrl, prNumber: existing.number };
      }
      throw error;
    }
  }

  describe(): RepositoryDescribe {
    return {
      kind: 'github',
      path: this.connection.clonePath,
      owner: this.connection.owner,
      repo: this.connection.repo,
      defaultBranch: this.connection.defaultBranch,
      htmlUrl: this.connection.htmlUrl,
      lastSyncedAt: this.lastSyncedAt,
    };
  }
}

/** Validates push access, clones fresh (replacing any stale prior clone at the same path), and returns the resulting connection. */
export async function cloneGitHubRepository(input: {
  owner: string;
  repo: string;
  branch: string;
  destinationRoot: string;
}): Promise<GitHubRepoConnection> {
  const token = await readIntegrationTokens<GitHubTokenBundle>(GITHUB_INTEGRATION_ID);
  if (!token) throw new Error('Connect GitHub first.');

  const details = await fetchRepoDetails(token.accessToken, { owner: input.owner, repo: input.repo }).catch((error) => {
    if (error instanceof GitHubApiError && error.status === 404) {
      throw new Error(`Repository ${input.owner}/${input.repo} wasn't found, or you don't have access to it.`);
    }
    throw error;
  });
  if (!details.canPush) {
    throw new Error(`You don't have write access to ${details.fullName}. Choose a repository you can push to.`);
  }

  const clonePath = path.join(input.destinationRoot, `${input.owner}__${input.repo}`);
  if (await isGitRepository(clonePath)) {
    await rm(clonePath, { recursive: true, force: true });
  }
  await cloneRepository({
    httpsUrl: details.cloneUrl,
    branch: input.branch,
    destination: clonePath,
    auth: { token: token.accessToken },
  });

  return { owner: input.owner, repo: input.repo, defaultBranch: input.branch, clonePath, htmlUrl: details.htmlUrl };
}
