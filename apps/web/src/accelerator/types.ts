/**
 * Two-phase journey. Phase 1 (analysis) is read-only and ends at the
 * `analysisReady` checkpoint — a real decision point where the user reviews
 * the AI's understanding and can revise prompt/sources before any
 * implementation time is spent. Only after confirmation does phase 2
 * (`generating`) write staged direction code.
 */
export type ToolState =
  | "intake"
  | "analyzing"
  | "analysisReady"
  | "analysisStopped"
  | "generating"
  | "directionsReady"
  | "implementing"
  | "implementationReady"
  | "implementationSuccess"
  | "error";

/** Which phase a background job belongs to — needed to resume/retry the right one. */
export type RunPhase = "understanding" | "directions";

export type SourceKind = "figma" | "ticket" | "component" | "internal-doc";

export type SourceEntry = {
  id: string;
  kind: SourceKind;
  value: string;
  context: string;
  ticketKey?: string;
  taskFolder?: string;
  /** Present for component sources — they always come from the connected Storybook. */
  storybook?: {
    url: string;
    componentPath: string;
    storyIds: string[];
    storyNames: string[];
    importPath?: string;
  };
};

export type DirectionComplexity = "low" | "medium" | "high";

/**
 * 'unavailable'  — mock mode, or the active engine can't edit real files (text-only proposal).
 * 'pending'      — a real preview module was declared but hasn't finished loading in the iframe yet.
 * 'ready'        — the preview module loaded and rendered.
 * 'failed'       — the preview module failed to load/render (shown honestly, never silently swapped for a fake image).
 */
export type DirectionPreviewStatus = "unavailable" | "pending" | "ready" | "failed";

export type Direction = {
  id: string;
  title: string;
  summary: string;
  /** 2-4 word comparison chips ("Safer", "CSS-only") — the at-a-glance identity of this direction. Empty for runs generated before the field existed. */
  highlights: string[];
  /** Why this approach was suggested — must trace back to the confirmed analysis, not restate the summary. */
  reasoning: string;
  /**
   * A short (2-6 word) name for the real trade-off this direction sits on —
   * e.g. "minimal change", "CSS-only", "new shared token", "long-term
   * maintainability". Empty for runs generated before this field existed.
   * This is the machine-checkable half of "why would I choose this one
   * instead of the other" — see directionQuality.ts, which uses it (plus
   * highlight/summary overlap) to catch directions that read as different
   * but aren't.
   */
  differentiationAxis: string;
  tradeoffs: string[];
  complexity: DirectionComplexity;
  affectedFiles: string[];
  confidence: number;
  /** True only when the model marked this as its own top pick. Never inferred from ordering. */
  recommended: boolean;
  /** Browser-importable module URL (e.g. /src/accelerator/.generated/run-x/direction-a/Preview.tsx), or null when no real preview exists. */
  previewModulePath: string | null;
  previewStatus: DirectionPreviewStatus;
  /** How this direction behaves from mobile to desktop width — wrapping, stacking, truncation, layout shifts. Empty string when the model didn't provide one. */
  responsiveNotes: string;
};

export type ChangeIntentType = "style-rule" | "behavior-rule" | "layout-rule" | "content-rule" | "unknown";

export type ChangeIntent = {
  targetComponent: string;
  changeType: ChangeIntentType;
  stateCondition: string;
  codeTargets: string[];
  proposedRule: string;
  confidence: number;
  assumptions: string[];
  followUpQuestions: string[];
};

export type AnalysisOutput = {
  summary: string;
  taskAnalysis: string;
  directions: Direction[];
  needMoreContext: string | null;
  changeIntent: ChangeIntent;
  detailedNotes: string;
  raw: string;
};

/**
 * The phase-1 output the user reviews at the checkpoint — the AI explaining
 * its reasoning BEFORE any implementation time is spent. Every field is
 * user-facing; parse defensively and show honest empties rather than
 * fabricating content.
 */
export type UnderstandingBrief = {
  /** What the AI understood the request to be. */
  summary: string;
  /** Why it interpreted the request that way. */
  interpretation: string;
  /** One entry per source it actually reviewed, with what that source contributed. */
  sourcesReviewed: string[];
  /** What it intends to change. */
  inScope: string[];
  /** What it deliberately will NOT change. */
  outOfScope: string[];
  assumptions: string[];
  /** Ambiguities or missing information the user should resolve or accept. */
  openQuestions: string[];
  risks: string[];
  changeIntent: ChangeIntent;
  raw: string;
};

export type StreamItem = {
  id: string;
  kind: "thinking" | "assistant" | "tool" | "status" | "error";
  text: string;
};

export type PreviewTarget = {
  id: string;
  label: string;
  reason: string;
};
