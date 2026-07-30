/** Thin client for the DS Accelerator proposal-staging endpoints (see server.ts). */

function agentProposalsBaseUrl(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const origin = envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  const path = "/api/agent/proposals";
  return origin ? `${origin}${path}` : path;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  let message = response.statusText;
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) message = parsed.error;
  } catch {
    // ignore
  }
  return message;
}

/**
 * Fills in unmodified sibling files (e.g. `./DsTypography`, `./Badge.css`) into each staged
 * direction's real/ directory, so same-directory relative imports resolve when the preview
 * iframe imports the staged file. Call once, right after generation finishes and before
 * rendering any preview.
 */
export async function prepareProposalPreviews(runId: string): Promise<void> {
  const response = await fetch(`${agentProposalsBaseUrl()}/${encodeURIComponent(runId)}/prepare`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

/**
 * Copies exactly the direction's declared affectedFiles from staging onto their real repo
 * paths, then deletes the run's staging directory. Deliberately scoped to affectedFiles only
 * — the staging dir also holds unmodified sibling files copied in just so the preview iframe's
 * relative imports resolve (see prepareProposalPreviews), and those must never be written back.
 */
export async function promoteDirection(
  runId: string,
  directionId: string,
  affectedFiles: string[],
): Promise<{ promotedFiles: string[]; branch: string | null }> {
  const response = await fetch(`${agentProposalsBaseUrl()}/${encodeURIComponent(runId)}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directionId, affectedFiles }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { promotedFiles?: string[]; branch?: string | null };
  return {
    promotedFiles: Array.isArray(parsed.promotedFiles) ? parsed.promotedFiles : [],
    branch: parsed.branch ?? null,
  };
}

/** Best-effort cleanup for a run that was never chosen (new run started, refined, or abandoned). */
export async function discardProposalRun(runId: string): Promise<void> {
  await fetch(`${agentProposalsBaseUrl()}/${encodeURIComponent(runId)}/discard`, { method: "POST" });
}
