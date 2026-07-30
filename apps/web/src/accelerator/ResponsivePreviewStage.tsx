import { useEffect, useRef, useState, type ReactNode } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { VIEWPORT_MAX_WIDTH, VIEWPORT_MIN_WIDTH, type ResponsiveViewport } from "./responsiveViewport";
import "./ResponsivePreviewStage.css";

/**
 * Shared sizing/centering chrome for BOTH DirectionPreviewFrame and
 * StorybookStoryFrame. One rule above all: the stage NEVER scrolls
 * horizontally. A tablet/mobile/custom viewport wider than the card renders
 * at its true logical width (real reflow — the iframe genuinely lays out at
 * 768px) and is then scaled down as one unit to fit the column, exactly like
 * Figma or a deploy-preview thumbnail. Content is never clipped, never
 * overlapped, never scrolled sideways.
 *
 * Height is likewise never capped or forced to scroll internally — when the
 * caller can measure the child's real content size (DirectionPreviewFrame,
 * same-origin), the stage sizes itself to exactly that, scaled the same way
 * as width. Callers that can't measure (StorybookStoryFrame, often
 * cross-origin) fall back to the viewport preset's own height, unchanged
 * from before.
 */

export function ResponsivePreviewStage({
  viewport,
  onResizeWidth,
  label,
  children,
  contentSize = null,
}: {
  viewport: ResponsiveViewport;
  onResizeWidth: (width: number) => void;
  /** Accessible name for the resize handle, e.g. "Resize Direction A preview width". */
  label: string;
  children: ReactNode;
  /** The child's real, unscaled content size once known (see DirectionPreviewFrame's onMeasured). Omit when the child can't be measured (e.g. a cross-origin Storybook iframe) to keep the old fixed-height behavior. */
  contentSize?: { width: number; height: number } | null;
}) {
  const isFluid = viewport.preset === "desktop";
  const stageRef = useRef<HTMLDivElement>(null);
  const [availWidth, setAvailWidth] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") setAvailWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = !isFluid && availWidth > 0 ? Math.min(1, availWidth / viewport.width) : 1;
  const naturalHeight = contentSize?.height ?? viewport.height;
  const scaledHeight = naturalHeight * scale;
  // +24 compensates the stage's 12px dot-grid padding on both ends. No cap —
  // the stage is exactly as tall as the content actually is; the page scrolls.
  const stageHeight = !isFluid
    ? scaledHeight + 24
    : contentSize
      ? contentSize.height + 24
      : undefined;

  const currentWidth = () => (isFluid ? (stageRef.current?.getBoundingClientRect().width ?? 1024) : viewport.width);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = currentWidth();
    const onMove = (moveEvent: PointerEvent) => {
      onResizeWidth(startWidth + (moveEvent.clientX - startX));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") onResizeWidth(currentWidth() - 20);
    else if (event.key === "ArrowRight") onResizeWidth(currentWidth() + 20);
    else return;
    event.preventDefault();
  };

  // Device presets are exact widths by definition — the drag handle only makes
  // sense while fluid (to explore) or already in a custom width (to continue).
  const showHandle = isFluid || viewport.preset === "custom";

  return (
    <div className={`responsiveStage${isFluid ? "" : " responsiveStage--constrained"}`}>
      {!isFluid ? (
        <DsTypography as="span" variant="paragraph-mini-regular" className="responsiveStage__label">
          {Math.round(viewport.width)} × {Math.round(viewport.height)} px
          {scale < 0.999 ? " · scaled to fit" : ""}
        </DsTypography>
      ) : null}
      <div className="responsiveStage__stage" ref={stageRef} style={stageHeight ? { height: stageHeight } : undefined}>
        <div
          className="responsiveStage__frame"
          style={
            isFluid
              ? undefined
              : {
                  width: viewport.width,
                  height: naturalHeight,
                  transform: `translateX(-50%) scale(${scale})`,
                }
          }
        >
          {children}
          {showHandle ? (
            <div
              className="responsiveStage__handle"
              onPointerDown={handlePointerDown}
              onKeyDown={handleKeyDown}
              role="slider"
              aria-label={label}
              aria-valuenow={Math.round(currentWidth())}
              aria-valuemin={VIEWPORT_MIN_WIDTH}
              aria-valuemax={VIEWPORT_MAX_WIDTH}
              tabIndex={0}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
