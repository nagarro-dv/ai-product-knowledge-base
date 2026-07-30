/** Browser client for the Storybook context-source endpoints (see agent-orchestrator server.ts). */

export type StorybookComponent = {
  id: string;
  title: string;
  /** Full title path as authored in stories, e.g. "Components/Button". */
  path: string;
  storyIds: string[];
  storyNames: string[];
  importPath?: string;
  tags: string[];
};

export type StorybookSummary = {
  status: "connected" | "not-connected" | "error";
  url?: string;
  componentCount?: number;
  lastIndexedAt?: number;
  error?: string;
  /** A human name for the design system, when the Storybook exposes one. See storybookDisplayName. */
  projectTitle?: string;
  /** Storybook version, when detectable (exact or a coarse generation label). */
  versionLabel?: string;
};

/** Clean, no-scheme form of a URL for display — the guaranteed-correct fallback identifier. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * The single source of truth for "what do we call the connected design
 * system" — every surface (home page, component picker, Settings) must call
 * this so they can never disagree. Prefers the Storybook's own title when
 * it's genuinely custom (see StorybookIntegration.ts for why most instances
 * don't have one); falls back to the URL, which is always correct.
 */
export function storybookDisplayName(summary: Pick<StorybookSummary, "projectTitle" | "url"> | null): string {
  if (!summary) return "your Storybook";
  if (summary.projectTitle) return summary.projectTitle;
  return summary.url ? displayUrl(summary.url) : "your Storybook";
}

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

export async function connectStorybook(url: string): Promise<StorybookSummary> {
  const response = await fetch(`${agentOrigin()}/api/integrations/storybook/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: StorybookSummary };
  return parsed.summary;
}

export async function disconnectStorybook(): Promise<void> {
  const response = await fetch(`${agentOrigin()}/api/integrations/storybook/disconnect`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}

export async function refreshStorybook(): Promise<StorybookSummary> {
  const response = await fetch(`${agentOrigin()}/api/integrations/storybook/refresh`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: StorybookSummary };
  return parsed.summary;
}

export async function listStorybookComponents(
  query?: string,
  init?: { signal?: AbortSignal },
): Promise<{ summary: StorybookSummary; components: StorybookComponent[] }> {
  const params = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  const response = await fetch(`${agentOrigin()}/api/integrations/storybook/components${params}`, {
    signal: init?.signal,
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return (await response.json()) as { summary: StorybookSummary; components: StorybookComponent[] };
}

/** Renders a Storybook component's context fields into one text block for the AI prompt. */
export function formatStorybookComponentContext(component: StorybookComponent, storybookUrl: string): string {
  return [
    `Storybook component: ${component.path}`,
    component.importPath
      ? `Stories file: ${component.importPath} (the component's own source is imported by this file)`
      : "",
    component.storyNames.length ? `Stories: ${component.storyNames.join(", ")}` : "",
    component.tags.length ? `Tags: ${component.tags.join(", ")}` : "",
    `Storybook: ${storybookUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}
