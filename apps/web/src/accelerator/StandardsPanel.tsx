import { AlertTriangle, ChevronRight, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { groupCriteria, type CriterionGroup, type CriterionWithState, type VerificationKind } from "@ds-starter/standards";
import { DsButton } from "../components/ds/Button";
import { DsCheckbox } from "../components/ds/Checkbox";
import { DsIconButton } from "../components/ds/IconButton";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import "./StandardsPanel.css";

const GROUP_LABEL: Record<CriterionGroup, string> = {
  accessibility: "Accessibility",
  "design-system": "Design system",
  responsive: "Responsive",
  "code-health": "Code health",
};

const GROUP_ORDER: CriterionGroup[] = ["accessibility", "design-system", "responsive", "code-health"];

const VERIFICATION_LABEL: Record<VerificationKind, string> = {
  automated: "measured",
  assisted: "measured",
  judgment: "judged",
};

function VerificationBadge({ kind }: { kind: VerificationKind }) {
  return (
    <span className={`standardsPanel__badge standardsPanel__badge--${kind === "judgment" ? "judged" : "measured"}`}>
      {VERIFICATION_LABEL[kind]}
    </span>
  );
}

export type StandardsPanelProps = {
  criteria: CriterionWithState[];
  onToggle: (id: string) => void;
  /** "What to check" (QA) vs "Quality checklist" (Create/Improve) — same data, different framing. */
  heading: string;
  loading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
};

/**
 * The default-on quality checklist. Collapsed by default — everything in it
 * is already on, so most runs never need to open it; the summary line makes
 * that state legible without spending screen space on the full list. Opens
 * as a side panel rather than expanding in place — the full criteria list
 * (11 rows across 4 groups) pushed the rest of the intake form down by a
 * screen's worth when it expanded inline, which read as the form itself
 * changing shape rather than a review layer momentarily on top of it. Every
 * row, once opened, shows whether it will be MEASURED (a real runner) or
 * JUDGED (a model opinion) — that distinction is made at intake, not just in
 * the eventual report, so unchecking a box never carries a false expectation
 * of verification either way.
 */
export function StandardsPanel({ criteria, onToggle, heading, loading, errorMessage, onRetry }: StandardsPanelProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grouped = groupCriteria(criteria);
  const enabledCount = criteria.filter((c) => c.enabled).length;
  const measuredCount = criteria.filter((c) => c.verification !== "judgment").length;
  const judgedCount = criteria.length - measuredCount;

  const summary = loading ? (
    <DsSpinner size={12} aria-hidden />
  ) : errorMessage ? (
    <span className="standardsPanel__summaryError">
      <AlertTriangle size={12} aria-hidden />
      Couldn't load
    </span>
  ) : (
    <DsTypography as="span" variant="paragraph-mini-regular" className="standardsPanel__count">
      {enabledCount} of {criteria.length} selected
    </DsTypography>
  );

  const titleId = "standards-panel-title";

  return (
    <div className="standardsPanel">
      <button
        ref={triggerRef}
        type="button"
        className="standardsPanel__trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <DsTypography as="span" variant="paragraph-small-medium" className="standardsPanel__triggerTitle">
          {heading}
        </DsTypography>
        <span className="standardsPanel__triggerSummary">
          {summary}
          <ChevronRight size={14} aria-hidden />
        </span>
      </button>

      {open ? (
        <div className="standardsPanel__drawerRoot" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button type="button" className="standardsPanel__drawerBackdrop" aria-label="Close" onClick={close} />
          <div className="standardsPanel__drawer">
            <header className="standardsPanel__drawerHeader">
              <DsTypography as="h2" id={titleId} variant="heading-5">
                {heading}
              </DsTypography>
              <DsIconButton ref={closeButtonRef} variant="ghost" size="small" aria-label="Close" onClick={close}>
                <X size={16} aria-hidden />
              </DsIconButton>
            </header>

            <div className="standardsPanel__drawerBody">
              {loading ? (
                <div className="standardsPanel__statusState" role="status">
                  <DsSpinner size={14} aria-hidden />
                  <DsTypography as="p" variant="paragraph-small">
                    Loading…
                  </DsTypography>
                </div>
              ) : errorMessage ? (
                <div className="standardsPanel__statusState standardsPanel__statusState--error" role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <DsTypography as="p" variant="paragraph-small">
                    {errorMessage}
                  </DsTypography>
                  {onRetry ? (
                    <DsButton variant="secondary" size="mini" onClick={onRetry}>
                      Retry
                    </DsButton>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="standardsPanel__groups">
                    {GROUP_ORDER.filter((group) => (grouped.get(group)?.length ?? 0) > 0).map((group) => {
                      const items = grouped.get(group) ?? [];
                      const enabledInGroup = items.filter((c) => c.enabled).length;
                      return (
                        <div key={group} className="standardsPanel__group">
                          <div className="standardsPanel__groupHeader">
                            <DsTypography as="span" variant="paragraph-small-bold">
                              {GROUP_LABEL[group]}
                            </DsTypography>
                            <DsTypography as="span" variant="paragraph-mini-regular" className="standardsPanel__groupCount">
                              {enabledInGroup}/{items.length}
                            </DsTypography>
                          </div>
                          <ul className="standardsPanel__list">
                            {items.map((criterion) => (
                              <li key={criterion.id}>
                                <button
                                  type="button"
                                  className="standardsPanel__row"
                                  onClick={() => onToggle(criterion.id)}
                                  disabled={criterion.locked}
                                  aria-pressed={criterion.enabled}
                                >
                                  <DsCheckbox
                                    checked={criterion.enabled}
                                    state={criterion.locked ? "disabled" : "default"}
                                    interactive={false}
                                    aria-label={criterion.title}
                                  />
                                  {criterion.locked ? (
                                    <Lock size={11} aria-hidden className="standardsPanel__lockIcon" />
                                  ) : null}
                                  <DsTypography as="span" variant="paragraph-small" className="standardsPanel__rowTitle">
                                    {criterion.title}
                                  </DsTypography>
                                  <VerificationBadge kind={criterion.verification} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <DsTypography as="p" variant="paragraph-mini-regular" className="standardsPanel__legend">
                    {measuredCount} measured · {judgedCount} judged
                    {criteria.some((c) => c.locked) ? (
                      <>
                        {" "}
                        · <Lock size={10} aria-hidden className="standardsPanel__lockIcon" /> required, can't be turned off
                      </>
                    ) : null}
                  </DsTypography>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
