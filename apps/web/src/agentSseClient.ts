/** SSE payloads from the local agent orchestrator (`apps/agent-orchestrator`). */

export type AgentAuthMethodStatus = "connected" | "not-configured" | "unavailable";

export type AgentAuthMethod = {
  id: string;
  label: string;
  /** 'api-key' | 'local-runtime' | 'oauth' | 'gateway' */
  kind: string;
  /** 'organisation' (admin-configured) or 'personal' (the user's own credential). */
  source: "organisation" | "personal";
  description: string;
  /** Plain-language instruction for making this method available. */
  hint: string;
  /** Exact env var name an admin sets for this method, when applicable (api-key methods only). */
  envVar?: string;
  /** For local-runtime methods: the exact terminal command to sign in (e.g. 'claude' or 'cursor-agent login'). */
  signInCommand?: string;
  /** For local-runtime methods: docs URL for installing the CLI. */
  installUrl?: string;
  /** Named MCP servers this method has real, working wiring for (e.g. ['figma']). */
  mcpServers?: string[];
  /** For connected personal keys: safe display hint like '····abc4'. Never the key itself. */
  maskedHint?: string;
  /** When the personal key was saved (epoch ms). */
  savedAt?: number;
  capabilities: { localRepoEdits: boolean; streaming: boolean; mcp: boolean };
  status: AgentAuthMethodStatus;
  ok: boolean;
  model?: string;
  /** How the runtime actually authenticated on its last run (e.g. 'oauth'). */
  lastAuthSource?: string;
  error?: string;
};

export type AgentProvider = {
  id: string;
  label: string;
  ok: boolean;
  model?: string;
  defaultAuthMethod?: string | null;
  authMethods?: AgentAuthMethod[];
};

export type AgentStreamDone = {
  kind: "done";
  status: string;
  runId: string;
  durationMs?: number;
  output?: string;
  model?: string;
};

export type AgentStreamEvent =
  | { kind: "thinking"; text: string }
  | { kind: "thinking_delta"; text: string }
  | { kind: "thinking_done"; durationMs?: number }
  | { kind: "text_delta"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; status: string; callId?: string; argsPreview?: string }
  | { kind: "status"; status: string; message?: string }
  | { kind: "task"; text?: string; status?: string }
  | { kind: "error"; message: string }
  | AgentStreamDone;

export type AgentJobStatus = "queued" | "running" | "finished" | "error" | "cancelled";

export type AgentJobSummary = {
  jobId: string;
  status: AgentJobStatus;
  eventCount: number;
  createdAt?: number;
  updatedAt?: number;
  result?: AgentStreamDone | null;
  error?: string | null;
};

function parseSseDataLine(line: string): AgentStreamEvent | null {
  const match = /^data:\s*(.+)$/.exec(line);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as AgentStreamEvent;
  } catch {
    return null;
  }
}

function agentStreamUrl(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const origin = envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  const path = "/api/agent/chat/stream";
  return origin ? `${origin}${path}` : path;
}

function agentJobsBaseUrl(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const origin = envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  const path = "/api/agent/jobs";
  return origin ? `${origin}${path}` : path;
}

