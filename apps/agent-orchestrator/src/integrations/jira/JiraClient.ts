import { createHash, randomBytes } from 'node:crypto';
import type { IntegrationTokenBundle } from '../store.js';

/**
 * Thin wrapper around Atlassian's OAuth 2.0 (3LO) endpoints and the Jira
 * Cloud REST API v3, accessed through api.atlassian.com per Atlassian's
 * documented pattern for OAuth-authenticated apps (never the site's own
 * *.atlassian.net domain, which is for basic-auth/API-token access instead).
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */

const AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const API_BASE = 'https://api.atlassian.com';

// Classic scopes (Atlassian recommends these over granular scopes where
// available) plus offline_access for refresh tokens. Read-only — this
// integration only ever consumes ticket context, never writes to Jira.
export const JIRA_SCOPES = ['read:jira-work', 'read:jira-user', 'offline_access'];

export type JiraOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export function buildJiraAuthorizeUrl(config: JiraOAuthConfig, input: { state: string; codeChallenge: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: config.clientId,
    scope: JIRA_SCOPES.join(' '),
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: 'code',
    prompt: 'consent',
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
};

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Jira token request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as TokenResponse;
}

type AccessibleResource = { id: string; url: string; name: string; scopes: string[] };

async function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const response = await fetch(`${API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Could not list accessible Jira sites (${response.status}).`);
  return (await response.json()) as AccessibleResource[];
}

export async function exchangeCodeForTokens(
  config: JiraOAuthConfig,
  input: { code: string; codeVerifier: string; redirectUri: string },
): Promise<IntegrationTokenBundle> {
  const token = await requestToken({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  const resources = await fetchAccessibleResources(token.access_token);
  if (resources.length === 0) {
    throw new Error('This Atlassian account has no accessible Jira sites. Grant access to at least one site and try again.');
  }
  // v1: first accessible site. Multi-site switching is a documented future
  // improvement (see PersonalKeyModal-equivalent "Manage" UI pattern).
  const site = resources[0]!;

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    cloudId: site.id,
    siteUrl: site.url,
    siteName: site.name,
  };
}

/** Per Atlassian's rotation requirement, the caller MUST persist the returned bundle (new refresh_token included). */
export async function refreshTokens(config: JiraOAuthConfig, bundle: IntegrationTokenBundle): Promise<IntegrationTokenBundle> {
  if (!bundle.refreshToken) throw new Error('No refresh token stored — reconnect Jira.');
  const token = await requestToken({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: bundle.refreshToken,
  });
  return {
    ...bundle,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? bundle.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
  };
}

export async function revokeTokens(config: JiraOAuthConfig, bundle: IntegrationTokenBundle): Promise<void> {
  // Atlassian's revoke endpoint accepts either token type; revoking the
  // refresh token invalidates the whole grant.
  const target = bundle.refreshToken ?? bundle.accessToken;
  await fetch('https://auth.atlassian.com/oauth/token/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, token: target }),
  }).catch(() => {
    // Best-effort — we delete the local credential regardless.
  });
}

/** Calls the Jira REST API v3 through api.atlassian.com for the given site (cloudId). */
export async function jiraApiRequest<T>(bundle: IntegrationTokenBundle, path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/ex/jira/${bundle.cloudId}${path}`, {
    headers: { Authorization: `Bearer ${bundle.accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Jira API request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}
