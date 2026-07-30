/**
 * DS Credit Score — Circular variant (Direction A)
 * Alternative to `DsCreditScore` (Figma component def XLKRFXYtGQPPHD9cq4JNn8, node 2033:70750)
 * that swaps the semicircular `DsProgressArc` gauge for a full 360° `DsProgressCircle`
 * ring. The original `DsCreditScore` (CreditScore.tsx) is left completely untouched —
 * this is a standalone, drop-in alternative that keeps the same public props and the
 * same card shell (gradient border, spacing, typography scale) so it can be swapped in
 * without any layout regressions elsewhere in the BFSI product experience.
 *
 * Accessibility note: unlike the original, where the score/trend/badge overlay is
 * `aria-hidden` and only the arc's `aria-label` ("Credit score progress: NN%") reaches
 * assistive tech, here the ring is the decorative element (`aria-hidden="true"`) and the
 * score, provider, trend, badge and range are all *real* readable text in DOM order —
 * so screen reader users get the actual score and status, not just a percentage.
 */

import { DsProgressCircle, type DsProgressCircleVariant } from "./ProgressCircle";
import { DsTypography } from "./DsTypography";
import "./CreditScoreCircular.css";

export type DsCreditScoreCircularProps = {
  score?: number;
  maxScore?: number;
  label?: string;
  provider?: string;
  trend?: string;
  badge?: string;
  updatedOn?: string;
  className?: string;
};

function getCreditScoreVariant(badge: string): {
  ring: DsProgressCircleVariant;
  badgeClass: string;
} {
  const normalized = badge.trim().toLowerCase();
  if (normalized.includes("poor")) {
    return { ring: "error", badgeClass: "ds-credit-score-circular__badge--destructive" };
  }
  if (normalized.includes("fair")) {
    return { ring: "warning", badgeClass: "ds-credit-score-circular__badge--warning" };
  }
  return { ring: "success", badgeClass: "ds-credit-score-circular__badge--success" };
}

export function DsCreditScoreCircular({
  score = 724,
  maxScore = 999,
  label = "Your credit score",
  provider = "Experian (UK)",
  trend = "↑ 12 pts this month",
  badge = "Good",
  updatedOn = "Updated on: 9 Mar 2026",
  className = "",
}: DsCreditScoreCircularProps) {
  const value = Math.round((Math.max(0, Math.min(score, maxScore)) / maxScore) * 100);
  const { ring: ringVariant, badgeClass } = getCreditScoreVariant(badge);

  return (
    <div
      className={["ds-credit-score-circular", className].filter(Boolean).join(" ")}
      data-component="credit-score-circular"
      data-figma-node="2033:70750"
    >
      <div className="ds-credit-score-circular__inner">
        {/* Header — mirrors DsCreditScore header structure */}
        <div className="ds-credit-score-circular__header">
          <div className="ds-credit-score-circular__header-row">
            <DsTypography as="span" variant="paragraph-small-medium" className="ds-credit-score-circular__label">
              {label}
            </DsTypography>
          </div>
          <div className="ds-credit-score-circular__header-row">
            <DsTypography as="span" variant="paragraph-mini-bold" className="ds-credit-score-circular__provider">
              {provider}
            </DsTypography>
          </div>
        </div>

        {/* Gauge — full 360° ring (decorative) + centered, readable text overlay */}
        <div className="ds-credit-score-circular__gauge">
          <DsProgressCircle
            className="ds-credit-score-circular__ring"
            value={value}
            variant={ringVariant}
            size={200}
            strokeWidth={14}
            aria-hidden="true"
            focusable="false"
          />

          <div className="ds-credit-score-circular__content">
            <DsTypography as="span" variant="paragraph-mini-medium" className="ds-credit-score-circular__trend">
              {trend}
            </DsTypography>
            <DsTypography as="span" variant="heading-1" className="ds-credit-score-circular__number">
              {score}
            </DsTypography>
            <DsTypography
              as="span"
              variant="paragraph-mini-bold"
              className={`ds-credit-score-circular__badge ${badgeClass}`}
            >
              {badge}
            </DsTypography>
          </div>

          {/* Range labels — readable text under the ring, same intent as the arc's min/max endpoints */}
          <div className="ds-credit-score-circular__range" aria-hidden="true">
            <span className="ds-credit-score-circular__range-min">0</span>
            <span className="ds-credit-score-circular__range-max">{maxScore}</span>
          </div>
        </div>

        {/* Footer */}
        <DsTypography as="p" variant="paragraph-mini-medium" className="ds-credit-score-circular__updated">
          {updatedOn}
        </DsTypography>
      </div>
    </div>
  );
}
