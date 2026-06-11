import { useCallback, useId, useRef } from "react";
import "./Slider.css";

/**
 * Slider Horizontal — BFSI DS Starter Kit, Figma node 322:9793.
 * Type axis: Default (single thumb) | Duo Range (two thumbs) | Triple Range (three thumbs).
 * Marker shapes: Round (circle) | Diamond (rounded square, rotated 45°, dark fill).
 * Sub-component: .Marker — State=Regular | State=Focus.
 * Optional field wrapper: title (paragraph-small-medium) + helperText (paragraph-small-regular).
 * All visual tokens from --ds-slider-* family.
 */

const FIGMA_FILE = "8Ry9Oa2niLBGvoWPo9rLQT";
const FIGMA_NODE = "322:9793";

export type DsSliderType = "default" | "range" | "duo-range" | "triple-range";

type CommonProps = {
  title?: string;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  minThumbAriaLabel?: string;
  maxThumbAriaLabel?: string;
};

export type DsSliderDefaultProps = CommonProps & {
  type?: "default";
  value: number;
  onChange: (v: number) => void;
};

export type DsSliderRangeProps = CommonProps & {
  type: "range" | "duo-range";
  value: [number, number];
  onChange: (v: [number, number]) => void;
};

/** Triple Range: [start, mid, end] — mid thumb uses the Diamond marker shape. */
export type DsSliderTripleRangeProps = CommonProps & {
  type: "triple-range";
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
};

export type DsSliderProps =
  | DsSliderDefaultProps
  | DsSliderRangeProps
  | DsSliderTripleRangeProps;

// ── Utilities ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function snapToStep(v: number, step: number, min: number, max: number): number {
  return clamp(Math.round((v - min) / step) * step + min, min, max);
}

