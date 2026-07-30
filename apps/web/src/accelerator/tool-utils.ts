import type { AgentStreamEvent } from "../agentSseClient";
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
  if (!(error instanceof Error)) return "Something went wrong while contacting the AI assistant.";
  const message = error.message?.trim() || "Something went wrong while contacting the AI assistant.";
  if (/failed to fetch|networkerror|network error/i.test(message)) {
    return "We couldn't reach the AI assistant. Open Settings → AI Models and restart the assistant service, then try again.";
  }
  if (/rate.?limit|quota|429|too many requests/i.test(message)) {
    return "The AI engine has hit its usage limit for now. Try again in a few minutes, or switch to a different engine.";
  }
  if (/(401|403).*(unauthor|forbidden)|unauthor|invalid.{0,10}(api.?key|credential)/i.test(message)) {
    return "This AI engine's sign-in isn't valid anymore. Reconnect it from Settings, then try again.";
  }
  if (/timed out|timeout/i.test(message)) {
    return "The AI engine took too long to respond. Try again — it usually works on the second attempt.";
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
  return { title: normalized, description: "Suggested while the analysis runs." };
}

/** Plain-language descriptions for common agent tool names. */
const FRIENDLY_TOOL_ACTIONS: Record<string, string> = {
  read: "reading project files",
  edit: "updating code",
  write: "updating code",
  multiedit: "updating code",
  bash: "running a check",
  grep: "searching the project",
  glob: "searching the project",
  ls: "browsing project files",
  todowrite: "planning the work",
  websearch: "searching the web",
  webfetch: "reading a page",
};

function friendlyToolAction(name: string): string {
  const key = name.trim().toLowerCase();
  return FRIENDLY_TOOL_ACTIONS[key] ?? `using ${name}`;
}

function friendlyStatus(status: string): string {
  const key = status.trim().toLowerCase();
  if (key === "running" || key === "in_progress") return "In progress";
  if (key === "queued" || key === "pending") return "Queued";
  if (key === "cancelled") return "Stopped";
  if (key === "finished" || key === "completed") return "Finished";
  const cleaned = status.replace(/[_-]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function formatStreamLine(event: AgentStreamEvent): Omit<StreamItem, "id"> | null {
  const safeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  if (event.kind === "done" || event.kind === "error") return null;
  // text_delta duplicates the full "assistant" event that follows it — dropped
  // to avoid double-rendering the same content. thinking_done carries no text
  // (just a duration) — nothing to show. thinking/thinking_delta are genuine
  // model reasoning and are the most useful thing to surface while working;
  // both map to the same "thinking" kind so appendStream's merge logic
  // (mergeStreamChunks) accumulates delta chunks into one growing line.
  if (event.kind === "text_delta" || event.kind === "thinking_done") {
    return null;
  }
  if (event.kind === "thinking" || event.kind === "thinking_delta") {
    return { kind: "thinking", text: safeText(event.text) || "Thinking it through…" };
  }
  if (event.kind === "assistant") {
    return { kind: "assistant", text: safeText(event.text) || "Working on it…" };
  }
  if (event.kind === "tool") return { kind: "tool", text: `Working — ${friendlyToolAction(event.name)}` };
  if (event.kind === "status") {
    return { kind: "status", text: safeText(event.message) || friendlyStatus(event.status ?? "update") };
  }
  if (event.kind === "task") {
    return { kind: "status", text: safeText(event.text) || friendlyStatus(event.status ?? "update") };
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
      storybook: source.storybook,
    };
  }
  return { id: source.id, kind: "figma", value: source.href, context: source.context };
}

/** Deduplicated Figma URLs across the primary Figma field and any figma-kind sources. */
export function collectFigmaUrls(sources: SourceEntry[], primaryFigma: string): string[] {
  const urls = new Set<string>();
  if (primaryFigma.trim()) urls.add(primaryFigma.trim());
  for (const source of sources) {
    if (source.kind === "figma" && source.value.trim()) urls.add(source.value.trim());
  }
  return Array.from(urls);
}

/**
 * Resolves which component the run is about. The only authority is a
 * Storybook-backed component source; failing that, the analysis's own
 * change-intent target. There is no built-in registry to guess from.
 */
export function resolvePreviewTarget(
  sources: SourceEntry[],
  _baseContext: string,
  changeIntent?: ChangeIntent | null,
): PreviewTarget {
  const componentSource = sources.find((source) => source.kind === "component");
  if (componentSource) {
    return {
      id: componentSource.storybook?.componentPath ?? componentSource.value,
      label: componentSource.value,
      reason: "You attached this component.",
    };
  }
  const intentId = changeIntent?.targetComponent;
  if (intentId && intentId !== UNKNOWN_TARGET) {
    return { id: intentId, label: intentId, reason: "Identified by the analysis." };
  }
  return {
    id: UNKNOWN_TARGET,
    label: "No component yet",
    reason: "We couldn't tell which component this is about.",
  };
}

export function streamItemLabel(item: StreamItem): string {
  return item.text;
}

/**
 * Most recent item of any of the given kinds, scanning from the end — used to
 * find "the latest real reasoning" separately from "the latest process tick"
 * so a working screen can show both without one flickering over the other
 * every time the model interleaves thinking with a tool call.
 */
export function lastStreamItemOfKind(items: StreamItem[], kinds: readonly StreamItem["kind"][]): StreamItem | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]!;
    if ((kinds as readonly string[]).includes(item.kind)) return item;
  }
  return null;
}

export type DirectionFileGroup = { label: string; files: string[] };

/**
 * Groups changed file paths by which built direction produced them, using the
 * SolutionA/SolutionB/SolutionC naming convention the implementation prompt
 * requires. Anything that doesn't match a direction (shared docs, validation
 * output) lands in a final "Other files" group rather than being dropped.
 */
export function groupFilesByDirection(paths: string[], directionLabels: string[]): DirectionFileGroup[] {
  const buckets = new Map<number, string[]>();
  const other: string[] = [];
  for (const path of paths) {
    const match = /solution[-_]?([a-z])(?![a-z])/i.exec(path);
    const index = match ? match[1]!.toUpperCase().charCodeAt(0) - 65 : -1;
    if (index >= 0 && index < directionLabels.length) {
      buckets.set(index, [...(buckets.get(index) ?? []), path]);
    } else {
      other.push(path);
    }
  }
  const groups: DirectionFileGroup[] = directionLabels
    .map((label, index) => ({ label, files: buckets.get(index) ?? [] }))
    .filter((group) => group.files.length > 0);
  if (other.length > 0) groups.push({ label: "Other files", files: other });
  return groups;
}
