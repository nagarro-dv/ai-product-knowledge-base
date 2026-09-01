import type { VerificationKind } from "@ds-starter/standards";

export type { AcceleratorMode } from "@ds-starter/standards";
import type { AcceleratorMode } from "@ds-starter/standards";

/**
 * Journey states across all three modes. `intake` is the one idle screen —
 * a persistent mode tab bar plus that mode's slot-based form, no separate
 * landing page to click through first (see ModeTabs.tsx). Improve/Create:
 * intake -> analyzing -> analysisReady -> generating -> directionsReady ->
 * implementing -> implementationReady -> implementationSuccess. QA:
 * intake -> qaRunning -> qaReady.
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
  | "qaRunning"
  | "qaReady"
  | "error";

/** Which phase a background job belongs to — needed to resume/retry the right one. */
export type RunPhase = "understanding" | "directions" | "qa";

/** Where a source came from. */
export type SourceKind = "figma" | "ticket" | "component" | "doc" | "note";

/**
 * What a source is FOR — the half the prompt actually needs. The user never
 * picks this directly: it's implied by which labelled slot (see
 * modeSlots.ts) the source was dropped into.
 */
export type SourceRole =
  | "subject" // the thing being changed or QA'd. At most one. Resolves the preview target.
  | "requirement" // must be satisfied — a ticket, acceptance criteria, written spec
  | "reference" // draw from this, don't copy it — a Figma frame, a sibling component
  | "constraint" // must comply with this — a standards doc, a brand rule, a failing QA finding
  | "watch-out"; // the requester's flagged attention point

export type SourceEntry = {
  id: string;
  kind: SourceKind;
  role: SourceRole;
  value: string;
  context: string;
  /** Short human-readable preview shown on the source's chip — a ticket's title, a component's file path. */
  preview?: string;
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

/** A single labelled drop target on the intake screen. The role is fixed per slot — the user fills a box, not a taxonomy. */
export type SourceSlot = {
  id: string;
  label: string;
  hint: string;
  role: SourceRole;
  kinds: SourceKind[];
  max: number | "many";
  required: boolean;
  /** Free-text entry (e.g. "What should change") in addition to/instead of attachments. */
  allowFreeText: boolean;
};

export type ModePhase = { id: string; label: string };

export type ModeConfig = {
  mode: AcceleratorMode;
  title: string;
  provides: string;
  does: string;
  gets: string;
  disabled: boolean;
  slots: SourceSlot[];
  phases: ModePhase[];
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

/** A single QA verdict against one enabled criterion. verifiedBy must always be rendered distinctly — a measured result and a model opinion cannot look the same. */
export type QaFinding = {
  criterionId: string;
  status: "pass" | "fail" | "warning" | "not-applicable" | "needs-review";
  verifiedBy: VerificationKind;
  /** Concrete evidence for automated/assisted findings: a ratio, a selector, a file:line. Empty for pure judgment findings. */
  evidence: string;
  /** Plain-language explanation, same writing rules as the understanding brief. */
  detail: string;
  suggestedFix?: string;
};

export type QaReport = {
  runId: string;
  subjectLabel: string;
  findings: QaFinding[];
  /** Real repo-relative file(s) the agent actually read for the subject — feeds the orchestrator's static (file-content) checks. */
  subjectFiles: string[];
  /** Browser-importable module URL for the staged QA preview harness, or null before it's ready. */
  previewModulePath: string | null;
  raw: string;
};
