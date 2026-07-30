/** Known task folders under docs/tasks/ — extend as you add real tickets. */
export const KNOWN_TASK_FOLDERS = new Set(["ds-042-credit-score-clarity"]);

export function extractTicketKey(input: string): string | null {
  const match = input.trim().match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
  return match ? match[1]!.toUpperCase() : null;
}

export function resolveTaskFolder(ticketKey: string | null): { found: boolean; taskFolder: string | null } {
  if (!ticketKey) return { found: false, taskFolder: null };
  const key = ticketKey.toUpperCase();
  if (key === "DS-042") {
    return { found: true, taskFolder: "ds-042-credit-score-clarity" };
  }
  const taskFolder = ticketKey.toLowerCase();
  if (KNOWN_TASK_FOLDERS.has(taskFolder)) {
    return { found: true, taskFolder };
  }
  return { found: false, taskFolder: null };
}

