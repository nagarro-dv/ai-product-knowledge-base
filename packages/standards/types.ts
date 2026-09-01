/**
 * The three top-level intents the accelerator can run in. Owned here (not in
 * apps/web/src/accelerator/types.ts) because a Criterion's `appliesTo` field
 * needs the same type the UI branches on, and both the web app and the
 * orchestrator need to agree on it.
 */
export type AcceleratorMode = "create" | "improve" | "qa";

export type CriterionGroup = "accessibility" | "design-system" | "responsive" | "code-health";

/**
 * How a criterion's verdict is actually produced:
 * - "automated" — a runner produces pass/fail with concrete evidence (a
 *   contrast ratio, a selector, a file:line). No model involved.
 * - "assisted"  — a runner narrows candidates, a model adjudicates the rest
 *   (e.g. axe "incomplete" results that need visual judgment).
 * - "judgment"  — model opinion only. Must always be rendered distinctly
 *   from a measured result — see QaFinding.verifiedBy in accelerator/types.ts.
 */
export type VerificationKind = "automated" | "assisted" | "judgment";

export type CriterionSeverity = "blocker" | "major" | "minor";

export type CriterionOrigin = "builtin" | "repo";

export type Criterion = {
  id: string;
  group: CriterionGroup;
  /** Plain-language label, no bare standard citations (e.g. never "WCAG 2.5.7"). */
  title: string;
  /** What it actually requires, in ordinary words. */
  requirement: string;
  verification: VerificationKind;
  severity: CriterionSeverity;
  appliesTo: AcceleratorMode[];
  defaultEnabled: boolean;
  /** True only for criteria the UI refuses to let the user disable. See BASELINE_CRITERIA for which. */
  locked: boolean;
  /** How this criterion is phrased into a generation prompt's "Constraints you must comply with" section. */
  promptLine: string;
  /** Links to a runner (DOM check or static check) when verification !== "judgment". Absent for judgment-only criteria. */
  checkId?: string;
  origin: CriterionOrigin;
};

/** A criterion plus whether it's currently enabled for a given project/run — the only piece of state that isn't part of the catalog itself. */
export type CriterionWithState = Criterion & { enabled: boolean };

/** Per-project persisted standards state, keyed by connected repository in the orchestrator's .standards.json. */
export type ProjectStandardsState = {
  /** Ids of criteria (builtin or accepted repo) the project has explicitly disabled — everything else defaults on. */
  disabledIds: string[];
  /** Repo-derived criteria the user has reviewed and accepted into the project's active set. */
  acceptedRepoCriteria: Criterion[];
  /** Repo-derived criteria proposed by the one-shot repo scan, awaiting user review — never auto-applied. */
  proposedRepoCriteria: Criterion[];
};

export function emptyProjectStandardsState(): ProjectStandardsState {
  return { disabledIds: [], acceptedRepoCriteria: [], proposedRepoCriteria: [] };
}
