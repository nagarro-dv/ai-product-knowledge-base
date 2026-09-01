import type {
  ChangeIntent,
  ChangeIntentType,
  AnalysisOutput,
  Direction,
  DirectionComplexity,
  QaFinding,
  QaReport,
  UnderstandingBrief,
} from "./types";

/**
 * True when `directions` is real model output, false when the parser had
 * nothing to work with and substituted the two hardcoded placeholder
 * directions (see the `parseAnalysisOutput` fallback below). Callers must
 * check this before treating a run as successful — an unchecked fallback
 * silently presents "no usable output" as a completed result.
 */
export function hasRealDirections(directions: Direction[]): boolean {
  return !(directions.length === 2 && directions[0]?.id === "fallback-1" && directions[1]?.id === "fallback-2");
}

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

/** Splits a markdown section into clean bullet items; tolerates plain lines when no bullets are present. */
function parseBulletList(section: string): string[] {
  const lines = section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line.length > 0 && !/^none\.?$/i.test(line));
  return lines;
}

/**
 * Parses the phase-1 understanding brief the user reviews at the checkpoint.
 * Missing sections stay empty — the UI shows honest gaps instead of invented
 * content, so a weak analysis is visibly weak.
 */
export function parseUnderstanding(raw: string): UnderstandingBrief {
  return {
    summary: extractSection(raw, "Summary"),
    interpretation: extractSection(raw, "Interpretation"),
    sourcesReviewed: parseBulletList(extractSection(raw, "Sources Reviewed")),
    inScope: parseBulletList(extractSection(raw, "In Scope")),
    outOfScope: parseBulletList(extractSection(raw, "Out of Scope")),
    assumptions: parseBulletList(extractSection(raw, "Assumptions")),
    openQuestions: parseBulletList(extractSection(raw, "Open Questions")),
    risks: parseBulletList(extractSection(raw, "Risks")),
    changeIntent: parseChangeIntent(raw),
    raw,
  };
}

/**
 * Text-only fallback for engines without local repo-edit access — parses the same
 * "Planning Tasks" bullet format the product always used before real per-direction
 * generation existed. Directions from this path never get a real preview
 * (previewModulePath stays null) because there is no code to preview.
 */
