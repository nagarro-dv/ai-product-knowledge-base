/**
 * Provider-neutral contract for context-source integrations (Jira today;
 * GitHub, Azure DevOps, Linear can follow the same shape later). Deliberately
 * parallel to `providers/types.ts` — that contract answers "which AI runs my
 * work"; this one answers "where does context for that work come from."
 * Keeping them separate interfaces (not a shared union) reflects that they
 * are different product concerns with different UI surfaces.
 */

export type IntegrationConnectionStatus = 'not-connected' | 'connected' | 'error';

export type IntegrationHealth = {
  status: IntegrationConnectionStatus;
  /** Human label for the connected account/site, e.g. a Jira site name. */
  connectedAs?: string;
  /** Site/workspace URL, when applicable. */
  siteUrl?: string;
  error?: string;
};

/** One row in a ticket/issue list (search, recent, assigned-to-me). */
export type TicketSummary = {
  id: string;
  key: string;
  title: string;
  type: string;
  typeIconUrl?: string;
  status: string;
  statusCategory: 'todo' | 'in-progress' | 'done' | 'unknown';
  priority?: string;
  url: string;
};

export type TicketDetail = TicketSummary & {
  description: string;
  descriptionIsEmpty: boolean;
  assignee?: string;
  reporter?: string;
  project: { key: string; name: string };
  labels: string[];
  sprint?: string;
  epic?: string;
  acceptanceCriteria?: string;
  linkedIssues: { key: string; title: string; relationship: string }[];
  comments: { author: string; body: string; createdAt: string }[];
  attachments: { filename: string; sizeBytes: number }[];
};

export type TicketSearchMode = 'search' | 'recent' | 'assigned-to-me';

export interface IntegrationAdapter {
  readonly id: string;
  readonly label: string;

  /** Builds the provider's consent-screen URL for this connect attempt. */
  buildAuthorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string;
  /** Completes the OAuth exchange and persists the resulting credential. */
  completeAuthorization(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<IntegrationHealth>;

  searchTickets(input: { mode: TicketSearchMode; query?: string }): Promise<TicketSummary[]>;
  getTicket(key: string): Promise<TicketDetail>;
}
