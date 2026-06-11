import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { DsButton } from "./Button";
import { DsTypography } from "./DsTypography";
import { Widget } from "./Widget";
import { useFlowDeviceStageRef } from "../../context/FlowDeviceEmbeddedChromeContext";
import "./BottomSheet.css";

/**
 * Figma: Bottom Sheet — DS Starter Kit 8Ry9Oa2niLBGvoWPo9rLQT, node **2461:97**.
 *
 * Figma boolean props (all default false except secondaryAction):
 *   - `actions`          → show the footer button row
 *   - `secondaryAction`  → (default true) show ghost button above primary when actions=true
 *   - `showActionSlot`   → show an extra ReactNode slot above the buttons
 *   - `topRightSlot1`    → show the top-right close icon slot
 */

/* ─────────────────────────────────────────── Panel (no overlay) ── */

export type DsBottomSheetPanelProps = {
  /** Sheet heading — heading-4. */
  title?: string;
  /** Subtitle below the title — paragraph-small-regular. */
  description?: string;
  /**
   * Show X icon in the top-right header slot.
   * Figma: `topRightSlot1` boolean (default false).
   */
  showCloseIcon?: boolean;
  /** Called when the X icon is tapped. */
  onClose?: () => void;
  /**
   * Content area slot (Figma: Content frame, 84 px in default state).
   * Use `DsBottomSheetWidget` for the Widget-wrapped layout from Features file.
   */
  children?: ReactNode;
  /**
   * Show the footer button row.
   * Figma: `actions` boolean (default false).
   */
  actions?: boolean;
  /** Primary (filled) button label. Figma default: "Primary Action". */
  primaryLabel?: string;
  /** Called on primary button tap — falls back to `onClose`. */
  onPrimary?: () => void;
  /**
   * Show the ghost secondary button above the primary.
   * Figma: `secondaryAction` boolean (default true).
   */
  secondaryAction?: boolean;
  /** Secondary (ghost) button label. Figma default: "Secondary Action". */
  secondaryLabel?: string;
  /** Called on secondary button tap — falls back to `onClose`. */
  onSecondary?: () => void;
  /**
   * Show the extra action slot above the footer buttons.
   * Figma: `showActionSlot` boolean (default false).
   */
  showActionSlot?: boolean;
  /** Slot content rendered inside the action slot (Figma: Action Slot frame, 46.5 px). */
  actionSlot?: ReactNode;
  /**
   * When true, suppresses the slide-up animation so the panel can be
   * rendered inline for showcase / documentation purposes.
   */
  isStatic?: boolean;
};

export function DsBottomSheetPanel({
  title = "Bottom Sheet Title",
  description = "Bottom Sheet Subtitle",
  showCloseIcon = false,
  onClose,
  children,
  actions = false,
  primaryLabel = "Primary Action",
  onPrimary,
  secondaryAction = true,
  secondaryLabel = "Secondary Action",
  onSecondary,
  showActionSlot = false,
  actionSlot,
  isStatic = false,
}: DsBottomSheetPanelProps) {
  return (
    <div
      className={[
        "ds-bottom-sheet__panel",
        isStatic ? "ds-bottom-sheet__panel--static" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-component="bottom-sheet-panel"
      data-figma-node="2461:98"
    >
      {/* HandleWrapper — Figma node 2461:99 */}
      <div className="ds-bottom-sheet__handle-wrapper" aria-hidden>
        <div className="ds-bottom-sheet__handle" />
      </div>

      {/* TitleSubtitleWrapper — Figma node 2461:101 */}
      <div className="ds-bottom-sheet__header">
        <div className="ds-bottom-sheet__title-group">
          <DsTypography as="p" variant="heading-4" className="ds-bottom-sheet__title">
            {title}
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small-regular" className="ds-bottom-sheet__description">
            {description}
          </DsTypography>
        </div>

        {/* Top Right Slot — Figma node 2461:105, topRightSlot1 boolean */}
        {showCloseIcon ? (
          <button
            type="button"
            className="ds-bottom-sheet__close-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={20} aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Content slot — Figma node 2461:106 */}
      <div className="ds-bottom-sheet__content">{children ?? null}</div>

      {/* Actions — Figma node 2461:121, actions boolean */}
      {actions ? (
        <div className="ds-bottom-sheet__footer">
          {/* Action Slot — Figma node 2461:134, showActionSlot boolean */}
          {showActionSlot ? (
            <div className="ds-bottom-sheet__action-slot">{actionSlot ?? null}</div>
          ) : null}

          {/* Secondary ghost button — Figma node 2461:122, secondaryAction boolean */}
          {secondaryAction ? (
            <DsButton
              type="button"
              variant="ghost"
              size="large"
              className="ds-bottom-sheet__action-btn"
              onClick={onSecondary ?? onClose}
            >
              {secondaryLabel}
            </DsButton>
          ) : null}

          {/* Primary filled button — Figma node 2461:123 */}
          <DsButton
            type="button"
            variant="primary"
            size="large"
            className="ds-bottom-sheet__action-btn"
            onClick={onPrimary ?? onClose}
          >
            {primaryLabel}
          </DsButton>
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────── Overlay (portal) ── */

export type DsBottomSheetProps = DsBottomSheetPanelProps & {
  /** Controls visibility — renders null when false. */
  open: boolean;
  /** Called to dismiss (scrim tap, Escape, swipe-down, close icon). */
  onClose: () => void;
};

/**
 * Full overlay bottom sheet: scrim + slide-up panel.
 * Dismiss via Escape key, scrim tap, or 80 px swipe-down.
 *
 * When rendered inside a FlowDeviceFrame, portals into the device frame element
 * so the scrim covers the full screen (including the status bar) while the
 * Dynamic Island (z-index 2) remains on top. Outside a device frame, falls
 * back to `position: fixed` covering the full viewport.
 */
export function DsBottomSheet({ open, onClose, ...panelProps }: DsBottomSheetProps) {
  const startYRef = useRef<number | null>(null);
  const stageRef = useFlowDeviceStageRef();
  const inFrame = stageRef.current !== null;

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    if (e.changedTouches[0].clientY - startYRef.current > 80) onClose();
    startYRef.current = null;
  };

  const overlay = (
    <div
      className={["ds-bottom-sheet-root", inFrame ? "ds-bottom-sheet-root--in-frame" : ""].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ds-bottom-sheet-title"
      data-component="bottom-sheet"
      data-figma-node="2461:97"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="ds-bottom-sheet__scrim" aria-hidden onClick={onClose} />
      <DsBottomSheetPanel {...panelProps} onClose={onClose} />
    </div>
  );

  return stageRef.current ? createPortal(overlay, stageRef.current) : overlay;
}

/* ─────────────────────────────── Widget helper (Features context) ── */

export type DsBottomSheetWidgetProps = {
  children?: ReactNode;
};

/**
 * Raised Widget wrapper for content inside a bottom sheet.
 * Uses surfaceStyle="raised" so shadows/inner-glow make the card visible
 * against the sheet surface (--ds-bottom-sheet-color-surface).
 */
export function DsBottomSheetWidget({ children }: DsBottomSheetWidgetProps) {
  return (
    <Widget surfaceStyle="raised" background="background" className="ds-bottom-sheet-widget">
      {children}
    </Widget>
  );
}