function agentProvidersUrl(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const origin = envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  const path = "/api/agent/providers";
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

export async function postAgentChatStream(
  payload: unknown,
  onEvent: (event: AgentStreamEvent) => void,
  init?: { signal?: AbortSignal },
): Promise<AgentStreamDone> {
  const response = await fetch(agentStreamUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: init?.signal,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("No response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  let doneEvent: AgentStreamDone | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const blocks = carry.split("\n\n");
    carry = blocks.pop() ?? "";

    for (const block of blocks) {
      for (const line of block.split("\n")) {
        const event = parseSseDataLine(line);
        if (!event) continue;
        onEvent(event);
        if (event.kind === "error") throw new Error(event.message);
        if (event.kind === "done") doneEvent = event;
      }
    }
  }

  if (!doneEvent) {
    throw new Error("Stream ended without a terminal done event.");
  }
  return doneEvent;
}

export async function startAgentJob(
  payload: unknown,
  init?: { signal?: AbortSignal },
): Promise<{ jobId: string }> {
  const response = await fetch(agentJobsBaseUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: init?.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { jobId?: string };
  if (!parsed.jobId) {
    throw new Error("Missing job id from server.");
  }
  return { jobId: parsed.jobId };
}

export async function getAgentJob(jobId: string, init?: { signal?: AbortSignal }): Promise<AgentJobSummary> {
  const response = await fetch(`${agentJobsBaseUrl()}/${encodeURIComponent(jobId)}`, {
    method: "GET",
    signal: init?.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AgentJobSummary;
}

export async function cancelAgentJob(jobId: string, init?: { signal?: AbortSignal }): Promise<AgentJobSummary> {
  const response = await fetch(`${agentJobsBaseUrl()}/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    signal: init?.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AgentJobSummary;
}

export async function fetchAgentProviders(init?: { signal?: AbortSignal }): Promise<AgentProvider[]> {
  const response = await fetch(agentProvidersUrl(), { signal: init?.signal });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { providers?: AgentProvider[] };
  return Array.isArray(parsed.providers) ? parsed.providers : [];
}

/**
 * Forces a live recheck (CLI/auth probes, API-key validation, re-read .env)
 * instead of serving whatever the server already has cached. Slower than
 * `fetchAgentProviders` — use it for an explicit user-triggered refresh, not
 * on every page load.
 */
export async function refreshAgentProviders(init?: { signal?: AbortSignal }): Promise<AgentProvider[]> {
  const response = await fetch(`${agentProvidersUrl()}/refresh`, { method: "POST", signal: init?.signal });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { providers?: AgentProvider[] };
  return Array.isArray(parsed.providers) ? parsed.providers : [];
}

/**
 * Connects a personal API key. The server validates the key against the
 * provider with a real call BEFORE storing it, and never returns it —
 * responses only ever contain the non-secret masked hint.
 */
export async function connectPersonalKey(providerId: string, apiKey: string): Promise<AgentProvider[]> {
  const response = await fetch(`${agentProvidersUrl()}/${encodeURIComponent(providerId)}/personal-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { providers?: AgentProvider[] };
  return Array.isArray(parsed.providers) ? parsed.providers : [];
}

export async function disconnectPersonalKey(providerId: string): Promise<AgentProvider[]> {
  const response = await fetch(`${agentProvidersUrl()}/${encodeURIComponent(providerId)}/personal-key`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { providers?: AgentProvider[] };
  return Array.isArray(parsed.providers) ? parsed.providers : [];
}

async function callMethodLifecycle(
  providerId: string,
  methodId: string,
  action: "disconnect" | "reconnect",
): Promise<AgentProvider[]> {
  const response = await fetch(
    `${agentProvidersUrl()}/${encodeURIComponent(providerId)}/methods/${encodeURIComponent(methodId)}/${action}`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const parsed = (await response.json()) as { providers?: AgentProvider[] };
  return Array.isArray(parsed.providers) ? parsed.providers : [];
}

/**
 * Disconnects any auth method with a real, user-owned connection: a personal
 * API key (deletes the stored secret) or a local-runtime CLI sign-in like
 * Claude Code / Cursor CLI (stops this app from using it — does NOT sign the
 * user out of the external tool itself, since that session may be used
 * elsewhere on this machine). Refused server-side for organisation-managed
 * methods.
 */
export async function disconnectAuthMethod(providerId: string, methodId: string): Promise<AgentProvider[]> {
  return callMethodLifecycle(providerId, methodId, "disconnect");
}

/** Re-enables a previously in-app-disconnected local-runtime method and re-probes it. */
export async function reconnectAuthMethod(providerId: string, methodId: string): Promise<AgentProvider[]> {
  return callMethodLifecycle(providerId, methodId, "reconnect");
}

export async function streamAgentJob(
  jobId: string,
  onEvent: (event: AgentStreamEvent) => void,
  init?: { signal?: AbortSignal; after?: number },
): Promise<void> {
  const query = typeof init?.after === "number" ? `?after=${encodeURIComponent(String(init.after))}` : "";
  const response = await fetch(`${agentJobsBaseUrl()}/${encodeURIComponent(jobId)}/stream${query}`, {
    method: "GET",
    signal: init?.signal,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("No response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const blocks = carry.split("\n\n");
    carry = blocks.pop() ?? "";

    for (const block of blocks) {
      for (const line of block.split("\n")) {
        const event = parseSseDataLine(line);
        if (!event) continue;
        onEvent(event);
        if (event.kind === "error") throw new Error(event.message);
        // Don't rely solely on the server closing the response after a terminal event —
        // stop consuming as soon as we see one, so a race on the server's side (or a proxy
        // that buffers the close) can never hang the client waiting for a read that never comes.
        if (event.kind === "done") {
          await reader.cancel().catch(() => {});
          return;
        }
      }
    }
  }
}
