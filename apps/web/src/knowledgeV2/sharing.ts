import { sourceById } from "../knowledge/sources";
import { KIND_LABELS, type Artifact } from "./artifactData";
import { keyResult, type Initiative, type Metric, type Signal } from "./data";
import { riceFor, riceSummary } from "./rice";

/*
 * Anything that can leave the knowledge base — an initiative, an insight, a
 * metric or a chat file — described the same way, with a self-contained
 * summary so it stands on its own wherever it's shared.
 */

export type Shareable = {
  kind: "initiative" | "insight" | "metric" | "file";
  id: string;
  title: string;
  /** What kind of thing it is, for headings: "Initiative", "Insight"… */
  label: string;
  /** Plain-text body: the facts, the reasoning and the evidence. */
  summary: string;
  /** A link back to it. Demo links only — there's no hosted knowledge base yet. */
  link: string;
  /** Initiatives carry their RICE inputs into Jira Product Discovery. */
  initiative?: Initiative;
  /** Whether it makes sense as a Product Discovery idea. */
  canSendToJpd: boolean;
};

const link = (kind: string, id: string) => `https://knowledge.example.com/${kind}/${id}`;

export function shareInitiative(initiative: Initiative): Shareable {
  const kr = keyResult(initiative.rice.okr);
  return {
    kind: "initiative",
    id: initiative.id,
    title: initiative.title,
    label: "Initiative",
    summary: [
      initiative.summary,
      "",
      `Theme: ${initiative.theme}${kr ? ` · Goal: ${kr.id} — ${kr.text}` : ""}`,
      `Proposed by: ${initiative.origin}`,
      "",
      riceSummary(initiative),
    ].join("\n"),
    link: link("initiatives", initiative.id),
    initiative,
    canSendToJpd: true,
  };
}

export function shareSignal(signal: Signal): Shareable {
  return {
    kind: "insight",
    id: signal.id,
    title: signal.title,
    label: "Insight",
    summary: [
      signal.detail,
      "",
      ...(signal.impact ? [`${signal.impact.label}: ${signal.impact.value} (${signal.impact.delta})`, ""] : []),
      "Evidence:",
      ...signal.evidence.map((e) => `• ${sourceById(e.source).label}: ${e.summary}`),
    ].join("\n"),
    link: link("insights", signal.id),
    canSendToJpd: true,
  };
}

export function shareMetric(metric: Metric): Shareable {
  return {
    kind: "metric",
    id: metric.id,
    title: metric.label,
    label: "Metric",
    summary: [
      `${metric.label}: ${metric.value} (${metric.delta} ${metric.period})`,
      ...(metric.goal ? [metric.goal] : []),
      `Source: ${sourceById(metric.source).label}`,
    ].join("\n"),
    link: link("metrics", metric.id),
    canSendToJpd: false,
  };
}

export function shareArtifact(artifact: Artifact): Shareable {
  const body = (() => {
    switch (artifact.kind) {
      case "doc":
        return artifact.blocks
          .map((b) => (b.type === "h2" ? `\n${b.text}` : b.type === "li" ? `• ${b.text}` : b.text))
          .join("\n")
          .trim();
      case "deck":
        return artifact.slides.map((s, i) => `${i + 1}. ${s.title}\n${s.bullets.map((b) => `   • ${b}`).join("\n")}`).join("\n");
      case "chart":
        return [artifact.caption, ...artifact.bars.map((b) => `• ${b.label}: ${b.value}${artifact.unit}`)].join("\n");
      case "figma":
        return `Figma file with ${artifact.frames.length} frames: ${artifact.frames.join(", ")}\n${artifact.url}`;
      case "jira":
        return `${artifact.key} · ${artifact.issueType} · ${artifact.status} · ${artifact.assignee}\n${artifact.summary}\n${artifact.url}`;
    }
  })();
  return {
    kind: "file",
    id: artifact.id,
    title: artifact.title,
    label: KIND_LABELS[artifact.kind],
    summary: body,
    link: link("files", artifact.id),
    canSendToJpd: false,
  };
}

/** The whole thing as Markdown, for downloads and copying. */
export function toMarkdown(item: Shareable): string {
  const extra = item.initiative ? `\n\n**RICE ${riceFor(item.initiative).score}**` : "";
  return `# ${item.title}\n\n_${item.label}_${extra}\n\n${item.summary}\n\n[Open in the knowledge base](${item.link})\n`;
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "export";
