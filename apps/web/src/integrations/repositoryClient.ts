/** Browser client for the workspace's Repository connection (see agent-orchestrator server.ts + workspace/WorkspaceRepository.ts). */

export type RepositoryKind = "local" | "github" | "gitlab" | "azure-devops";

export type RepositorySummary = {
  status: "connected" | "not-connected" | "error";
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

/** Clean, no-scheme form of a repository's location for display. */
export function repositoryDisplayLabel(summary: Pick<RepositorySummary, "path"> | null): string {
  if (!summary?.path) return "your repository";
  return summary.path;
}

function agentOrigin(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // ignore
  }
  return response.statusText;
}

/**
 * Every request in this module goes through here so a network failure (the
 * assistant service isn't running, offline, etc.) reads the same everywhere
 * instead of surfacing the browser's raw "Failed to fetch" in one place and a
 * friendly message in another.
 */
async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${agentOrigin()}${path}`, init);
  } catch {
    throw new Error("We couldn't reach the assistant service. Open Settings → AI Models to restart it, then try again.");
  }
}

export async function connectLocalRepository(path: string): Promise<RepositorySummary> {
  const response = await agentFetch("/api/integrations/repository/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: RepositorySummary };
  return parsed.summary;
}

export async function disconnectRepository(): Promise<void> {
  const response = await agentFetch("/api/integrations/repository/disconnect", { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}

export async function recheckRepository(): Promise<RepositorySummary> {
  const response = await agentFetch("/api/integrations/repository/recheck", { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: RepositorySummary };
  return parsed.summary;
}

// ── GitHub ──────────────────────────────────────────────────────────────────

/** sessionStorage key App.tsx reads on return from the GitHub OAuth redirect — same pattern as Jira's. */
export const GITHUB_RETURN_TO_KEY = "ds-github-return-to";

/** Navigates the whole page to GitHub's consent screen — a redirect flow, not a fetch. */
export function startGithubConnect(): void {
  try {
    sessionStorage.setItem(GITHUB_RETURN_TO_KEY, window.location.pathname + window.location.search);
  } catch {
    // sessionStorage unavailable — the backend's default redirect target still applies.
  }
  window.location.href = `${agentOrigin()}/api/integrations/github/connect`;
}

export type GithubIdentity = { configured: boolean; connected: boolean; login: string | null; avatarUrl: string | null };

export async function fetchGithubIdentity(): Promise<GithubIdentity> {
  const response = await agentFetch("/api/integrations/github/status");
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as GithubIdentity;
}

export type GithubOrg = { login: string; avatarUrl?: string };

export async function fetchGithubOrganizations(): Promise<{ organizations: GithubOrg[]; login: string }> {
  const response = await agentFetch("/api/integrations/repository/github/organizations");
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as { organizations: GithubOrg[]; login: string };
}

export type GithubRepo = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  canPush: boolean;
  updatedAt: string;
};

export async function fetchGithubRepositories(org?: string): Promise<GithubRepo[]> {
  const params = org ? `?${new URLSearchParams({ org }).toString()}` : "";
  const response = await agentFetch(`/api/integrations/repository/github/repositories${params}`);
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { repositories: GithubRepo[] };
  return parsed.repositories;
}

export type GithubBranch = { name: string; protected: boolean };

export async function fetchGithubBranches(owner: string, repo: string): Promise<GithubBranch[]> {
  const params = new URLSearchParams({ owner, repo });
  const response = await agentFetch(`/api/integrations/repository/github/branches?${params.toString()}`);
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { branches: GithubBranch[] };
  return parsed.branches;
}

export async function selectGithubRepository(input: { owner: string; repo: string; branch: string }): Promise<RepositorySummary> {
  const response = await agentFetch("/api/integrations/repository/github/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: RepositorySummary };
  return parsed.summary;
}

export type PublishResult = { branch: string; prUrl: string; prNumber: number };

export async function publishToGithub(input: {
  runId: string;
  directionId: string;
  title: string;
  description: string;
}): Promise<PublishResult> {
  const response = await agentFetch("/api/integrations/repository/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as PublishResult;
}
