import { useCallback, useId, useRef } from "react";
import "./CircularConfidenceSelector.css";

/**
 * DS Circular Confidence Selector — "Centered Stat Dial" direction.
 *
 * A 0–100 whole-percent ring control (drag or focus + Arrow/Home/End keys)
 * whose ring fill, handle border, and the value text all recolour to reflect
 * which confidence band the current value falls in — Low (<40%), Medium
 * (40–69%), High (≥70%) — using the design system's existing semantic
 * progress tokens (error / warning / success). A short qualitative label
 * ("Low confidence" / "Medium confidence" / "High confidence") is always
 * rendered under the number as real on-screen text, stacked concentrically
 * inside the ring, alongside the number itself, so the value is legible both
 * as an exact figure and as an at-a-glance signal.
 *
 * Interaction pattern (drag via pointer-capture + angle-from-centre maths,
 * ARIA `role="slider"` handle, keyboard support) mirrors the existing
 * `DsCircularSlider` primitive this component is modelled on.
 *
 * Confirmed out of scope (do not add): typed numeric entry, tick marks or
 * step labels, multiple handles/range selection, wrap-around past 0/100,
 * and any color token outside the existing design-system palette — the
 * band colours below are all existing `--ds-progress-linear-color-*`
 * semantic tokens, not new ones.
 */

export type DsConfidenceSelectorProps = {
  /** Current value, 0–100 (whole percent). */
  value: number;
  onChange: (value: number) => void;
  /** Ring diameter in px (SVG viewBox units). Default: 180. */
  size?: number;
  /** Ring stroke width in px. Default: 14. */
  strokeWidth?: number;
  disabled?: boolean;
  className?: string;
  /** Optional field label rendered above the ring. */
  title?: string;
  /** Optional helper copy rendered below the ring. */
  helperText?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type Band = "low" | "medium" | "high";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Angle in degrees (0 = 12 o'clock, increasing clockwise) between a point and a centre. */
function angleFromCenter(clientX: number, clientY: number, cx: number, cy: number): number {
  const dx = clientX - cx;
  const dy = clientY - cy;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return (deg + 360) % 360;
}

function bandFor(pct: number): Band {
  if (pct < 40) return "low";
  if (pct < 70) return "medium";
  return "high";
}

const BAND_LABEL: Record<Band, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

/**
 * DS **Confidence Selector** (Centered Stat Dial) — draggable 0–100 ring
 * control whose colour and qualitative label track which confidence band
 * the value falls in. Value is always whole percent, stops (does not wrap)
 * at 0/100, and both the number and the band label are always visible
 * on-screen text, centred inside the ring.
 */
export function DsConfidenceSelector({
  value,
  onChange,
  size = 180,
  strokeWidth = 14,
  disabled = false,
  className,
  title,
  helperText,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DsConfidenceSelectorProps) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pct = clamp(Math.round(Number.isFinite(value) ? value : 0), 0, 100);
  const band = bandFor(pct);
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  const handleAngle = (pct / 100) * 360;
  const handleRad = ((handleAngle - 90) * Math.PI) / 180;
  const handleLeftPct = ((center + radius * Math.cos(handleRad)) / size) * 100;
  const handleTopPct = ((center + radius * Math.sin(handleRad)) / size) * 100;

  const setFromAngle = useCallback(
    (angleDeg: number) => {
      if (disabled) return;
      const raw = (angleDeg / 360) * 100;
      onChange(clamp(Math.round(raw), 0, 100));
    },
    [disabled, onChange],
  );

  const setFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setFromAngle(angleFromCenter(clientX, clientY, cx, cy));
    },
    [setFromAngle],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setFromClientPoint(e.clientX, e.clientY);
    },
    [disabled, setFromClientPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || disabled) return;
      setFromClientPoint(e.clientX, e.clientY);
    },
    [disabled, setFromClientPoint],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onChange(clamp(pct + 1, 0, 100));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onChange(clamp(pct - 1, 0, 100));
      } else if (e.key === "Home") {
        e.preventDefault();
        onChange(0);
      } else if (e.key === "End") {
        e.preventDefault();
        onChange(100);
      }
    },
    [disabled, pct, onChange],
  );

  const control = (
    <div
      id={id}
      ref={wrapRef}
      className={["ds-confidence-selector", disabled ? "ds-confidence-selector--disabled" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-component="confidence-selector"
      data-band={band}
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg className="ds-confidence-selector__svg" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="ds-confidence-selector__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="ds-confidence-selector__fill"
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

      <div
        className="ds-confidence-selector__handle"
        style={{ left: `${handleLeftPct}%`, top: `${handleTopPct}%` }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}%, ${BAND_LABEL[band]}`}
        aria-label={ariaLabel ?? "Confidence"}
        aria-labelledby={!ariaLabel ? ariaLabelledBy : undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
      />

      {/* Current value + qualitative band — both always visible on-screen text */}
      <span className="ds-confidence-selector__readout" aria-hidden="true">
        <span className="ds-confidence-selector__value">{pct}%</span>
        <span className="ds-confidence-selector__band-label">{BAND_LABEL[band]}</span>
      </span>
    </div>
  );

  if (title != null || helperText != null) {
    return (
      <div className="ds-confidence-selector-field">
        {title != null && <span className="ds-confidence-selector__title">{title}</span>}
        {control}
        {helperText != null && <p className="ds-confidence-selector__helper">{helperText}</p>}
      </div>
    );
  }

  return control;
}
