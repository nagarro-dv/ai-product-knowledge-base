import { useCallback, useId, useRef } from "react";
import "./CircularSlider.css";

/**
 * DS Circular Slider — new interactive primitive, sibling to `DsProgressCircle` / `DsSlider`.
 * Lets a user pick a whole-percent value (0–100) by dragging around a ring, or by focusing
 * the handle and using arrow / Home / End keys — e.g. to set the minimum confidence score
 * before an AI suggestion is shown ("Only show suggestions above 75% confidence").
 *
 * Visual ring reuses the exact stroke-dasharray fill technique `DsProgressCircle` already
 * uses (clockwise fill from 12 o'clock). Drag + keyboard interaction mirrors `DsSlider.tsx`'s
 * pointer-capture + ARIA slider pattern, adapted from a horizontal axis to an angle via atan2.
 *
 * Confirmed out of scope (do not add): typed numeric entry, tick marks/labels, multiple
 * handles or range selection, wrap-around past 0/100, and step sizes other than whole percent.
 */

export type DsCircularSliderProps = {
  /** Current value, 0–100 (whole percent). */
  value: number;
  onChange: (value: number) => void;
  /** Ring diameter in px (SVG viewBox units). Default: 160. */
  size?: number;
  /** Ring stroke width in px. Default: 14. */
  strokeWidth?: number;
  disabled?: boolean;
  className?: string;
  /** Optional field label rendered above the ring, matching DsSlider's field wrapper. */
  title?: string;
  /** Optional helper copy rendered below the ring. */
  helperText?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Angle in degrees (0 = 12 o'clock, increasing clockwise) between a point and a centre. */
function angleFromCenter(clientX: number, clientY: number, cx: number, cy: number): number {
  const dx = clientX - cx;
  const dy = clientY - cy;
  // atan2 measures from 3 o'clock, counter-clockwise; rotate 90° and flip to
  // match the ring's 12-o'clock-clockwise convention used by DsProgressCircle.
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return (deg + 360) % 360;
}

/**
 * DS **Circular Slider** — draggable 0–100 ring control. Value is always whole percent,
 * stops (does not wrap) at 0/100, and is always shown as visible on-screen text.
 */
export function DsCircularSlider({
  value,
  onChange,
  size = 160,
  strokeWidth = 14,
  disabled = false,
  className,
  title,
  helperText,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DsCircularSliderProps) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pct = clamp(Math.round(Number.isFinite(value) ? value : 0), 0, 100);
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  // Handle position, expressed as a % of the ring box so it stays correct even
  // when the box is rendered smaller than `size` (see CircularSlider.css, which
  // caps width via `max-width` on narrow containers).
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
      className={["ds-circular-slider", disabled ? "ds-circular-slider--disabled" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      data-component="circular-slider"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <svg className="ds-circular-slider__svg" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {/* Track */}
        <circle
          className="ds-circular-slider__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        {/* Fill — starts at 12 o'clock, fills clockwise, same technique as DsProgressCircle */}
        <circle
          className="ds-circular-slider__fill"
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

      {/* Draggable / focusable handle — positioned in % so it tracks the fill arc
          even when the ring is rendered smaller than `size` on narrow screens. */}
      <div
        className="ds-circular-slider__handle"
        style={{ left: `${handleLeftPct}%`, top: `${handleTopPct}%` }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}%`}
        aria-label={ariaLabel ?? "Confidence threshold"}
        aria-labelledby={!ariaLabel ? ariaLabelledBy : undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
      />

      {/* Current value — always visible on-screen text, not only exposed to AT */}
      <span className="ds-circular-slider__value" aria-hidden="true">
        {pct}%
      </span>
    </div>
  );

  if (title != null || helperText != null) {
    return (
      <div className="ds-circular-slider-field">
        {title != null && <span className="ds-circular-slider__title">{title}</span>}
        {control}
        {helperText != null && <p className="ds-circular-slider__helper">{helperText}</p>}
      </div>
    );
  }

  return control;
}
