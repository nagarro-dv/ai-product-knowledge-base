import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Widget } from "./Widget";
import { DsSlider } from "./Slider";
import { DsButton } from "./Button";
import { DsTypography } from "./DsTypography";
import "./CustomAmount.css";

/**
 * DsCustomAmount — Figma XLKRFXYtGQPPHD9cq4JNn8, node 5935:11606 ("Custom amount/Default").
 * A self-contained Widget card that lets a user pick an amount by dragging a
 * single-thumb Slider, with a live big-value readout and a contextual message
 * that reacts to where the current value sits relative to a "comfortable"
 * guidance band — switching tone (icon + semantic color) between "within range"
 * and "outside range" as the user drags. Same state-management pattern as
 * DsFlexibleRange (uncontrolled-or-controlled value, Apply disabled until the
 * value drifts from its initial value).
 *
 * Structure (mirrors Figma layer order 1:1):
 *   1. Label — small caption (Figma default: "Custom amount")
 *   2. Live big value display (heading-3)
 *   3. Drag-instruction helper text (paragraph-mini-regular)
 *   4. Divider
 *   5. Single-thumb DsSlider (type="default")
 *   6. Contextual "comfortable range" helper text (paragraph-medium, DYNAMIC —
 *      success-toned while inside [comfortableMin, comfortableMax], warning-toned
 *      outside it) with a matching status icon
 *   7. Apply button (secondary, large, full width, disabled until dirty)
 */

export type DsCustomAmountProps = {
  /** Small caption above the value. Figma default: "Custom amount" */
  label?: string;
  /** Slider absolute minimum. Figma default: 1000 */
  min?: number;
  /** Slider absolute maximum. Figma default: 25000 */
  max?: number;
  /** Slider step. */
  step?: number;
  /** The initial/starting amount. Used as the dirty-check baseline. Figma default: 2800 */
  initialValue?: number;
  /** Currency / unit prefix shown in value displays. */
  currency?: string;
  /** Lower bound of the "comfortable" guidance band. Figma default: 1900 */
  comfortableMin?: number;
  /** Upper bound of the "comfortable" guidance band. Figma default: 3000 */
  comfortableMax?: number;
  /** Controlled current value. Omit for uncontrolled (internal state). */
  value?: number;
  /** Called on every slider drag. */
  onChange?: (value: number) => void;
  /** Called when Apply is clicked. */
  onApply?: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

function formatCurrency(v: number, currency: string) {
  return `${currency}${v.toLocaleString("en-US")}`;
}

export function DsCustomAmount({
  label = "Custom amount",
  min = 1000,
  max = 25000,
  step = 100,
  initialValue = 2800,
  currency = "€",
  comfortableMin = 1900,
  comfortableMax = 3000,
  value: controlledValue,
  onChange,
  onApply,
  disabled = false,
  className,
}: DsCustomAmountProps) {
  const isControlled = controlledValue !== undefined;

  const [internalValue, setInternalValue] = useState<number>(initialValue);
  const currentValue = isControlled ? controlledValue : internalValue;

  const isDirty = currentValue !== initialValue;

  const handleChange = useCallback(
    (v: number) => {
      if (!isControlled) setInternalValue(v);
      onChange?.(v);
    },
    [isControlled, onChange],
  );

  const handleApply = useCallback(() => {
    onApply?.(currentValue);
  }, [onApply, currentValue]);

  const dragHelperText = useMemo(
    () => `Drag to select between ${formatCurrency(min, currency)} and ${formatCurrency(max, currency)}.`,
    [min, max, currency],
  );

  const isComfortable = currentValue >= comfortableMin && currentValue <= comfortableMax;

  const contextualText = useMemo(() => {
    const band = `${formatCurrency(comfortableMin, currency)}–${formatCurrency(comfortableMax, currency)}`;
    return isComfortable
      ? `${formatCurrency(currentValue, currency)} is comfortably within your typical range (${band}).`
      : `${formatCurrency(currentValue, currency)} is outside your typical comfortable range (${band}).`;
  }, [isComfortable, currentValue, comfortableMin, comfortableMax, currency]);

  return (
    <Widget
      surfaceStyle="flat"
      background="default"
      className={["ds-custom-amount", className].filter(Boolean).join(" ")}
      data-component="custom-amount"
      data-figma-file="XLKRFXYtGQPPHD9cq4JNn8"
      data-figma-node="5935:11606"
    >
      {/* ── 1. Label ── */}
      <DsTypography
        as="p"
        variant="paragraph-small-medium"
        className="ds-custom-amount__label"
      >
        {label}
      </DsTypography>

      {/* ── 2. Live big value ── */}
      <DsTypography
        as="p"
        variant="heading-3"
        className="ds-custom-amount__value"
        aria-live="polite"
        aria-atomic="true"
      >
        {formatCurrency(currentValue, currency)}
      </DsTypography>

      {/* ── 3. Drag helper ── */}
      <DsTypography
        as="p"
        variant="paragraph-mini-regular"
        className="ds-custom-amount__drag-helper"
      >
        {dragHelperText}
      </DsTypography>

      {/* ── 4. Divider ── */}
      <div className="ds-custom-amount__divider" aria-hidden />

      {/* ── 5. Slider ── */}
      <DsSlider
        type="default"
        value={currentValue}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        className="ds-custom-amount__slider"
      />

      {/* ── 6. Contextual comfortable-range message (dynamic) ── */}
      <div
        className={[
          "ds-custom-amount__contextual",
          isComfortable ? "ds-custom-amount__contextual--comfortable" : "ds-custom-amount__contextual--outside",
        ].join(" ")}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isComfortable ? (
          <CheckCircle2 size={16} className="ds-custom-amount__contextual-icon" aria-hidden />
        ) : (
          <AlertTriangle size={16} className="ds-custom-amount__contextual-icon" aria-hidden />
        )}
        <DsTypography as="span" variant="paragraph-medium" color="inherit">
          {contextualText}
        </DsTypography>
      </div>

      {/* ── 7. Apply button ── */}
      <DsButton
        variant="secondary"
        size="large"
        disabled={!isDirty || disabled}
        onClick={handleApply}
        className="ds-custom-amount__apply"
      >
        Apply
      </DsButton>
    </Widget>
  );
}
