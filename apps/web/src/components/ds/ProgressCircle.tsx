import type { SVGAttributes } from "react";

import "./ProgressCircle.css";

/**
 * DS Progress Circle — new primitive, sibling to `DsProgressArc` / `DsProgressLinear`.
 * Full 360° circular progress ring, drawn clockwise from the 12 o'clock position.
 * Reuses `--ds-progress-linear-*` color tokens for fill/track, same as `DsProgressArc`,
 * so it drops into any surface already themed for the existing progress family.
 *
 * This component renders the ring only (no label text) — consumers that need
 * centered content (e.g. `DsCreditScoreCircular`) layer it on top via an
 * absolutely-positioned sibling, exactly like `DsCreditScore` layers text over
 * `DsProgressArc` today.
 */

export type DsProgressCircleVariant = "default" | "success" | "warning" | "error" | "accent";

export type DsProgressCircleProps = Omit<SVGAttributes<SVGSVGElement>, "children" | "value"> & {
  /** Fill amount, **0–100**. Default: **75**. */
  value?: number;
  variant?: DsProgressCircleVariant;
  /** Ring diameter in px. Default: **200**. */
  size?: number;
  /** Ring stroke width in px. Default: **14**. */
  strokeWidth?: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * DS **Progress Circle** — full circular gauge with 5 colour variants, matching
 * the visual language of `DsProgressArc`. `value` is 0–100 (percent).
 */
export function DsProgressCircle({
  className,
  value = 75,
  variant = "default",
  size = 200,
  strokeWidth = 14,
  "aria-label": ariaLabel,
  "aria-valuetext": ariaValueText,
  ...rest
}: DsProgressCircleProps) {
  const pct = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  return (
    <svg
      className={[`ds-progress-circle`, `ds-progress-circle--${variant}`, className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${size} ${size}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={ariaValueText}
      role="progressbar"
      aria-label={ariaLabel ?? "Progress"}
      data-component="progress-circle"
      data-variant={variant}
      {...rest}
    >
      {/* Track */}
      <circle
        className="ds-progress-circle__track"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
      />
      {/* Fill — starts at 12 o'clock, fills clockwise */}
      <circle
        className="ds-progress-circle__fill"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}
