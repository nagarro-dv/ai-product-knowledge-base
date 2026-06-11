/**
 * DS Credit Score
 * Figma component def: XLKRFXYtGQPPHD9cq4JNn8, node 2033:70750
 *
 * Card: 1px gradient/intelligence border, background, padding-3xl, overflow-clip.
 * Gauge: 278×143px container (143 for 4px stroke bleed). Arc center (139,139), r=130, stroke=16.
 * Trend overlay: absolute left 85px / top 40px (Figma 2033:70724).
 * Balance overlay: absolute top 64px / left 0 / width 278px (Figma 2033:70726).
 */

import { DsProgressArc, type DsProgressArcVariant } from "./ProgressArc";
import { DsTypography } from "./DsTypography";
import "./CreditScore.css";

export type DsCreditScoreProps = {
  score?: number;
  maxScore?: number;
  label?: string;
  provider?: string;
  trend?: string;
  badge?: string;
  updatedOn?: string;
  className?: string;
};

function getCreditScoreVariant(badge: string): { arc: DsProgressArcVariant; badgeClass: string } {
  const normalized = badge.trim().toLowerCase();
  if (normalized.includes("poor")) {
    return { arc: "error", badgeClass: "ds-credit-score__badge--destructive" };
  }
  if (normalized.includes("fair")) {
    return { arc: "warning", badgeClass: "ds-credit-score__badge--warning" };
  }
  return { arc: "success", badgeClass: "ds-credit-score__badge--success" };
}

export function DsCreditScore({
  score = 724,
  maxScore = 999,
  label = "Your credit score",
  provider = "Experian (UK)",
  trend = "↑ 12 pts this month",
  badge = "Good",
  updatedOn = "Updated on: 9 Mar 2026",
  className = "",
}: DsCreditScoreProps) {
  const value = Math.round(Math.max(0, Math.min(score, maxScore)) / maxScore * 100);
  const { arc: arcVariant, badgeClass } = getCreditScoreVariant(badge);

  return (
    <div
      className={["ds-credit-score", className].filter(Boolean).join(" ")}
      data-component="credit-score"
      data-figma-node="2033:70750"
    >
      {/* Main Container 2033:70712 */}
      <div className="ds-credit-score__inner">

        {/* Header 2033:70713 — flex col, gap-md (8px), items-start */}
        <div className="ds-credit-score__header" data-figma-node="2033:70713">
          {/* Row 1 — InsightsBalance 2033:70714 */}
          <div className="ds-credit-score__header-row" data-figma-node="2033:70714">
            <div className="ds-credit-score__header-frame" data-figma-node="2033:70715">
              <DsTypography as="span" variant="paragraph-small-medium" className="ds-credit-score__label" data-figma-node="2033:70717">
                {label}
              </DsTypography>
            </div>
          </div>
          {/* Row 2 — InsightsBalance 2033:70718 */}
          <div className="ds-credit-score__header-row" data-figma-node="2033:70718">
            <DsTypography as="span" variant="paragraph-mini-bold" className="ds-credit-score__provider" data-figma-node="2033:70719">
              {provider}
            </DsTypography>
          </div>
        </div>

        {/* Gauge 2033:70720 — h-139px w-278px, relative */}
        <div className="ds-credit-score__gauge" data-figma-node="2033:70720">
          <DsProgressArc
            className="ds-credit-score__progress-arc"
            value={value}
            variant={arcVariant}
            minLabel="0"
            maxLabel={String(maxScore)}
            width={278}
            height={155}
            aria-label={`Credit score progress: ${value}%`}
          />

          {/* Trend — Figma 2033:70724: absolute left:85px top:40px */}
          <div className="ds-credit-score__trend-wrap" data-figma-node="2033:70724" aria-hidden>
            <DsTypography as="span" variant="paragraph-mini-medium" className="ds-credit-score__trend">
              {trend}
            </DsTypography>
          </div>

          {/* Balance Container — Figma 2033:70726: absolute top:64px left:0 w:278px */}
          <div className="ds-credit-score__balance" data-figma-node="2033:70726" aria-hidden>
            {/* Primary Currency Container 2033:70727 */}
            <div className="ds-credit-score__score-row" data-figma-node="2033:70727">
              <DsTypography as="span" variant="heading-1" className="ds-credit-score__number" data-figma-node="2033:70729">
                {score}
              </DsTypography>
            </div>
            {/* Secondary Currency Container 2033:70730 */}
            <div className="ds-credit-score__badge-row" data-figma-node="2033:70730">
              <DsTypography
                as="span"
                variant="paragraph-mini-bold"
                className={`ds-credit-score__badge ${badgeClass}`}
                data-figma-node="2033:70731"
              >
                {badge}
              </DsTypography>
            </div>
          </div>

        </div>

        {/* Footer 2033:70734 — flex, justify-center */}
        <DsTypography as="p" variant="paragraph-mini-medium" className="ds-credit-score__updated" data-figma-node="2033:70734">
          {updatedOn}
        </DsTypography>

      </div>
    </div>
  );
}