function pctOf(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DsSlider(props: DsSliderProps) {
  const {
    type = "default",
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    className,
    title,
    helperText,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  } = props;

  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"start" | "mid" | "end" | null>(null);

  const isTriple = type === "triple-range";
  const isDuo    = type === "range" || type === "duo-range";

  // Resolve thumb values
  let startVal: number;
  let midVal: number | undefined;
  let endVal: number;

  if (isTriple) {
    const [s, m, e] = (props as DsSliderTripleRangeProps).value;
    startVal = s; midVal = m; endVal = e;
  } else if (isDuo) {
    const [s, e] = (props as DsSliderRangeProps).value;
    startVal = s; midVal = undefined; endVal = e;
  } else {
    startVal = min; midVal = undefined; endVal = (props as DsSliderDefaultProps).value;
  }

  const startPct = pctOf(startVal, min, max);
  const midPct   = midVal !== undefined ? pctOf(midVal, min, max) : 0;
  const endPct   = pctOf(endVal,   min, max);

  // ── Value helpers ────────────────────────────────────────────────────────────

  const getValueFromClientX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      return snapToStep(min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min), step, min, max);
    },
    [min, max, step],
  );

  const fireChange = useCallback(
    (thumb: "start" | "mid" | "end", raw: number) => {
      if (isTriple) {
        const fire = (props as DsSliderTripleRangeProps).onChange;
        const [s, m, e] = (props as DsSliderTripleRangeProps).value;
        if (thumb === "start")    fire([clamp(raw, min, m), m, e]);
        else if (thumb === "mid") fire([s, clamp(raw, s, e), e]);
        else                      fire([s, m, clamp(raw, m, max)]);
      } else if (isDuo) {
        const fire = (props as DsSliderRangeProps).onChange;
        const [s, e] = (props as DsSliderRangeProps).value;
        if (thumb === "start") fire([clamp(raw, min, e), e]);
        else                   fire([s, clamp(raw, s, max)]);
      } else {
        (props as DsSliderDefaultProps).onChange(clamp(raw, min, max));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTriple, isDuo, min, max, startVal, midVal, endVal],
  );

  // ── Pointer events (on outer 40px container for full-thumb hit area) ─────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();

      const rect = trackRef.current!.getBoundingClientRect();
      const clickPct = clamp((e.clientX - rect.left) / rect.width, 0, 1);

      if (isTriple) {
        const dStart = Math.abs(clickPct - startPct / 100);
        const dMid   = Math.abs(clickPct - midPct   / 100);
        const dEnd   = Math.abs(clickPct - endPct   / 100);
        const best = Math.min(dStart, dMid, dEnd);
        dragging.current = best === dStart ? "start" : best === dMid ? "mid" : "end";
      } else if (isDuo) {
        const dStart = Math.abs(clickPct - startPct / 100);
        const dEnd   = Math.abs(clickPct - endPct   / 100);
        dragging.current = dStart <= dEnd ? "start" : "end";
      } else {
        dragging.current = "end";
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      fireChange(dragging.current, getValueFromClientX(e.clientX));
    },
    [disabled, isTriple, isDuo, startPct, midPct, endPct, fireChange, getValueFromClientX],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || disabled) return;
      fireChange(dragging.current, getValueFromClientX(e.clientX));
    },
    [disabled, fireChange, getValueFromClientX],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  // ── Keyboard (ARIA slider pattern) ───────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, thumb: "start" | "mid" | "end") => {
      if (disabled) return;
      const cur = thumb === "start" ? startVal : thumb === "mid" ? midVal! : endVal;
      if (e.key === "ArrowRight" || e.key === "ArrowUp")       { e.preventDefault(); fireChange(thumb, cur + step); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); fireChange(thumb, cur - step); }
      else if (e.key === "Home") { e.preventDefault(); fireChange(thumb, min); }
      else if (e.key === "End")  { e.preventDefault(); fireChange(thumb, max); }
    },
    [disabled, startVal, midVal, endVal, step, min, max, fireChange],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const slider = (
    <div
      id={id}
      className={["ds-slider", disabled ? "ds-slider--disabled" : "", className ?? ""].filter(Boolean).join(" ")}
      data-type={type}
      data-component="slider"
      data-figma-file={FIGMA_FILE}
      data-figma-node={FIGMA_NODE}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Inner track rail — ref used for position calculation */}
      <div ref={trackRef} className="ds-slider__track">

        {/* Filled portion */}
        <div
          className="ds-slider__fill"
          style={
            isDuo || isTriple
              ? { left: `${startPct}%`, right: `${100 - endPct}%` }
              : { width: `${endPct}%` }
          }
          aria-hidden
        />

        {/* Start thumb — Duo Range + Triple Range (Round marker) */}
        {(isDuo || isTriple) && (
          <div
            className="ds-slider__thumb ds-slider__thumb--start"
            style={{ left: `${startPct}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={min}
            aria-valuemax={isTriple ? midVal : endVal}
            aria-valuenow={startVal}
            aria-label={
              (props as CommonProps).minThumbAriaLabel
                ?? (ariaLabel ? `${ariaLabel} lower` : "Lower value")
            }
            aria-labelledby={!ariaLabel ? ariaLabelledBy : undefined}
            aria-disabled={disabled || undefined}
            onKeyDown={(e) => handleKeyDown(e, "start")}
          />
        )}

        {/* Mid thumb — Triple Range only (Diamond marker) */}
        {isTriple && (
          <div
            className="ds-slider__thumb ds-slider__thumb--mid ds-slider__thumb--diamond"
            style={{ left: `${midPct}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={startVal}
            aria-valuemax={endVal}
            aria-valuenow={midVal}
            aria-label={ariaLabel ? `${ariaLabel} middle` : "Middle value"}
            aria-labelledby={!ariaLabel ? ariaLabelledBy : undefined}
            aria-disabled={disabled || undefined}
            onKeyDown={(e) => handleKeyDown(e, "mid")}
          />
        )}

        {/* End / single thumb (Round marker) */}
        <div
          className="ds-slider__thumb ds-slider__thumb--end"
          style={{ left: `${endPct}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={isTriple ? midVal! : isDuo ? startVal : min}
          aria-valuemax={max}
          aria-valuenow={endVal}
          aria-label={
            isTriple || isDuo
              ? (
                  (props as CommonProps).maxThumbAriaLabel
                    ?? (ariaLabel ? `${ariaLabel} upper` : "Upper value")
                )
              : (ariaLabel ?? "Slider")
          }
          aria-labelledby={!ariaLabel ? ariaLabelledBy : undefined}
          aria-disabled={disabled || undefined}
          onKeyDown={(e) => handleKeyDown(e, "end")}
        />
      </div>
    </div>
  );

  if (title != null || helperText != null) {
    return (
      <div className="ds-slider-field">
        {title != null && (
          <span className="ds-slider__title">{title}</span>
        )}
        {slider}
        {helperText != null && (
          <p className="ds-slider__helper">{helperText}</p>
        )}
      </div>
    );
  }

  return slider;
}