export function parseAnalysisOutput(raw: string): AnalysisOutput {
  const summary = extractSection(raw, "Summary");
  const taskAnalysis = extractSection(raw, "Task Analysis");
  const planningTasksSection = extractSection(raw, "Planning Tasks");
  const needMoreContextSection = extractSection(raw, "Need More Context");
  const changeIntent = parseChangeIntent(raw);
  const detailedNotes = extractSection(raw, "Detailed Notes");
  // Zipped positionally onto Planning Tasks, not matched by title — the model
  // is asked to emit exactly one bullet per solution, in the same order, so
  // this avoids fragile fuzzy title-matching between two separate sections.
  const responsiveNotesList = parseBulletList(extractSection(raw, "Responsive Behaviour"));

  const parsedDirections = planningTasksSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]?\s*\[(?: |x|X)\]\s+/.test(line) || /^[-*]\s+/.test(line))
    .map((line, index) => {
      const withoutRecommendedMarker = line.replace(/\s*\(recommended\)\s*$/i, "");
      const recommended = withoutRecommendedMarker.length !== line.length;
      const rawLabel = withoutRecommendedMarker
        .replace(/^[-*]?\s*\[(?: |x|X)\]\s+/, "")
        .replace(/^[-*]\s+/, "")
        .trim();
      // Pulled out before splitting on the title dash so it never leaks into
      // the displayed summary — see buildTextDirectionsPrompt's required
      // "Axis: ..." segment. Kept separate from `reasoning` (always empty in
      // this text-only path) so directionQuality.ts still has a real signal
      // to compare between solutions even without staged code to diff.
      const axisMatch = rawLabel.match(/\bAxis:\s*([^.]+)\.?\s*/i);
      const differentiationAxis = axisMatch?.[1]?.trim() ?? "";
      const labelWithoutAxis = axisMatch ? rawLabel.replace(axisMatch[0], " ").replace(/\s+/g, " ").trim() : rawLabel;
      const dashParts = labelWithoutAxis.split(/\s+[—–]\s+/);
      const hyphenParts = labelWithoutAxis.split(/\s+-\s+/);
      let title = labelWithoutAxis;
      let summaryText = "Generated from analysis output.";
      if (dashParts.length >= 2) {
        title = dashParts[0]!.trim();
        summaryText = dashParts.slice(1).join(" — ").trim();
      } else if (hyphenParts.length === 2 && hyphenParts[0]!.length <= 120) {
        title = hyphenParts[0]!.trim();
        summaryText = hyphenParts[1]!.trim();
      }
      return {
        id: `${index + 1}-${slugify(title, `item-${index + 1}`)}`,
        title,
        summary: summaryText,
        highlights: [],
        reasoning: "",
        differentiationAxis,
        tradeoffs: [],
        complexity: "medium" as DirectionComplexity,
        affectedFiles: [],
        confidence: 0,
        recommended,
        previewModulePath: null,
        previewStatus: "unavailable" as const,
        responsiveNotes: responsiveNotesList[index] ?? "",
      } satisfies Direction;
    });

  const directions: Direction[] =
    parsedDirections.length > 0
      ? parsedDirections
      : [
          {
            id: "fallback-1",
            title: "Direction A",
            summary: "First implementation direction from analysis.",
            highlights: [],
            reasoning: "",
            differentiationAxis: "",
            tradeoffs: [],
            complexity: "medium",
            affectedFiles: [],
            confidence: 0,
            recommended: false,
            previewModulePath: null,
            previewStatus: "unavailable",
            responsiveNotes: "",
          },
          {
            id: "fallback-2",
            title: "Direction B",
            summary: "Alternative direction with different trade-offs.",
            highlights: [],
            reasoning: "",
            differentiationAxis: "",
            tradeoffs: [],
            complexity: "medium",
            affectedFiles: [],
            confidence: 0,
            recommended: false,
            previewModulePath: null,
            previewStatus: "unavailable",
            responsiveNotes: "",
          },
        ];

  const needMoreContext =
    needMoreContextSection && !/^none$/i.test(needMoreContextSection.trim()) ? needMoreContextSection : null;

  return {
    summary: summary || "Analysis completed.",
    taskAnalysis: taskAnalysis || "No task analysis section was returned.",
    directions,
    needMoreContext,
    changeIntent,
    detailedNotes: detailedNotes || "",
    raw,
  };
}

/**
 * The real pipeline for agentic engines — parses the "Directions JSON" manifest the
 * agent emits after actually writing staged code + a Preview.tsx harness per
 * direction (see buildProposalPrompt). Falls back to the text-only parse if the
 * manifest is missing or malformed, so a bad model response degrades gracefully
 * instead of showing nothing.
 */
