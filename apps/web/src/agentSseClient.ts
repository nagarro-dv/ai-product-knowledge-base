/** SSE payloads from the local agent orchestrator (`apps/agent-orchestrator`). */

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
      }
    }
  }
}
