import { useState, useCallback } from "react";
import { Info } from "lucide-react";

import { Widget } from "./Widget";
import { DsSlider, type DsSliderTripleRangeProps } from "./Slider";
import { DsButton } from "./Button";
import { DsTypography } from "./DsTypography";
import "./FlexibleRange.css";

/**
 * FlexibleRange — Figma XLKRFXYtGQPPHD9cq4JNn8, node 4138:59185.
 * A self-contained Widget card with a triple-range slider controlling
 * three live values (min / default / max), a "Reset to Recommendation" action,
 * and an "Apply" action that activates once values drift from the recommendation.
 *
 * Structure (strictly mirrors Figma layer order):
 *   1. Header — title + info icon button
 *   2. Divider
 *   3. Body
 *      a. Instruction text
 *      b. Triple-range Slider (Min=Round · Default=Diamond · Max=Round)
 *      c. 3-column Amounts (Min / Default / Max) — value display inputs
 *      d. "Reset to Recommendation" ghost button (full width)
 *   4. Footer divider
 *   5. "Apply" secondary button (full width, disabled until values change)
 */

export type DsFlexibleRangeValue = [number, number, number];

export type DsFlexibleRangeProps = {
  /** Card title. Figma default: "Monthly flexibility range" */
  title?: string;
  /** Instruction copy below the title divider. */
  instruction?: string;
  /** Column labels for [min, default, max]. Figma: ["Min", "Default", "Max"] */
  columnLabels?: [string, string, string];
  /**
   * The recommended/preset values [min, default, max].
   * Used as the initial state and the target for "Reset to Recommendation".
   */
  recommended: DsFlexibleRangeValue;
  /** Slider absolute minimum. */
  min?: number;
  /** Slider absolute maximum. */
  max?: number;
  /** Slider step. */
  step?: number;
  /** Currency / unit prefix shown in value displays. */
  currency?: string;
  /** Controlled current value. Omit for uncontrolled (internal state). */
  value?: DsFlexibleRangeValue;
  /** Called on every slider drag. */
  onChange?: (value: DsFlexibleRangeValue) => void;
  /** Called when Apply is clicked. */
  onApply?: (value: DsFlexibleRangeValue) => void;
  disabled?: boolean;
  className?: string;
};

function valuesEqual(a: DsFlexibleRangeValue, b: DsFlexibleRangeValue) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function formatValue(v: number, currency: string) {
  return `${currency}${v}`;
}

export function DsFlexibleRange({
  title = "Monthly flexibility range",
  instruction = "Set how much you usually save — and how far it can flex when needed",
  columnLabels = ["Min", "Default", "Max"],
  recommended,
  min = 0,
  max = 1000,
  step = 1,
  currency = "€",
  value: controlledValue,
  onChange,
  onApply,
  disabled = false,
  className,
}: DsFlexibleRangeProps) {
  const isControlled = controlledValue !== undefined;

  const [internalValue, setInternalValue] = useState<DsFlexibleRangeValue>(recommended);
  const currentValue = isControlled ? controlledValue : internalValue;

  const isDirty = !valuesEqual(currentValue, recommended);

  const handleChange = useCallback(
    (v: [number, number, number]) => {
      if (!isControlled) setInternalValue(v);
      onChange?.(v);
    },
    [isControlled, onChange],
  );

  const handleReset = useCallback(() => {
    if (!isControlled) setInternalValue(recommended);
    onChange?.(recommended);
  }, [isControlled, onChange, recommended]);

  const handleApply = useCallback(() => {
    onApply?.(currentValue);
  }, [onApply, currentValue]);

  const sliderProps: DsSliderTripleRangeProps = {
    type: "triple-range",
    value: currentValue,
    onChange: handleChange as (v: [number, number, number]) => void,
    min,
    max,
    step,
    disabled,
    "aria-label": title,
    minThumbAriaLabel: `${columnLabels[0]} value`,
    maxThumbAriaLabel: `${columnLabels[2]} value`,
  };

  return (
    <Widget
      surfaceStyle="flat"
      background="default"
      className={["ds-flexible-range", className].filter(Boolean).join(" ")}
      data-component="flexible-range"
      data-figma-file="XLKRFXYtGQPPHD9cq4JNn8"
      data-figma-node="4138:59185"
    >
      {/* ── 1. Header ── */}
      <div className="ds-flexible-range__header">
        <DsTypography
          as="h3"
          variant="paragraph-medium"
          className="ds-flexible-range__title"
        >
          {title}
        </DsTypography>

        <button
          className="ds-flexible-range__info-btn"
          aria-label="More information"
          type="button"
          tabIndex={0}
        >
          <Info
            size={18}
            className="ds-flexible-range__info-icon"
            aria-hidden
          />
        </button>
      </div>

      {/* ── 2. Divider ── */}
      <div className="ds-flexible-range__divider" aria-hidden />

      {/* ── 3. Body ── */}
      <div className="ds-flexible-range__body">

        {/* 3a. Instruction */}
        <DsTypography
          as="p"
          variant="paragraph-small-regular"
          className="ds-flexible-range__instruction"
        >
          {instruction}
        </DsTypography>

        {/* 3b + 3c. Slider + Amounts */}
        <div className="ds-flexible-range__slider-section">
          <DsSlider {...sliderProps} className="ds-flexible-range__slider" />

          {/* 3c. 3-column Amounts */}
          <div className="ds-flexible-range__amounts" role="group" aria-label="Current values">
            {(["0", "1", "2"] as const).map((idx) => {
              const i = Number(idx) as 0 | 1 | 2;
              return (
                <div key={idx} className="ds-flexible-range__amount">
                  <DsTypography
                    as="span"
                    variant="paragraph-small-medium"
                    className="ds-flexible-range__amount-label"
                  >
                    {columnLabels[i]}
                  </DsTypography>
                  <div
                    className="ds-flexible-range__amount-value"
                    aria-label={`${columnLabels[i]}: ${formatValue(currentValue[i], currency)}`}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <DsTypography as="span" variant="paragraph-small-regular">
                      {formatValue(currentValue[i], currency)}
                    </DsTypography>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3d. Reset to Recommendation */}
        <DsButton
          variant="ghost"
          size="large"
          disabled={!isDirty || disabled}
          onClick={handleReset}
          className="ds-flexible-range__reset"
          aria-label="Reset all values to the recommendation"
        >
          Reset to Recommendation
        </DsButton>
      </div>

      {/* ── 4. Footer divider ── */}
      <div className="ds-flexible-range__footer-divider" aria-hidden />

      {/* ── 5. Apply button ── */}
      <DsButton
        variant="secondary"
        size="large"
        disabled={!isDirty || disabled}
        onClick={handleApply}
        className="ds-flexible-range__apply"
      >
        Apply
      </DsButton>
    </Widget>
  );
}
