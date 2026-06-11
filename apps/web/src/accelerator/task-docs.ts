import type { AnalysisTask } from "./types";

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

export type TaskSolutionDoc = {
  id: string;
  title: string;
  lead: string;
  taskFolder: string;
};

const EXAMPLE_SOLUTIONS: TaskSolutionDoc[] = [
  {
    id: "solution-a",
    title: "Solution A — Status-first hierarchy",
    lead: "Lead with the status badge and plain-language summary; demote the numeric score so the actionable insight reads first.",
    taskFolder: "ds-042-credit-score-clarity",
  },
  {
    id: "solution-b",
    title: "Solution B — Context band under the arc",
    lead: "Add a short explanatory band beneath the gauge with trend + one-line guidance, without increasing card height on mobile.",
    taskFolder: "ds-042-credit-score-clarity",
  },
  {
    id: "solution-c",
    title: "Solution C — Compact dashboard tile",
    lead: "Shrink the arc, emphasize trend direction and a single secondary action link for users who need detail.",
    taskFolder: "ds-042-credit-score-clarity",
  },
];

export function getSolutionsForTaskFolder(taskFolder: string): TaskSolutionDoc[] {
  return EXAMPLE_SOLUTIONS.filter((doc) => doc.taskFolder === taskFolder);
}

export function solutionsToAnalysisTasks(docs: TaskSolutionDoc[]): AnalysisTask[] {
  return docs.map((doc) => ({
    id: doc.id,
    label: doc.title,
    description: doc.lead,
    active: true,
  }));
}
