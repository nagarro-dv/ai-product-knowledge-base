import { rm } from 'node:fs/promises';
import {
  LocalRepositoryProvider,
  validateLocalPath,
  type RepositoryProvider,
  type RepositorySummary,
} from './RepositoryProvider.js';
import { cloneGitHubRepository, GitHubRepositoryProvider, type GitHubRepoConnection } from './GitHubRepositoryProvider.js';
import { isGitRepository } from './GitClient.js';
import { patchIntegrationsConfig, readIntegrationsConfig } from '../integrations/configStore.js';

/**
 * Owns the single active `RepositoryProvider` for the workspace. Split out of
 * `RepositoryProvider.ts` so this file can depend on every concrete provider
 * (including `GitHubRepositoryProvider`, which itself depends on the
 * `RepositoryProvider` interface) without an import cycle.
 */
export class WorkspaceRepository {
  private provider: RepositoryProvider | null = null;
  private lastError: string | null = null;

  /** Restores a previously connected repository at boot, or seeds the product's own repo as the default. Never throws. */
  async initFromConfig(defaultLocalPath: string): Promise<void> {
    const config = await readIntegrationsConfig();
    const saved = config.repository;
    if (saved === null) {
      // Explicitly disconnected by the user (distinct from "key absent" —
      // see the IntegrationsConfig type). Respect that choice across
      // restarts instead of falling through to the first-run default below,
      // which would otherwise silently reconnect a repository the user
      // deliberately disconnected.
      return;
    }
    if (saved?.kind === 'local') {
      await this.tryConnectLocal(saved.path, { persist: false });
      return;
    }
    if (saved?.kind === 'github') {
      await this.tryRestoreGithub(saved);
      return;
    }
    // First run (repository key was never set at all): the product's own
    // repo is a sensible default writable target (this is, after all, most
    // often what you're working on) — but it's now an explicit, visible,
    // disconnectable connection, not a hardcoded assumption. Persist it so
    // Settings shows it as genuinely connected, not just a runtime fallback.
    await this.tryConnectLocal(defaultLocalPath, { persist: true });
  }

  private async tryConnectLocal(rawPath: string, opts: { persist: boolean }): Promise<void> {
    try {
      const absolute = await validateLocalPath(rawPath);
      this.provider = new LocalRepositoryProvider(absolute);
      this.lastError = null;
      if (opts.persist) await patchIntegrationsConfig({ repository: { kind: 'local', path: absolute } });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Could not connect the repository.';
    }
  }

  private async tryRestoreGithub(saved: {
    kind: 'github';
    owner: string;
    repo: string;
    defaultBranch: string;
    clonePath: string;
    htmlUrl: string;
  }): Promise<void> {
    if (!(await isGitRepository(saved.clonePath))) {
      this.provider = null;
      this.lastError = `The local clone at ${saved.clonePath} is missing. Reconnect this repository.`;
      return;
    }
    this.provider = new GitHubRepositoryProvider(saved);
    this.lastError = null;
  }

  /** Validate-before-store: the path is only persisted once confirmed to exist. */
  async connectLocal(rawPath: string): Promise<RepositorySummary> {
    const absolute = await validateLocalPath(rawPath);
    this.provider = new LocalRepositoryProvider(absolute);
    this.lastError = null;
    await patchIntegrationsConfig({ repository: { kind: 'local', path: absolute } });
    return this.summary();
  }

  /** Clones the chosen repo/branch into a managed directory and connects it. Replaces whatever was connected before, local or GitHub. */
  async connectGithub(input: { owner: string; repo: string; branch: string; destinationRoot: string }): Promise<RepositorySummary> {
    const connection = await cloneGitHubRepository(input);
    this.provider = new GitHubRepositoryProvider(connection);
    this.lastError = null;
    await patchIntegrationsConfig({ repository: { kind: 'github', ...connection } });
    return this.summary();
  }

  /** Re-confirms the connection is still reachable — the repository equivalent of Storybook's re-index. */
  async recheck(): Promise<RepositorySummary> {
    if (!this.provider) throw new Error('No repository is connected.');
    if (this.provider.kind === 'local') {
      const { path: currentPath } = this.provider.describe();
      try {
        await validateLocalPath(currentPath);
        this.lastError = null;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Could not reach that path.';
        throw error;
      }
      return this.summary();
    }
    // GitHub: a fresh resolveWorkingCopyPath() fetches + re-syncs the default branch,
    // which is exactly "confirm this connection still works" for a clone.
    try {
      await this.provider.resolveWorkingCopyPath();
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Could not sync this repository.';
      throw error;
    }
    return this.summary();
  }

  async disconnect(): Promise<void> {
    if (this.provider?.kind === 'github') {
      const { path: clonePath } = this.provider.describe();
      await rm(clonePath, { recursive: true, force: true }).catch(() => {
        // best-effort — an orphaned clone directory isn't harmful, just untidy
      });
    }
    this.provider = null;
    this.lastError = null;
    // Persist `null`, not `undefined` — `undefined` deletes the key, which
    // reads at boot as "never configured" and would re-seed the default
    // repository (see initFromConfig). `null` durably records "user chose
    // to disconnect."
    await patchIntegrationsConfig({ repository: null });
  }

  isConnected(): boolean {
    return this.provider !== null && !this.lastError;
  }

  /** Throws with a clear message when nothing is connected — every write-path caller relies on this never silently falling back. */
  async resolveWorkingCopyPath(): Promise<string> {
    if (!this.provider) {
      throw new Error(
        "This workspace doesn't have a writable source repository connected yet. Connect a repository before implementing changes.",
      );
    }
    return this.provider.resolveWorkingCopyPath();
  }

  /**
   * The write path: called only right before the promote route copies files
   * in. For local repositories this is identical to `resolveWorkingCopyPath`.
   * For GitHub it additionally checks out an isolated per-run branch first,
   * so writes never land on the default branch's working tree.
   */
  async prepareForWrite(runId: string, directionId: string): Promise<{ path: string; branch: string | null }> {
    if (!this.provider) {
      throw new Error(
        "This workspace doesn't have a writable source repository connected yet. Connect a repository before implementing changes.",
      );
    }
    let branch: string | null = null;
    if (this.provider instanceof GitHubRepositoryProvider) {
      branch = await this.provider.ensureRunBranch(runId, directionId);
    }
    const path = await this.provider.resolveWorkingCopyPath();
    return { path, branch };
  }

  /** Commits, pushes, and opens a PR for a direction already written to its run branch via `prepareForWrite`. GitHub-only. */
  async publish(input: {
    runId: string;
    directionId: string;
    commitMessage: string;
    prTitle: string;
    prBody: string;
  }): Promise<{ branch: string; prUrl: string; prNumber: number }> {
    if (!(this.provider instanceof GitHubRepositoryProvider)) {
      throw new Error('Publish to GitHub is only available when a GitHub repository is connected.');
    }
    return this.provider.publish(input);
  }

  summary(): RepositorySummary {
    if (!this.provider) {
      if (this.lastError) {
        return { id: 'repository', label: 'Repository', configured: true, status: 'error', error: this.lastError };
      }
      return { id: 'repository', label: 'Repository', configured: true, status: 'not-connected' };
    }
    const describe = this.provider.describe();
    return {
      id: 'repository',
      label: 'Repository',
      configured: true,
      status: this.lastError ? 'error' : 'connected',
      ...describe,
      ...(this.lastError && { error: this.lastError }),
    };
  }
}

export type { GitHubRepoConnection };
