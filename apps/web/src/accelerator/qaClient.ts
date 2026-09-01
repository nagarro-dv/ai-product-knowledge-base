import type { QaFinding } from "./types";

/** Browser client for the orchestrator's static (file-content) QA checks — see agent-orchestrator/src/qaRouter.ts. */

function agentOrigin(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
}

/**
 * Runs the enabled static criteria (token usage, inline styles, …) against
 * the REAL files the agent reported reading for the subject — never a
 * staged copy, so this reads the repo as it actually is right now.
 */
export async function runStaticQaChecks(files: string[], enabledCriteriaIds: string[]): Promise<QaFinding[]> {
  if (files.length === 0 || enabledCriteriaIds.length === 0) return [];
  const response = await fetch(`${agentOrigin()}/api/agent/qa/static`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, criteriaIds: enabledCriteriaIds }),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { findings?: QaFinding[] };
  return data.findings ?? [];
}
