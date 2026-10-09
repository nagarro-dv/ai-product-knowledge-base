import { useCallback, useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Gap between the trigger and the tooltip once it has settled. */
const GAP = 6;
/** Below this distance from the top of the viewport, the tooltip flips underneath. */
const MIN_TOP_ROOM = 44;
/** Keep in sync with the transition in KnowledgeV2.css. */
const FADE_MS = 100;

type Placement = { x: number; y: number; side: "top" | "bottom"; label: string };

/**
 * The tooltip machinery behind <Tip>, for triggers React doesn't render
 * itself (the prompt box's slot chips). `show(anchor, label)` places it above
 * the anchor (below when there's no room), fades it in while it moves 8px
 * outward, and `hide()` fades it back out. Render `tooltip` anywhere.
 */
export function useFloatingTip() {
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

  const show = useCallback((anchor: Element, label: string) => {
    window.clearTimeout(hideTimer.current);
    const rect = anchor.getBoundingClientRect();
    const side = rect.top > MIN_TOP_ROOM ? "top" : "bottom";
    setPlacement({ x: rect.left + rect.width / 2, y: side === "top" ? rect.top - GAP : rect.bottom + GAP, side, label });
    // Mount at the start position first, then flip to visible so it transitions.
    window.cancelAnimationFrame(showFrame.current ?? 0);
    showFrame.current = window.requestAnimationFrame(() => setVisible(true));
  }, []);

  const hide = useCallback(() => {
    window.cancelAnimationFrame(showFrame.current ?? 0);
    setVisible(false);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setPlacement(null), FADE_MS);
  }, []);

  const tooltip = placement
    ? createPortal(
        <span
          role="tooltip"
          className={`kb2Tooltip kb2Tooltip--${placement.side}`}
          data-visible={visible}
          style={{ left: placement.x, top: placement.y }}
        >
          {placement.label}
        </span>,
        document.body,
      )
    : null;

  return { show, hide, tooltip };
}

/**
 * A small tooltip naming an icon-only control or logo. Wraps its children in
 * an inline anchor; shows on hover or keyboard focus (not on mouse focus, so it
 * doesn't linger after a click). Rendered in a portal so scroll containers
 * can't clip it. It fades in while moving 8px away from the trigger — up when
 * it sits above, down when it flips below.
 */
export function Tip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const { show, hide, tooltip } = useFloatingTip();

  const showForAnchor = () => {
    const anchor = anchorRef.current;
    // Don't cover a menu the trigger has just opened.
    if (!anchor || anchor.querySelector('[aria-expanded="true"]')) return;
    show(anchor, label);
  };

  const onFocus = (event: FocusEvent) => {
    if ((event.target as HTMLElement).matches(":focus-visible")) showForAnchor();
  };

  return (
    <span
      ref={anchorRef}
      className={className ? `kb2Tip ${className}` : "kb2Tip"}
      onPointerEnter={showForAnchor}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {children}
      {tooltip}
    </span>
  );
}

/**
 * Like <Tip>, but only appears when the text inside is cut off — for chips
 * whose labels can truncate (attachments in the prompt box). `selector` picks
 * the element that truncates; the tooltip then shows the full `label`.
 */
export function OverflowTip({
  label,
  selector,
  children,
  className,
}: {
  label: string;
  selector: string;
  children: ReactNode;
  className?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const { show, hide, tooltip } = useFloatingTip();

  const showIfTruncated = () => {
    const anchor = anchorRef.current;
    const text = anchor?.querySelector<HTMLElement>(selector);
    if (!anchor || !text || text.scrollWidth <= text.clientWidth + 1) return;
    show(anchor, label);
  };

  return (
    <span
      ref={anchorRef}
      className={className ? `kb2Tip kb2OverflowTip ${className}` : "kb2Tip kb2OverflowTip"}
      onPointerEnter={showIfTruncated}
      onPointerLeave={hide}
      onPointerDown={hide}
    >
      {children}
      {tooltip}
    </span>
  );
}
