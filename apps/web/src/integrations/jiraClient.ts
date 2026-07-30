/** Browser client for the context-source integrations API (Jira today). */

export type IntegrationSummary = {
  id: string;
  label: string;
  configured: boolean;
  /** Figma-specific status values beyond the shared set — absent for other integrations. */
  status: "not-connected" | "needs-auth" | "connected" | "cli-missing" | "network-error" | "error";
  connectedAs?: string;
  siteUrl?: string;
  error?: string;
  /** Storybook-specific fields (absent for other integrations). */
  url?: string;
  componentCount?: number;
  lastIndexedAt?: number;
  projectTitle?: string;
  versionLabel?: string;
  /** Repository-specific fields (absent for other integrations). */
  kind?: "local" | "github" | "gitlab" | "azure-devops";
  path?: string;
  /** Repository-via-GitHub fields (absent for 'local'). */
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  htmlUrl?: string;
  lastSyncedAt?: number | null;
  /** Figma-specific fields (absent for other integrations). */
  mcpUrl?: string;
  loginCommand?: string;
  lastCheckedAt?: number;
  lastConnectedAt?: number;
  lastVerifiedAt?: number;
  account?: { email?: string; team?: string };
  diagnostic?: string;
};

export type JiraTicketSummary = {
  id: string;
  key: string;
  title: string;
  type: string;
  typeIconUrl?: string;
  status: string;
  statusCategory: "todo" | "in-progress" | "done" | "unknown";
  priority?: string;
  url: string;
};

export type JiraTicketDetail = JiraTicketSummary & {
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

export async function fetchIntegrations(init?: { signal?: AbortSignal }): Promise<IntegrationSummary[]> {
  const response = await fetch(`${agentOrigin()}/api/integrations`, { signal: init?.signal });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { integrations?: IntegrationSummary[] };
  return Array.isArray(parsed.integrations) ? parsed.integrations : [];
}

/** sessionStorage key App.tsx reads on return from the Jira OAuth redirect. */
export const JIRA_RETURN_TO_KEY = "ds-jira-return-to";

/**
 * Navigates the whole page to Atlassian's consent screen — this is a redirect
 * flow, not a fetch. Stashes the current location first so the callback can
 * send the user back to wherever they started connecting (e.g. mid-workflow
 * in DS Accelerator) instead of always landing on the Integrations settings page.
 */
export function startJiraConnect(): void {
  try {
    sessionStorage.setItem(JIRA_RETURN_TO_KEY, window.location.pathname + window.location.search);
  } catch {
    // sessionStorage unavailable — the backend's default redirect target still applies.
  }
  window.location.href = `${agentOrigin()}/api/integrations/jira/connect`;
}

export async function disconnectJira(): Promise<void> {
  const response = await fetch(`${agentOrigin()}/api/integrations/jira/disconnect`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}

export async function searchJiraTickets(
  mode: "search" | "recent" | "assigned-to-me",
  query?: string,
  init?: { signal?: AbortSignal },
): Promise<JiraTicketSummary[]> {
  const params = new URLSearchParams({ mode });
  if (query) params.set("q", query);
  const response = await fetch(`${agentOrigin()}/api/integrations/jira/search?${params.toString()}`, {
    signal: init?.signal,
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { tickets?: JiraTicketSummary[] };
  return Array.isArray(parsed.tickets) ? parsed.tickets : [];
}

export async function getJiraTicket(key: string, init?: { signal?: AbortSignal }): Promise<JiraTicketDetail> {
  const response = await fetch(`${agentOrigin()}/api/integrations/jira/tickets/${encodeURIComponent(key)}`, {
    signal: init?.signal,
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { ticket: JiraTicketDetail };
  return parsed.ticket;
}

/** Renders a ticket's context fields into one text block for the AI prompt. */
export function formatJiraTicketContext(ticket: JiraTicketDetail): string {
  const lines = [
    `${ticket.key}: ${ticket.title}`,
    `Type: ${ticket.type} · Status: ${ticket.status}${ticket.priority ? ` · Priority: ${ticket.priority}` : ""}`,
    ticket.project.name ? `Project: ${ticket.project.name}` : "",
    ticket.epic ? `Epic: ${ticket.epic}` : "",
    ticket.sprint ? `Sprint: ${ticket.sprint}` : "",
    ticket.labels.length ? `Labels: ${ticket.labels.join(", ")}` : "",
    ticket.assignee ? `Assignee: ${ticket.assignee}` : "",
    "",
    ticket.descriptionIsEmpty ? "" : `Description:\n${ticket.description}`,
    ticket.acceptanceCriteria ? `\nAcceptance criteria:\n${ticket.acceptanceCriteria}` : "",
    ticket.linkedIssues.length
      ? `\nLinked issues:\n${ticket.linkedIssues.map((l) => `- ${l.relationship} ${l.key}: ${l.title}`).join("\n")}`
      : "",
    ticket.comments.length
      ? `\nRecent comments:\n${ticket.comments.map((c) => `- ${c.author}: ${c.body}`).join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n").trim();
}