export function parseProposalOutput(raw: string, runId: string): AnalysisOutput {
  const base = parseAnalysisOutput(raw);
  const section = extractSection(raw, "Directions JSON");
  if (!section) return base;
  const jsonText = extractJsonFence(section);
  if (!jsonText) return base;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return base;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return base;

  const validComplexity = (value: unknown): DirectionComplexity =>
    value === "low" || value === "high" ? value : "medium";

  const directions: Direction[] = parsed
    .map((entry, index): Direction | null => {
      if (typeof entry !== "object" || entry === null) return null;
      const e = entry as Record<string, unknown>;
      const id = typeof e.id === "string" && e.id.trim() ? e.id.trim() : String.fromCharCode(97 + index);
      const title = typeof e.title === "string" && e.title.trim() ? e.title.trim() : `Direction ${id.toUpperCase()}`;
      const previewFile = typeof e.previewFile === "string" && e.previewFile.trim() ? e.previewFile.trim() : null;
      return {
        id,
        title,
        summary: typeof e.summary === "string" ? e.summary.trim() : "",
        highlights: Array.isArray(e.highlights)
          ? e.highlights.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 4)
          : [],
        reasoning: typeof e.reasoning === "string" ? e.reasoning.trim() : "",
        differentiationAxis: typeof e.differentiationAxis === "string" ? e.differentiationAxis.trim() : "",
        responsiveNotes: typeof e.responsiveNotes === "string" ? e.responsiveNotes.trim() : "",
        tradeoffs: Array.isArray(e.tradeoffs)
          ? e.tradeoffs.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          : [],
        complexity: validComplexity(e.complexity),
        affectedFiles: Array.isArray(e.affectedFiles)
          ? e.affectedFiles.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          : [],
        confidence: parseConfidence(e.confidence),
        recommended: e.recommended === true,
        previewModulePath: previewFile ? `/src/accelerator/.generated/${runId}/${previewFile}` : null,
        previewStatus: previewFile ? "pending" : "unavailable",
      };
    })
    .filter((entry): entry is Direction => entry !== null);

  if (directions.length === 0) return base;

  // A model may over-eagerly mark more than one direction recommended — keep only the first.
  let sawRecommended = false;
  for (const direction of directions) {
    if (direction.recommended && sawRecommended) direction.recommended = false;
    else if (direction.recommended) sawRecommended = true;
  }

  return { ...base, directions };
}

const QA_STATUSES = new Set(["pass", "fail", "warning", "not-applicable", "needs-review"]);

/**
 * Parses ONLY the judgment half of a QA run — buildQaPrompt only asks the
 * model about judgment criteria, never the ones a real runner already
 * measured. The caller merges this with the DOM/static runners' findings
 * into one report; verifiedBy is always "judgment" here by construction.
 * The staged preview path is deterministic (buildQaPrompt always writes to
 * `${runId}/qa/Preview.tsx`), so it's constructed here rather than parsed.
 */
export function parseQaOutput(raw: string, runId: string, subjectLabel: string): QaReport {
  const judgmentSection = extractSection(raw, "QA Judgment JSON");
  const jsonText = judgmentSection ? extractJsonFence(judgmentSection) : null;
  let findings: QaFinding[] = [];
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        findings = parsed
          .map((entry): QaFinding | null => {
            if (typeof entry !== "object" || entry === null) return null;
            const e = entry as Record<string, unknown>;
            const criterionId = typeof e.criterionId === "string" ? e.criterionId.trim() : "";
            if (!criterionId) return null;
            const status = QA_STATUSES.has(e.status as string) ? (e.status as QaFinding["status"]) : "needs-review";
            return {
              criterionId,
              status,
              verifiedBy: "judgment",
              evidence: "",
              detail: typeof e.detail === "string" ? e.detail.trim() : "",
              suggestedFix: typeof e.suggestedFix === "string" && e.suggestedFix.trim() ? e.suggestedFix.trim() : undefined,
            };
          })
          .filter((f): f is QaFinding => f !== null);
      }
    } catch {
      findings = [];
    }
  }

  const filesSection = extractSection(raw, "Files Read JSON");
  const filesJsonText = filesSection ? extractJsonFence(filesSection) : null;
  let subjectFiles: string[] = [];
  if (filesJsonText) {
    try {
      const parsedFiles = JSON.parse(filesJsonText);
      if (Array.isArray(parsedFiles)) {
        subjectFiles = parsedFiles.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      }
    } catch {
      subjectFiles = [];
    }
  }

  return {
    runId,
    subjectLabel,
    findings,
    subjectFiles,
    previewModulePath: `/src/accelerator/.generated/${runId}/qa/Preview.tsx`,
    raw,
  };
}

