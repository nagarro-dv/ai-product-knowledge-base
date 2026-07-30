import { randomBytes } from 'node:crypto';

/**
 * Thin wrapper around GitHub's OAuth Apps web flow and REST API — plain
 * `fetch`, no SDK, matching this codebase's `JiraClient.ts` convention.
 *
 * Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * GitHub's classic OAuth App tokens (unlike Jira's) don't expire and carry no
 * refresh token by default, so — unlike Jira — there is no refresh dance here.
 */

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API_BASE = 'https://api.github.com';

// 'repo' is required for private-repo clone/push/PR creation; GitHub has no
// narrower scope that still covers push access on private repositories.
// 'read:org' lets the picker list organizations the user belongs to.
export const GITHUB_SCOPES = ['repo', 'read:org'];

export type GitHubOAuthConfig = { clientId: string; clientSecret: string };

export type GitHubTokenBundle = {
  accessToken: string;
  scope: string;
  login: string;
  avatarUrl?: string;
};

export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export function buildGitHubAuthorizeUrl(config: GitHubOAuthConfig, input: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: input.redirectUri,
    scope: GITHUB_SCOPES.join(' '),
    state: input.state,
    allow_signup: 'true',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

async function apiRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string } | null;
    throw new GitHubApiError(detail?.message || `GitHub API request failed (${response.status}).`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function exchangeCodeForToken(
  config: GitHubOAuthConfig,
  input: { code: string; redirectUri: string },
): Promise<GitHubTokenBundle> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub token exchange failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const parsed = (await response.json()) as { access_token?: string; scope?: string; error?: string; error_description?: string };
  if (parsed.error) {
    throw new Error(parsed.error_description || `GitHub rejected the authorization (${parsed.error}).`);
  }
  if (!parsed.access_token) {
    throw new Error('GitHub did not return an access token.');
  }
  const user = await apiRequest<{ login: string; avatar_url?: string }>(parsed.access_token, '/user');
  return { accessToken: parsed.access_token, scope: parsed.scope ?? '', login: user.login, avatarUrl: user.avatar_url };
}

export type GitHubOrg = { login: string; avatarUrl?: string };

export async function fetchOrganizations(token: string): Promise<GitHubOrg[]> {
  const orgs = await apiRequest<{ login: string; avatar_url?: string }[]>(token, '/user/orgs?per_page=100');
  return orgs.map((o) => ({ login: o.login, avatarUrl: o.avatar_url }));
}

export type GitHubRepo = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  canPush: boolean;
  updatedAt: string;
};

function toRepo(r: {
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
  permissions?: { push?: boolean };
  updated_at: string;
}): GitHubRepo {
  return {
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    cloneUrl: r.clone_url,
    canPush: r.permissions?.push ?? false,
    updatedAt: r.updated_at,
  };
}

/** `org` omitted lists the authenticated user's own repositories (not org repos). */
export async function fetchRepositories(token: string, input: { org?: string } = {}): Promise<GitHubRepo[]> {
  const path = input.org
    ? `/orgs/${encodeURIComponent(input.org)}/repos?per_page=100&sort=updated`
    : '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator';
  const repos = await apiRequest<Parameters<typeof toRepo>[0][]>(token, path);
  return repos.map(toRepo);
}

export async function fetchRepoDetails(token: string, input: { owner: string; repo: string }): Promise<GitHubRepo> {
  const repo = await apiRequest<Parameters<typeof toRepo>[0]>(token, `/repos/${input.owner}/${input.repo}`);
  return toRepo(repo);
}

export type GitHubBranch = { name: string; protected: boolean };

export async function fetchBranches(token: string, input: { owner: string; repo: string }): Promise<GitHubBranch[]> {
  const branches = await apiRequest<{ name: string; protected: boolean }[]>(
    token,
    `/repos/${input.owner}/${input.repo}/branches?per_page=100`,
  );
  return branches.map((b) => ({ name: b.name, protected: b.protected }));
}

/** Finds an already-open PR for a branch — used when creating one 422s because it already exists. */
export async function fetchPullRequestForBranch(
  token: string,
  input: { owner: string; repo: string; head: string },
): Promise<{ htmlUrl: string; number: number } | null> {
  const prs = await apiRequest<{ html_url: string; number: number }[]>(
    token,
    `/repos/${input.owner}/${input.repo}/pulls?head=${encodeURIComponent(input.head)}&state=open`,
  );
  const first = prs[0];
  return first ? { htmlUrl: first.html_url, number: first.number } : null;
}

export async function createPullRequest(
  token: string,
  input: { owner: string; repo: string; head: string; base: string; title: string; body: string },
): Promise<{ htmlUrl: string; number: number }> {
  const pr = await apiRequest<{ html_url: string; number: number }>(token, `/repos/${input.owner}/${input.repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title: input.title, body: input.body, head: input.head, base: input.base }),
  });
  return { htmlUrl: pr.html_url, number: pr.number };
}
