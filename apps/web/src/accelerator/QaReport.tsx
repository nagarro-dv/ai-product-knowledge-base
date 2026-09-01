import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { CriterionWithState } from "@ds-starter/standards";
import { DsAccordion } from "../components/ds/Accordion";
import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import { QaPreviewFrame } from "./QaPreviewFrame";
import type { PreviewFrameQaFinding } from "./previewFrameProtocol";
import type { QaFinding, QaReport as QaReportData } from "./types";
import "./QaReport.css";

export type QaReportProps = {
  report: QaReportData;
  criteria: CriterionWithState[];
  /** Static (file-content) findings from the orchestrator, or null while still loading. */
  staticFindings: QaFinding[] | null;
  onFixFindings: (failed: QaFinding[]) => void;
};

function mergeDomFinding(finding: PreviewFrameQaFinding): QaFinding {
  return { ...finding, verifiedBy: "automated" };
}

const DOM_CHECK_IDS = new Set([
  "a11y-contrast",
  "a11y-accessible-name",
  "a11y-keyboard-operable",
  "a11y-target-size",
  "dom-horizontal-overflow",
  "dom-layout-collapse",
]);

const STATUS_ICON: Record<QaFinding["status"], typeof CheckCircle2> = {
  pass: CheckCircle2,
  fail: XCircle,
  warning: AlertTriangle,
  "needs-review": CircleHelp,
  "not-applicable": CircleHelp,
};

const STATUS_LABEL: Record<QaFinding["status"], string> = {
  pass: "Passed",
  fail: "Failed",
  warning: "Warning",
  "needs-review": "Needs review",
  "not-applicable": "Not applicable",
};

function FindingCard({ finding, criteria }: { finding: QaFinding; criteria: CriterionWithState[] }) {
  const criterion = criteria.find((c) => c.id === finding.criterionId);
  const Icon = STATUS_ICON[finding.status];
  const judged = finding.verifiedBy === "judgment";
  return (
    <div className={`qaReport__card qaReport__card--${finding.status}`}>
      <div className="qaReport__cardHeader">
        <Icon size={14} aria-hidden />
        <DsTypography as="span" variant="paragraph-mini-bold" className="qaReport__cardStatus">
          {STATUS_LABEL[finding.status]}
        </DsTypography>
        <span className={`qaReport__verifiedBadge qaReport__verifiedBadge--${judged ? "judged" : "measured"}`}>
          {judged ? "AI opinion" : "measured"}
        </span>
      </div>
      <DsTypography as="p" variant="paragraph-small-bold" className="qaReport__cardTitle">
        {criterion?.title ?? finding.criterionId}
      </DsTypography>
      {judged ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="qaReport__assessedNote">
          assessed, not measured
        </DsTypography>
      ) : null}
      {finding.evidence ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="qaReport__evidence">
          {finding.evidence}
        </DsTypography>
      ) : null}
      <DsTypography as="p" variant="paragraph-small" className="qaReport__detail">
        {finding.detail}
      </DsTypography>
      {finding.suggestedFix ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="qaReport__fix">
          Fix: {finding.suggestedFix}
        </DsTypography>
      ) : null}
    </div>
  );
}

/**
 * The screen that has to earn the word "QA". Measured (automated/assisted)
 * and judged (model opinion) findings are rendered with visibly different
 * treatment everywhere — a badge on every card, plus an explicit "assessed,
 * not measured" line on judged ones — so neither is ever mistaken for the
 * other.
 */
export function QaReport({ report, criteria, staticFindings, onFixFindings }: QaReportProps) {
  const [domFindings, setDomFindings] = useState<PreviewFrameQaFinding[] | null>(null);
  const [previewFailed, setPreviewFailed] = useState<string | null>(null);

  const enabledDomCriteriaIds = useMemo(
    () => criteria.filter((c) => c.enabled && c.checkId && DOM_CHECK_IDS.has(c.checkId)).map((c) => c.id),
    [criteria],
  );

  const allFindings: QaFinding[] = useMemo(() => {
    const combined = [...report.findings, ...(staticFindings ?? []), ...(domFindings ?? []).map(mergeDomFinding)];
    // A criterion should appear once — later entries (static/DOM, which run
    // after the model's judgment pass) win if a criterion was somehow judged
    // AND measured, since a real runner is always more trustworthy than an opinion.
    const byId = new Map<string, QaFinding>();
    for (const finding of combined) byId.set(finding.criterionId, finding);
    return Array.from(byId.values());
  }, [report.findings, staticFindings, domFindings]);

  const failed = allFindings.filter((f) => f.status === "fail");
  const needsReview = allFindings.filter((f) => f.status === "needs-review" || f.status === "warning");
  const passed = allFindings.filter((f) => f.status === "pass" || f.status === "not-applicable");
  const total = allFindings.length;
  const stillLoading = staticFindings === null || domFindings === null;

  return (
    <section className="qaReport" aria-label="QA report">
      <div className="qaReport__summary">
        <DsTypography as="p" variant="paragraph-bold">
          {stillLoading
            ? "Checking…"
            : `${failed.length} failed · ${needsReview.length} needs review · ${passed.length} passed`}
        </DsTypography>
        {total > 0 ? (
          <div className="qaReport__summaryBar" aria-hidden>
            <span className="qaReport__summaryBar--fail" style={{ flexGrow: failed.length || 0 }} />
            <span className="qaReport__summaryBar--review" style={{ flexGrow: needsReview.length || 0 }} />
            <span className="qaReport__summaryBar--pass" style={{ flexGrow: passed.length || 0 }} />
          </div>
        ) : null}
      </div>

      <div className="qaReport__columns">
        <div className="qaReport__previewColumn">
          <DsTypography as="h3" variant="paragraph-small-bold">
            {report.subjectLabel}
          </DsTypography>
          {report.previewModulePath ? (
            <QaPreviewFrame
              modulePath={report.previewModulePath}
              enabledCriteriaIds={enabledDomCriteriaIds}
              onResult={(result) => {
                if (result.status === "ready") setDomFindings(result.findings);
                else {
                  setDomFindings([]);
                  setPreviewFailed(result.message ?? "The preview couldn't be mounted.");
                }
              }}
            />
          ) : null}
          {previewFailed ? (
            <DsTypography as="p" variant="paragraph-mini-regular" role="alert">
              {previewFailed} — measured findings may be incomplete.
            </DsTypography>
          ) : null}
        </div>

        <div className="qaReport__findingsColumn">
          {failed.map((finding) => (
            <FindingCard key={finding.criterionId} finding={finding} criteria={criteria} />
          ))}
          {needsReview.map((finding) => (
            <FindingCard key={finding.criterionId} finding={finding} criteria={criteria} />
          ))}
          {passed.length > 0 ? (
            <DsAccordion variant="ghost" size="small" title={`${passed.length} passed`} defaultOpen={false}>
              <div className="qaReport__passedList">
                {passed.map((finding) => (
                  <FindingCard key={finding.criterionId} finding={finding} criteria={criteria} />
                ))}
              </div>
            </DsAccordion>
          ) : null}
        </div>
      </div>

      <div className="qaReport__actions">
        <DsButton
          variant="primary"
          size="regular"
          onClick={() => onFixFindings(failed)}
          disabled={stillLoading || failed.length === 0}
        >
          Fix these findings →
        </DsButton>
      </div>
    </section>
  );
}
