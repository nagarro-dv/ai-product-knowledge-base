import {
  buildJiraAuthorizeUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  jiraApiRequest,
  refreshTokens,
  revokeTokens,
  type JiraOAuthConfig,
} from './JiraClient.js';
import { adfToPlainText } from './adf.js';
import {
  deleteIntegrationTokens,
  readIntegrationTokens,
  saveIntegrationTokens,
  type IntegrationTokenBundle,
} from '../store.js';
import type { IntegrationAdapter, IntegrationHealth, TicketDetail, TicketSearchMode, TicketSummary } from '../types.js';

const INTEGRATION_ID = 'jira';
// Refresh proactively so a request never races an access token that expires mid-flight.
const REFRESH_SKEW_MS = 60_000;

function statusCategoryOf(key: string | undefined): TicketSummary['statusCategory'] {
  if (key === 'new') return 'todo';
  if (key === 'indeterminate') return 'in-progress';
  if (key === 'done') return 'done';
  return 'unknown';
}

type JiraFieldMeta = { id: string; name: string };
type JiraIssueFields = Record<string, unknown> & {
  summary?: string;
  description?: unknown;
  status?: { name?: string; statusCategory?: { key?: string } };
  priority?: { name?: string };
  issuetype?: { name?: string; iconUrl?: string };
  labels?: string[];
  assignee?: { displayName?: string };
  reporter?: { displayName?: string };
  project?: { key?: string; name?: string };
  issuelinks?: {
    type?: { inward?: string; outward?: string };
    inwardIssue?: { key?: string; fields?: { summary?: string } };
    outwardIssue?: { key?: string; fields?: { summary?: string } };
  }[];
  attachment?: { filename?: string; size?: number }[];
  comment?: { comments?: { author?: { displayName?: string }; body?: unknown; created?: string }[] };
  parent?: { key?: string; fields?: { summary?: string; issuetype?: { name?: string } } };
};

/** Best-effort parse of the legacy Jira "greenhopper" sprint field string shape. */
function parseSprintField(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const last = value[value.length - 1];
  if (last && typeof last === 'object' && 'name' in last) return String((last as { name: unknown }).name);
  if (typeof last === 'string') {
    const match = /name=([^,\]]+)/.exec(last);
    return match?.[1];
  }
  return undefined;
}

export class JiraIntegration implements IntegrationAdapter {
  readonly id = INTEGRATION_ID;
  readonly label = 'Jira';

  private readonly config: JiraOAuthConfig;
  private cachedFieldMeta: JiraFieldMeta[] | null = null;

  constructor(config: JiraOAuthConfig) {
    this.config = config;
  }

  buildAuthorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string {
    return buildJiraAuthorizeUrl(this.config, input);
  }

