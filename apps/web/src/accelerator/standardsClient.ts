import type { CriterionWithState } from "@ds-starter/standards";

/** Browser client for the orchestrator's /api/standards route — see agent-orchestrator/src/standardsRouter.ts. */

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
    // not json
  }
  return `Request failed (${response.status})`;
}

export type StandardsState = {
  criteria: CriterionWithState[];
  proposedRepoCriteria: CriterionWithState[];
};

/** Resolved criteria for the currently connected repository (baseline + accepted repo criteria, with live enabled flags). */
export async function fetchStandards(init?: { signal?: AbortSignal }): Promise<StandardsState> {
  const response = await fetch(`${agentOrigin()}/api/standards`, { signal: init?.signal });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as StandardsState;
}

/** Persists which criteria are disabled for this project. Locked criteria are rejected server-side if present. */
export async function updateStandards(disabledIds: string[]): Promise<StandardsState> {
  const response = await fetch(`${agentOrigin()}/api/standards`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabledIds }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as StandardsState;
}
