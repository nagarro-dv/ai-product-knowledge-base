import type { IntegrationAdapter, IntegrationHealth, TicketDetail, TicketSearchMode, TicketSummary } from '../types.js';
import { DEMO_TICKETS } from '../../demo/fixtures.js';

function toSummary(ticket: TicketDetail): TicketSummary {
  const { id, key, title, type, typeIconUrl, status, statusCategory, priority, url } = ticket;
  return { id, key, title, type, typeIconUrl, status, statusCategory, priority, url };
}

/**
 * DEMO_MODE stand-in for JiraIntegration — same IntegrationAdapter contract,
 * backed by DEMO_TICKETS instead of a real Atlassian OAuth connection. Lets
 * JiraTicketPicker.tsx show a real search dropdown with fake tickets instead
 * of requiring an exact typed key.
 */
export class DemoJiraIntegration implements IntegrationAdapter {
  readonly id = 'jira';
  readonly label = 'Jira';

  buildAuthorizeUrl(): string {
    throw new Error('Jira is already connected in demo mode — no authorization needed.');
  }

  async completeAuthorization(): Promise<void> {
    throw new Error('Jira is already connected in demo mode — no authorization needed.');
  }

  async disconnect(): Promise<void> {
    // No-op: the demo Jira connection isn't a real credential to revoke.
  }

  async health(): Promise<IntegrationHealth> {
    return { status: 'connected', connectedAs: 'Demo workspace', siteUrl: 'https://demo.atlassian.net' };
  }

  async searchTickets(input: { mode: TicketSearchMode; query?: string }): Promise<TicketSummary[]> {
    const q = input.query?.trim().toLowerCase() ?? '';
    if (!q) return DEMO_TICKETS.map(toSummary);
    return DEMO_TICKETS.filter(
      (ticket) => ticket.key.toLowerCase().includes(q) || ticket.title.toLowerCase().includes(q),
    ).map(toSummary);
  }

  async getTicket(key: string): Promise<TicketDetail> {
    const ticket = DEMO_TICKETS.find((entry) => entry.key.toLowerCase() === key.trim().toLowerCase());
    if (!ticket) throw new Error(`No demo ticket found for '${key}'.`);
    return ticket;
  }
}