  async completeAuthorization(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<void> {
    const bundle = await exchangeCodeForTokens(this.config, input);
    await saveIntegrationTokens(this.id, bundle);
  }

  async disconnect(): Promise<void> {
    const bundle = await readIntegrationTokens(this.id);
    if (bundle) await revokeTokens(this.config, bundle);
    await deleteIntegrationTokens(this.id);
  }

  async health(): Promise<IntegrationHealth> {
    const bundle = await readIntegrationTokens(this.id);
    if (!bundle) return { status: 'not-connected' };
    try {
      await this.freshBundle(bundle);
      return { status: 'connected', connectedAs: bundle.siteName, siteUrl: bundle.siteUrl };
    } catch (error) {
      return {
        status: 'error',
        connectedAs: bundle.siteName,
        siteUrl: bundle.siteUrl,
        error: error instanceof Error ? error.message : 'Could not verify the Jira connection.',
      };
    }
  }

  /** Returns a bundle guaranteed to have a non-expired access token, refreshing (and persisting) if needed. */
  private async freshBundle(bundle: IntegrationTokenBundle): Promise<IntegrationTokenBundle> {
    if (bundle.expiresAt - REFRESH_SKEW_MS > Date.now()) return bundle;
    const refreshed = await refreshTokens(this.config, bundle);
    await saveIntegrationTokens(this.id, refreshed);
    return refreshed;
  }

  private async requireBundle(): Promise<IntegrationTokenBundle> {
    const bundle = await readIntegrationTokens(this.id);
    if (!bundle) throw new Error('Jira is not connected.');
    return this.freshBundle(bundle);
  }

  private async fieldMeta(bundle: IntegrationTokenBundle): Promise<JiraFieldMeta[]> {
    if (this.cachedFieldMeta) return this.cachedFieldMeta;
    this.cachedFieldMeta = await jiraApiRequest<JiraFieldMeta[]>(bundle, '/rest/api/3/field');
    return this.cachedFieldMeta;
  }

  private async resolveFieldId(bundle: IntegrationTokenBundle, name: string): Promise<string | undefined> {
    const fields = await this.fieldMeta(bundle);
    return fields.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id;
  }

  async searchTickets(input: { mode: TicketSearchMode; query?: string }): Promise<TicketSummary[]> {
    const bundle = await this.requireBundle();
    let jql: string;
    if (input.mode === 'assigned-to-me') {
      jql = 'assignee = currentUser() ORDER BY updated DESC';
    } else if (input.mode === 'recent') {
      jql = 'lastViewed IS NOT EMPTY ORDER BY lastViewed DESC';
    } else {
      const q = (input.query ?? '').trim();
      if (q.length < 2) return [];
      // Escape double quotes; JQL text search uses the `~` operator.
      const escaped = q.replace(/"/g, '\\"');
      jql = `text ~ "${escaped}*" ORDER BY updated DESC`;
    }

    const result = await this.jqlSearch(bundle, jql, [
      'summary',
      'status',
      'priority',
      'issuetype',
    ]);
    return result.map((issue) => this.toSummary(issue, bundle.siteUrl));
  }

  async getTicket(key: string): Promise<TicketDetail> {
    const bundle = await this.requireBundle();
    const [sprintFieldId, epicLinkFieldId, acceptanceFieldId] = await Promise.all([
      this.resolveFieldId(bundle, 'Sprint'),
      this.resolveFieldId(bundle, 'Epic Link'),
      this.resolveFieldId(bundle, 'Acceptance Criteria'),
    ]);

    const extraFields = [sprintFieldId, epicLinkFieldId, acceptanceFieldId].filter(Boolean).join(',');
    const fieldsParam = [
      'summary',
      'description',
      'status',
      'priority',
      'issuetype',
      'labels',
      'assignee',
      'reporter',
      'project',
      'issuelinks',
      'attachment',
      'comment',
      'parent',
      extraFields,
    ]
      .filter(Boolean)
      .join(',');

    const issue = await jiraApiRequest<{ id: string; key: string; fields: JiraIssueFields }>(
      bundle,
      `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fieldsParam}`,
    );

    const summary = this.toSummary(issue, bundle.siteUrl);
    const f = issue.fields;
    const description = adfToPlainText(f.description);

    const epic =
      f.parent?.fields?.issuetype?.name?.toLowerCase() === 'epic'
        ? f.parent.fields.summary
        : epicLinkFieldId
          ? (f[epicLinkFieldId] as string | undefined)
          : undefined;

    const rawAcceptance = acceptanceFieldId ? f[acceptanceFieldId] : undefined;
    const acceptanceCriteria =
      rawAcceptance && typeof rawAcceptance === 'object'
        ? adfToPlainText(rawAcceptance) || undefined
        : typeof rawAcceptance === 'string'
          ? rawAcceptance
          : undefined;

    return {
      ...summary,
      description,
      descriptionIsEmpty: description.trim().length === 0,
      assignee: f.assignee?.displayName,
      reporter: f.reporter?.displayName,
      project: { key: f.project?.key ?? '', name: f.project?.name ?? '' },
      labels: f.labels ?? [],
      sprint: sprintFieldId ? parseSprintField(f[sprintFieldId]) : undefined,
      epic,
      acceptanceCriteria,
      linkedIssues: (f.issuelinks ?? []).flatMap((link) => {
        const other = link.inwardIssue ?? link.outwardIssue;
        if (!other?.key) return [];
        const relationship = link.inwardIssue ? link.type?.inward : link.type?.outward;
        return [{ key: other.key, title: other.fields?.summary ?? '', relationship: relationship ?? 'relates to' }];
      }),
      comments: (f.comment?.comments ?? []).slice(-5).map((c) => ({
        author: c.author?.displayName ?? 'Unknown',
        body: adfToPlainText(c.body),
        createdAt: c.created ?? '',
      })),
      attachments: (f.attachment ?? []).map((a) => ({ filename: a.filename ?? 'file', sizeBytes: a.size ?? 0 })),
    };
  }

  private async jqlSearch(
    bundle: IntegrationTokenBundle,
    jql: string,
    fields: string[],
  ): Promise<{ id: string; key: string; fields: JiraIssueFields }[]> {
    const response = await fetch(`https://api.atlassian.com/ex/jira/${bundle.cloudId}/rest/api/3/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bundle.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jql, maxResults: 20, fields }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Jira search failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    const parsed = (await response.json()) as { issues?: { id: string; key: string; fields: JiraIssueFields }[] };
    return parsed.issues ?? [];
  }

  private toSummary(issue: { id: string; key: string; fields: JiraIssueFields }, siteUrl: string): TicketSummary {
    const f = issue.fields;
    return {
      id: issue.id,
      key: issue.key,
      title: f.summary ?? '(untitled)',
      type: f.issuetype?.name ?? 'Issue',
      typeIconUrl: f.issuetype?.iconUrl,
      status: f.status?.name ?? 'Unknown',
      statusCategory: statusCategoryOf(f.status?.statusCategory?.key),
      priority: f.priority?.name,
      url: `${siteUrl}/browse/${issue.key}`,
    };
  }
}
