import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Gap between the trigger and the tooltip once it has settled. */
const GAP = 6;
/** Below this distance from the top of the viewport, the tooltip flips underneath. */
const MIN_TOP_ROOM = 44;
/** Keep in sync with the transition in KnowledgeV2.css. */
const FADE_MS = 100;

type Placement = { x: number; y: number; side: "top" | "bottom" };

/**
 * A small tooltip naming an icon-only control or logo. Wraps its children in
 * an inline anchor; shows on hover or keyboard focus (not on mouse focus, so it
 * doesn't linger after a click). Rendered in a portal so scroll containers
 * can't clip it. It fades in while moving 8px away from the trigger — up when
 * it sits above, down when it flips below.
 */
export function Tip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const showFrame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimer.current);
      window.cancelAnimationFrame(showFrame.current ?? 0);
    },
    [],
  );

  const show = () => {
    const anchor = anchorRef.current;
    // Don't cover a menu the trigger has just opened.
    if (!anchor || anchor.querySelector('[aria-expanded="true"]')) return;
    window.clearTimeout(hideTimer.current);
    const rect = anchor.getBoundingClientRect();
    const side = rect.top > MIN_TOP_ROOM ? "top" : "bottom";
    setPlacement({ x: rect.left + rect.width / 2, y: side === "top" ? rect.top - GAP : rect.bottom + GAP, side });
    // Mount at the start position first, then flip to visible so it transitions.
    window.cancelAnimationFrame(showFrame.current ?? 0);
    showFrame.current = window.requestAnimationFrame(() => setVisible(true));
  };

  const hide = () => {
    window.cancelAnimationFrame(showFrame.current ?? 0);
    setVisible(false);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setPlacement(null), FADE_MS);
  };

  const onFocus = (event: FocusEvent) => {
    if ((event.target as HTMLElement).matches(":focus-visible")) show();
  };

  return (
    <span
      ref={anchorRef}
      className={className ? `kb2Tip ${className}` : "kb2Tip"}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {children}
      {placement
        ? createPortal(
            <span
              role="tooltip"
              className={`kb2Tooltip kb2Tooltip--${placement.side}`}
              data-visible={visible}
              style={{ left: placement.x, top: placement.y }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
