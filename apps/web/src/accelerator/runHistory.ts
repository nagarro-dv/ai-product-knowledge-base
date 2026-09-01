import type { AcceleratorMode } from "@ds-starter/standards";
import type { SourceEntry } from "./types";

/**
 * A personal, local-only recent-runs log — there is no backend database, jobs
 * live in an in-memory Map on the agent orchestrator and are gone on restart.
 * This is honest about that: it stores what you asked for, not a replay of
 * generated code. "Restore" repopulates the intake, it doesn't reopen a
 * job that may no longer exist.
 */
export type RunHistoryOutcome = "applied" | "stopped" | "error";

export type RunHistoryEntry = {
  id: string;
  savedAt: number;
  outcome: RunHistoryOutcome;
  targetLabel: string;
  contextSummary: string;
  baseContext: string;
  sources: SourceEntry[];
  directionTitles: string[];
  appliedFilePaths: string[];
  /** Display label of the AI engine used for the run (e.g. "Claude"). Absent on entries saved before this was tracked. */
  provider?: string;
  /** Which mode this run was. Absent (null) on entries saved before modes existed — restoreFromHistory defaults those to "improve" rather than guessing. */
  mode?: AcceleratorMode | null;
};

const HISTORY_KEY = "ds-accelerator-history";
const MAX_ENTRIES = 20;

export function readHistory(): RunHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RunHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendHistory(entry: Omit<RunHistoryEntry, "id" | "savedAt">): void {
  try {
    const current = readHistory();
    const next: RunHistoryEntry = {
      ...entry,
      id: `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      savedAt: Date.now(),
    };
    const trimmed = [next, ...current].slice(0, MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable (private mode, quota) — history just won't persist.
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function summarizeContext(baseContext: string, directionTitles: string[]): string {
  const trimmed = baseContext.trim();
  if (trimmed) return trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed;
  if (directionTitles.length > 0) return directionTitles.join(", ");
  return "No description given";
}
