export { BASELINE_CRITERIA } from "./catalog";
export {
  emptyProjectStandardsState,
  type AcceleratorMode,
  type Criterion,
  type CriterionGroup,
  type CriterionOrigin,
  type CriterionSeverity,
  type CriterionWithState,
  type ProjectStandardsState,
  type VerificationKind,
} from "./types";

import { BASELINE_CRITERIA } from "./catalog";
import type { AcceleratorMode, Criterion, CriterionWithState, ProjectStandardsState } from "./types";

/** The full catalog for a project: baseline + whatever repo-derived criteria have been accepted. Proposed-but-unaccepted criteria are never included. */
export function activeCatalog(state: ProjectStandardsState): Criterion[] {
  return [...BASELINE_CRITERIA, ...state.acceptedRepoCriteria];
}

/** Resolves each criterion's live enabled/disabled state for this project. Locked criteria are always enabled regardless of `disabledIds`. */
export function resolveCriteria(state: ProjectStandardsState): CriterionWithState[] {
  const disabled = new Set(state.disabledIds);
  return activeCatalog(state).map((criterion) => ({
    ...criterion,
    enabled: criterion.locked ? true : !disabled.has(criterion.id),
  }));
}

/** Criteria relevant to a given mode's checklist, already resolved for enabled state. */
export function criteriaForMode(state: ProjectStandardsState, mode: AcceleratorMode): CriterionWithState[] {
  return resolveCriteria(state).filter((criterion) => criterion.appliesTo.includes(mode));
}

/** Only the criteria that should actually shape a generation prompt or a QA run — enabled, and relevant to this mode. */
export function enabledCriteriaForMode(state: ProjectStandardsState, mode: AcceleratorMode): CriterionWithState[] {
  return criteriaForMode(state, mode).filter((criterion) => criterion.enabled);
}

export function groupCriteria<T extends Criterion>(criteria: T[]): Map<T["group"], T[]> {
  const groups = new Map<T["group"], T[]>();
  for (const criterion of criteria) {
    const bucket = groups.get(criterion.group);
    if (bucket) bucket.push(criterion);
    else groups.set(criterion.group, [criterion]);
  }
  return groups;
}
