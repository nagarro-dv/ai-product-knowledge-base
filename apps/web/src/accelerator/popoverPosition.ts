/**
 * Fixed-position coordinates for a popover anchored under its trigger.
 *
 * `.accelerator` (the intake card) sets `overflow: hidden` so it can round its
 * corners — any `position: absolute` popover inside it gets silently clipped
 * the moment it would visually extend past the card edge. `position: fixed`
 * escapes that clipping (its containing block is the viewport), so callers
 * render the popover there using these coordinates instead.
 */
export type PopoverPosition = {
  top: number;
  left: number;
  maxHeight: number;
  minWidth: number;
};

const VIEWPORT_MARGIN = 8;
const GAP = 6;

export function computeAnchoredPosition(trigger: HTMLElement, desiredMaxHeight = 360): PopoverPosition {
  const rect = trigger.getBoundingClientRect();
  const top = rect.bottom + GAP;
  const maxHeight = Math.max(160, Math.min(desiredMaxHeight, window.innerHeight - top - VIEWPORT_MARGIN));
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - VIEWPORT_MARGIN - 320));
  return { top, left, maxHeight, minWidth: rect.width };
}
