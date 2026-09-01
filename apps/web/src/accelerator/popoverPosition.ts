/**
 * Fixed-position coordinates for a popover anchored to its trigger — below
 * when there's room, flipped above when there isn't (e.g. a trigger docked
 * in a form's footer, near the bottom of the viewport). Without the flip,
 * a popover near the bottom edge gets its height clamped to whatever sliver
 * of space is left below the trigger and is forced to scroll internally
 * even when its content would otherwise fit easily above.
 *
 * `.accelerator` (the intake card) sets `overflow: hidden` so it can round its
 * corners — any `position: absolute` popover inside it gets silently clipped
 * the moment it would visually extend past the card edge. `position: fixed`
 * escapes that clipping (its containing block is the viewport), so callers
 * render the popover there using these coordinates instead.
 */
export type PopoverPosition = {
  placement: "below" | "above";
  /** Set when placement is "below" — distance from the viewport top. */
  top?: number;
  /** Set when placement is "above" — distance from the viewport bottom. */
  bottom?: number;
  left: number;
  maxHeight: number;
  minWidth: number;
};

const VIEWPORT_MARGIN = 8;
const GAP = 6;
const MIN_HEIGHT = 160;

export function computeAnchoredPosition(trigger: HTMLElement, desiredMaxHeight = 360): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - VIEWPORT_MARGIN - 320));
  const minWidth = rect.width;

  const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;

  // Below is the natural, expected direction — stick with it unless there's
  // genuinely more usable room on the other side.
  if (spaceBelow >= MIN_HEIGHT || spaceBelow >= spaceAbove) {
    return {
      placement: "below",
      top: rect.bottom + GAP,
      left,
      maxHeight: Math.max(MIN_HEIGHT, Math.min(desiredMaxHeight, spaceBelow)),
      minWidth,
    };
  }
  return {
    placement: "above",
    bottom: window.innerHeight - rect.top + GAP,
    left,
    maxHeight: Math.max(MIN_HEIGHT, Math.min(desiredMaxHeight, spaceAbove)),
    minWidth,
  };
}
