/*
 * Talks to the agent server's /api/product-discovery routes, which create
 * real Jira Product Discovery ideas with the API token in its .env (the
 * token never reaches the browser). When it isn't set up or the server isn't
 * running, sending stays a demo.
 */

export type JpdConnection = {
  configured: boolean;
  site?: string;
  projectKey?: string;
  projectName?: string;
  /** The fields ideas in that space have, with their options. */
  fields?: { name: string; allowed: string[] }[];
  /** Why it isn't working, when the settings are there but Jira refused them. */
  error?: string;
};

export type JpdIdea = {
  key: string;
  url: string;
  /** Fields that were filled, and ones left out (and why). */
  set: string[];
  skipped: { name: string; reason: string }[];
};

function origin(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
}

/** Null when the agent server can't be reached. */
export async function fetchJpdConnection(): Promise<JpdConnection | null> {
  if (!origin()) return null;
  try {
    const res = await fetch(`${origin()}/api/product-discovery/status`, { signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()) as JpdConnection) : null;
  } catch {
    return null;
  }
}

/** Creates the idea; throws with Jira's reason if it can't. */
export async function createJpdIdea(input: {
  title: string;
  description: string;
  fields?: { name: string; value: string | number | string[] }[];
}): Promise<JpdIdea> {
  const res = await fetch(`${origin()}/api/product-discovery/ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<JpdIdea> & { error?: string };
  if (!res.ok || !body.key || !body.url) throw new Error(body.error ?? `Couldn't create the idea (${res.status}).`);
  return { key: body.key, url: body.url, set: body.set ?? [], skipped: body.skipped ?? [] };
}
