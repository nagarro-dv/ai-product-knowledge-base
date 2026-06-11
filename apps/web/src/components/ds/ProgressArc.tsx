import type { SVGAttributes } from "react";

import "./ProgressArc.css";

/** Figma **Progress Arc** — file `XLKRFXYtGQPPHD9cq4JNn8`, component set `3851:47112`.
 *  Variants: Default, Success, Warning, Error, Accent.
 *  Reuses `--ds-progress-linear-*` color tokens for fill and track.
 */

export type DsProgressArcVariant = "default" | "success" | "warning" | "error" | "accent";

export type DsProgressArcProps = Omit<SVGAttributes<SVGSVGElement>, "children"> & {
  /** Fill amount, **0–100**. Default: **75**. */
  value?: number;
  variant?: DsProgressArcVariant;
  /** Label shown at the left (start) end of the arc. */
  minLabel?: string;
  /** Label shown at the right (end) of the arc. */
  maxLabel?: string;
};

const CX = 139;
const CY = 128;
const R = 112;
const STROKE = 8;
const START_X = CX - R; // 27
const END_X = CX + R;   // 251
const ARC_PATH = `M ${START_X},${CY} A ${R},${R} 0 0,1 ${END_X},${CY}`;
const TOTAL = Math.PI * R; // ~351.9px

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Figma **Progress Arc** — semicircular gauge with 5 colour variants.
 * `value` is 0–100 (percent). Labels at left/right ends default to `"0"` / `"999"`.
 */
export function DsProgressArc({
  className,
  value = 75,
  variant = "default",
  minLabel = "0",
  maxLabel = "999",
  "aria-label": ariaLabel,
  ...rest
}: DsProgressArcProps) {
  const pct = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const filled = (pct / 100) * TOTAL;

  return (
    <svg
      className={[`ds-progress-arc`, `ds-progress-arc--${variant}`, className].filter(Boolean).join(" ")}
      viewBox="0 0 278 155"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      role="progressbar"
      aria-label={ariaLabel ?? "Progress"}
      data-component="progress-arc"
      data-figma-node="3851:47112"
      data-variant={variant}
      {...rest}
    >
      {/* Track */}
      <path
        className="ds-progress-arc__track"
        d={ARC_PATH}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        className="ds-progress-arc__fill"
        d={ARC_PATH}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${TOTAL}`}
      />
      {/* Min label — centered under left endpoint */}
      <text
        className="ds-progress-arc__label"
        x={START_X}
        y={148}
        textAnchor="middle"
      >
        {minLabel}
      </text>
      {/* Max label — centered under right endpoint */}
      <text
        className="ds-progress-arc__label"
        x={END_X}
        y={148}
        textAnchor="middle"
      >
        {maxLabel}
      </text>
    </svg>
  );
}
