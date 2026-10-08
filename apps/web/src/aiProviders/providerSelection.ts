import type { AgentProvider } from "../agentSseClient";

/**
 * Remembers which AI engine a user picked, per product, across reloads and
 * product switches. Only an explicit pick is saved — never the automatic
 * fallback — so a choice survives a session where that engine was briefly
 * unavailable (e.g. a machine running in DEMO_MODE, where Demo is the only
 * connected engine).
 */
const STORAGE_KEY = "ds-starter:selected-provider";

type SelectionMap = Record<string, string>;

function readAll(): SelectionMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SelectionMap) : {};
  } catch {
    return {};
  }
}

export function saveSelectedProvider(scope: string, providerId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [scope]: providerId }));
  } catch {
    // Storage unavailable — the choice just won't survive a reload.
  }
}

/** The saved pick when it's connected, otherwise the first connected engine. */
export function resolveSelectedProvider(scope: string, providers: readonly AgentProvider[]): string {
  const saved = readAll()[scope];
  const savedProvider = saved ? providers.find((p) => p.id === saved && p.ok) : undefined;
  return (savedProvider ?? providers.find((p) => p.ok) ?? providers[0])?.id ?? "";
}
