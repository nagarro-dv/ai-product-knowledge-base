import type { HTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import { DsTypography } from "./DsTypography";
import "./ProgressLinear.css";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Figma **ProgressLinear** `variant` — component set **2053:3292**. */
export type DsProgressLinearVariant = "primary" | "warning" | "error" | "success" | "accent" | "neutral";

export type DsProgressLinearProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Filled amount, **0–100** (code uses a real bar width; no Figma padding trick). */
  value: number;
  variant?: DsProgressLinearVariant;
  /**
   * When **true**, renders the label row (Figma `labels`). When **false**, only the track is shown.
   * Default **true** to match Figma’s default instance.
   */
  showLabel?: boolean;
  /** Left column when `showLabel` is true. */
  label?: ReactNode;
  /** Right column when `showLabel` is true; defaults to **`{rounded}%`**. */
  valueLabel?: ReactNode;
};

/**
 * Figma **Progress Linear** — file `8Ry9Oa2niLBGvoWPo9rLQT`, component set **2053:3292**.
 * Variants: Primary, Warning, Error, Success, Accent, Neutral. Optional label row; track + fill use **progress-linear** tokens.
 * The track spans the **full width** of its parent (`max-width: 100%`); when `showLabel` is true, the **value** column defaults to **`{rounded}%`**.
 */
export function DsProgressLinear({
  className,
  value,
  variant = "primary",
  showLabel = true,
  label = "Label",
  valueLabel,
  id,
  "aria-label": ariaLabel,
  ...rest
}: DsProgressLinearProps) {
  const uid = useId();
  const pct = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const rounded = Math.round(pct);
  const displayValue = valueLabel ?? `${rounded}%`;
  const labelId = showLabel ? (id != null ? `${id}-label` : `${uid}-label`) : undefined;
  const valueId = showLabel ? (id != null ? `${id}-value` : `${uid}-value`) : undefined;
  const barLabelledBy =
    showLabel && labelId && valueId ? `${labelId} ${valueId}` : undefined;
  const barAriaLabel = showLabel ? undefined : (ariaLabel ?? "Progress");

  return (
    <div
      className={cx("ds-progress-linear", className)}
      data-component="progress-linear"
      data-figma-node="2053:3292"
      data-variant={variant}
      id={id}
      {...rest}
    >
      {showLabel ? (
        <div className="ds-progress-linear__meta" data-figma-region="label-value">
          <div className="ds-progress-linear__meta-start">
            <DsTypography as="p" variant="paragraph-small-medium" className="ds-progress-linear__title" id={labelId}>
              {label}
            </DsTypography>
          </div>
          <div className="ds-progress-linear__meta-end">
            <DsTypography as="p" variant="paragraph-regular" className="ds-progress-linear__value" id={valueId}>
              {displayValue}
            </DsTypography>
          </div>
        </div>
      ) : null}

      <div
        className="ds-progress-linear__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-label={barAriaLabel}
        aria-labelledby={barLabelledBy}
        data-figma-region="track"
      >
        <div
          className="ds-progress-linear__fill"
          style={{ width: `${pct}%` }}
          data-figma-region="fill"
        />
      </div>
    </div>
  );
}
