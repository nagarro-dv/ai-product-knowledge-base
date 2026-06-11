import type { ChangeIntent, ChangeIntentType, AnalysisOutput, AnalysisTask } from "./types";

export function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

export function extractSection(raw: string, heading: string): string {
  const pattern = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = pattern.exec(raw);
  return match?.[1]?.trim() ?? "";
}

function parseConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
  }
  return 0;
}

function extractJsonFence(sectionText: string): string | null {
  const fenceMatch = sectionText.match(/```json\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const plainObjectMatch = sectionText.match(/\{[\s\S]*\}/);
  return plainObjectMatch?.[0]?.trim() ?? null;
}

export function parseChangeIntent(raw: string): ChangeIntent {
  const fallback: ChangeIntent = {
    targetComponent: "unknown",
    changeType: "unknown",
    stateCondition: "No explicit state condition was extracted.",
    codeTargets: [],
    proposedRule: "No reusable implementation rule was extracted.",
    confidence: 0,
    assumptions: ["Analysis output did not include a valid change-intent JSON block."],
    followUpQuestions: ["Can you clarify which component and state should change?"],
  };
  const section = extractSection(raw, "Change Intent JSON");
  if (!section) return fallback;
  const jsonText = extractJsonFence(section);
  if (!jsonText) return fallback;
  try {
    const parsed = JSON.parse(jsonText) as Partial<ChangeIntent> & { confidence?: unknown };
    const changeType: ChangeIntentType =
      parsed.changeType === "style-rule" ||
      parsed.changeType === "behavior-rule" ||
      parsed.changeType === "layout-rule" ||
      parsed.changeType === "content-rule"
        ? parsed.changeType
        : "unknown";
    return {
      targetComponent:
        typeof parsed.targetComponent === "string" && parsed.targetComponent.trim()
          ? parsed.targetComponent.trim()
          : fallback.targetComponent,
      changeType,
      stateCondition:
        typeof parsed.stateCondition === "string" && parsed.stateCondition.trim()
          ? parsed.stateCondition.trim()
          : fallback.stateCondition,
      codeTargets: Array.isArray(parsed.codeTargets)
        ? parsed.codeTargets.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [],
      proposedRule:
        typeof parsed.proposedRule === "string" && parsed.proposedRule.trim()
          ? parsed.proposedRule.trim()
          : fallback.proposedRule,
      confidence: parseConfidence(parsed.confidence),
      assumptions: Array.isArray(parsed.assumptions)
        ? parsed.assumptions.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions)
        ? parsed.followUpQuestions.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [],
    };
  } catch {
    return fallback;
  }
}

export function parseAnalysisOutput(raw: string): AnalysisOutput {
  const summary = extractSection(raw, "Summary");
  const taskAnalysis = extractSection(raw, "Task Analysis");
  const planningTasksSection = extractSection(raw, "Planning Tasks");
  const needMoreContextSection = extractSection(raw, "Need More Context");
  const changeIntent = parseChangeIntent(raw);
  const detailedNotes = extractSection(raw, "Detailed Notes");

  const parsedTasks = planningTasksSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\[(?: |x|X)\]\s+/.test(line) || /^[-*]\s+/.test(line))
    .map((line, index) => {
      const rawLabel = line
        .replace(/^[-*]\s+\[(?: |x|X)\]\s+/, "")
        .replace(/^[-*]\s+/, "")
        .trim();
      const dashParts = rawLabel.split(/\s+[—–]\s+/);
      const hyphenParts = rawLabel.split(/\s+-\s+/);
      let label = rawLabel;
      let description = "Generated from analysis output.";
      if (dashParts.length >= 2) {
        label = dashParts[0]!.trim();
        description = dashParts.slice(1).join(" — ").trim();
      } else if (hyphenParts.length === 2 && hyphenParts[0]!.length <= 120) {
        label = hyphenParts[0]!.trim();
        description = hyphenParts[1]!.trim();
      }
      return {
        id: `task-${index + 1}-${slugify(label, `item-${index + 1}`)}`,
        label,
        description,
        active: true,
      } satisfies AnalysisTask;
    });

  const tasks =
    parsedTasks.length > 0
      ? parsedTasks
      : [
          {
            id: "fallback-1",
            label: "Solution A",
            description: "First implementation direction from analysis.",
            active: true,
          },
          {
            id: "fallback-2",
            label: "Solution B",
            description: "Alternative direction with different trade-offs.",
            active: true,
          },
        ];

  const needMoreContext =
    needMoreContextSection && !/^none$/i.test(needMoreContextSection.trim()) ? needMoreContextSection : null;

  return {
    summary: summary || "Analysis completed.",
    taskAnalysis: taskAnalysis || "No task analysis section was returned.",
    tasks,
    needMoreContext,
    changeIntent,
    detailedNotes: detailedNotes || "",
    raw,
  };
}

export function parseChangedFilesFromApplyOutput(raw: string): string[] {
  const section = extractSection(raw, "Changed Files");
  const candidateText = section || raw;
  const matchedPaths =
    candidateText.match(/[A-Za-z0-9._/-]+\/[A-Za-z0-9._/-]+\.(?:tsx|ts|css|md|json|mdc)/g) ?? [];
  return Array.from(new Set(matchedPaths));
}
