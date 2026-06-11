import type { AgentStreamEvent } from "../agentSseClient";
import { COMPONENT_REGISTRY, getComponentEntry } from "../component-registry";
import type { AiAgentInputSendPayload } from "../components/custom/AiAgentInput";
import { extractTicketKey, resolveTaskFolder } from "./task-docs";
import type { ChangeIntent, PreviewTarget, SourceEntry, StreamItem } from "./types";

export const SNAPSHOT_KEY = "ds-accelerator-snapshot";
export const ACTIVE_JOB_KEY = "ds-accelerator-job";
export const SNAPSHOT_MAX_STREAM_ITEMS = 120;
export const STREAM_IDLE_RECONNECT_MS = 30000;
export const UNKNOWN_TARGET = "unknown";

export function safeReadSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeWriteSession(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function toReadableAgentError(error: unknown): string {
  if (!(error instanceof Error)) return "Unexpected error while contacting the agent.";
  const message = error.message?.trim() || "Unexpected error while contacting the agent.";
  if (/failed to fetch|networkerror|network error/i.test(message)) {
    return [
      "Cannot reach the Agent API.",
      "Start it with: npm run serve --prefix apps/agent-orchestrator",
      "Then retry.",
    ].join(" ");
  }
  return message;
}

export function mergeStreamChunks(previous: string, next: string): string {
  const left = previous.trimEnd();
  const right = next.trim();
  if (!right) return left;
  const needsSpace =
    left.length > 0 && !/[\s([{"'`-]$/.test(left) && !/^[,.;:!?)}\]"']/.test(right);
  return `${left}${needsSpace ? " " : ""}${right}`;
}

export function extractTaskFromEvent(event: AgentStreamEvent): string | null {
  if (event.kind !== "task") return null;
  const text = typeof event.text === "string" ? event.text.trim() : "";
  return text || null;
}

export function toTaskFields(text: string): { title: string; description: string } {
  const normalized = text.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim();
  const splitByDash = normalized.split(/\s+[—–-]\s+/);
  if (splitByDash.length >= 2) {
    return {
      title: splitByDash[0]!.trim(),
      description: splitByDash.slice(1).join(" — ").trim(),
    };
  }
  return { title: normalized, description: "Generated while analysis is in progress." };
}

export function formatStreamLine(event: AgentStreamEvent): Omit<StreamItem, "id"> | null {
  const safeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  if (event.kind === "done" || event.kind === "error") return null;
  if (event.kind === "thinking_delta" || event.kind === "text_delta" || event.kind === "thinking_done") {
    return null;
  }
  if (event.kind === "thinking") {
    return { kind: "thinking", text: safeText(event.text) || "update" };
  }
  if (event.kind === "assistant") {
    return { kind: "assistant", text: safeText(event.text) || "update" };
  }
  if (event.kind === "tool") return { kind: "tool", text: `${event.name} (${event.status})` };
  if (event.kind === "status") {
    return { kind: "status", text: `${event.status}${event.message ? ` | ${event.message}` : ""}` };
  }
  if (event.kind === "task") {
    return { kind: "status", text: `task: ${event.status ?? "update"}${event.text ? ` | ${event.text}` : ""}` };
  }
  return null;
}

export function mapPayloadSource(source: AiAgentInputSendPayload["sources"][number]): SourceEntry {
  if (source.kind === "ticket") {
    const ticketKey = extractTicketKey(source.href);
    const resolution = resolveTaskFolder(ticketKey);
    return {
      id: source.id,
      kind: "ticket",
      value: source.href,
      context: source.context,
      ticketKey: ticketKey ?? undefined,
      taskFolder: resolution.taskFolder ?? undefined,
    };
  }
  if (source.kind === "component") {
    return {
      id: source.id,
      kind: "component",
      value: source.href,
      context: source.context,
      componentId: source.componentId,
    };
  }
  return { id: source.id, kind: "figma", value: source.href, context: source.context };
}

export function resolvePreviewTarget(
  sources: SourceEntry[],
  baseContext: string,
  changeIntent?: ChangeIntent | null,
): PreviewTarget {
  const componentSource = sources.find((source) => source.kind === "component" && source.componentId);
  if (componentSource?.componentId) {
    const entry = getComponentEntry(componentSource.componentId);
    return {
      id: componentSource.componentId,
      label: entry?.title ?? componentSource.value,
      reason: "Selected as component source in intake.",
    };
  }
  const intentId = changeIntent?.targetComponent;
  if (intentId && intentId !== UNKNOWN_TARGET) {
    const entry = getComponentEntry(intentId);
    if (entry) {
      return { id: entry.id, label: entry.title, reason: "Resolved from analysis change intent." };
    }
  }
  const combined = `${baseContext} ${sources.map((source) => `${source.value} ${source.context}`).join(" ")}`.toLowerCase();
  for (const entry of COMPONENT_REGISTRY) {
    if (combined.includes(entry.id.toLowerCase()) || combined.includes(entry.title.toLowerCase())) {
      return {
        id: entry.id,
        label: entry.title,
        reason: `Resolved from source text mentioning ${entry.title}.`,
      };
    }
  }
  return {
    id: UNKNOWN_TARGET,
    label: "Unknown component",
    reason: "Could not match a component from the provided sources.",
  };
}

export function streamItemLabel(item: StreamItem): string {
  if (item.kind === "assistant") return `assistant: ${item.text}`;
  if (item.kind === "thinking") return `thinking: ${item.text}`;
  if (item.kind === "tool") return `tool: ${item.text}`;
  return item.text;
}
