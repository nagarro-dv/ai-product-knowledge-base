import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { DsButton } from "../ds/Button";
import { DsIconButton } from "../ds/IconButton";
import { DsTypography } from "../ds/DsTypography";
import "./SourceModal.css";

export type SourceModalKind = "ticket" | "figma" | "component" | "doc";

/** Fixed, kind-specific phrases — never a template. A template ("Add {kind} to {slot}")
 * is what produced "Add Component to Component to change" for the subject-component
 * case; a small fixed map can't collide with itself. */
export const SOURCE_MODAL_TITLE: Record<SourceModalKind, string> = {
  component: "Choose a component",
  ticket: "Attach a Jira ticket",
  figma: "Add a Figma link",
  doc: "Add a document link",
};

/** Generic per-kind guidance for callers with no per-slot hint of their own
 * (SlotIntake passes the real `slot.hint` instead — see SlotIntake.tsx). */
export const SOURCE_MODAL_SUBTITLE: Record<SourceModalKind, string> = {
  component: "Pick it from your connected Storybook",
  ticket: "Search Jira, or enter a ticket key directly",
  figma: "Paste a link to a Figma file or frame",
  doc: "Paste a link to a document",
};

/** Shared footer confirm-button copy — one definition for every caller. */
export const SOURCE_MODAL_CONFIRM_LABEL: Record<SourceModalKind, string> = {
  component: "Add component",
  ticket: "Add ticket",
  figma: "Add Figma link",
  doc: "Add document",
};

export type SourceModalFooter = {
  confirmLabel: string;
  confirmDisabled: boolean;
  onConfirm: () => void;
};

export type SourceModalProps = {
  kind: SourceModalKind;
  subtitle: string;
  onClose: () => void;
  footer: SourceModalFooter;
  /** Optional extra icon-button rendered in the header, next to Close (e.g. the
   * component picker's search toggle) — kept next to the one control every state
   * shares, rather than buried inside whatever's currently in the body. */
  headerAction?: ReactNode;
  children: ReactNode;
};

/**
 * Shared shell for every "add a source" modal in the app (SlotIntake's intake-screen
 * modal, AiAgentInput's "Add context"/"Refine" modal) — one header (fixed title + close
 * button, no icon — a per-kind icon added noise without adding information the title
 * didn't already carry), one subtitle line, one footer (Cancel + a contextual primary
 * action), one Escape-to-close handler.
 *
 * Deliberately just the shell: each caller keeps its own body/state (slot-driven vs.
 * free-dropdown-driven), and keeps its own focus-into-first-field wiring — this component
 * has no way to know which child element should receive focus on open.
 */
export function SourceModal({ kind, subtitle, onClose, footer, headerAction, children }: SourceModalProps) {
  const titleId = `sourceModal-title-${kind}`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="sourceModal__root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="sourceModal__backdrop" onClick={onClose} aria-label="Close" />
      <div className="sourceModal__panel">
        <div className="sourceModal__titleBlock">
          <header className="sourceModal__header">
            <DsTypography as="h2" id={titleId} variant="heading-5" className="sourceModal__headerTitle">
              {SOURCE_MODAL_TITLE[kind]}
            </DsTypography>
            {headerAction}
            <DsIconButton
              variant="ghost"
              size="small"
              aria-label="Close dialog"
              className="sourceModal__closeButton"
              onClick={onClose}
            >
              <X size={16} aria-hidden />
            </DsIconButton>
          </header>

          <DsTypography as="p" variant="paragraph-mini-regular" className="sourceModal__subtitle">
            {subtitle}
          </DsTypography>
        </div>

        <div className="sourceModal__body">{children}</div>

        <div className="sourceModal__actions">
          <DsButton variant="ghost" size="small" type="button" onClick={onClose}>
            Cancel
          </DsButton>
          <DsButton
            variant="primary"
            size="small"
            type="button"
            disabled={footer.confirmDisabled}
            onClick={footer.onConfirm}
          >
            {footer.confirmLabel}
          </DsButton>
        </div>
      </div>
    </div>
  );
}
