import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { DsTypography } from "./DsTypography";
import "./Accordion.css";

/**
 * Figma: Accordion component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 3143:15292.
 * Axes: variant (Contained / Ghost) × size (Regular / Small).
 * Open/Closed controlled via `open` prop or internal state (`defaultOpen`).
 * Focus ring applied via CSS :has(:focus-visible) on the root element.
 */

export type DsAccordionVariant = "contained" | "ghost";
export type DsAccordionSize = "regular" | "small";

export type DsAccordionProps = {
  /** Line 1 — main title text */
  title: ReactNode;
  /** Line 2 — optional subtitle */
  subtitle?: ReactNode;
  /** Optional icon before the title (pass a Lucide element, size 16) */
  icon?: ReactNode;
  /** Right slot in the title row: tags, action buttons, etc. */
  tagsActions?: ReactNode;
  /** Content revealed when the item is open */
  children?: ReactNode;
  /** Contained (card) or Ghost (bottom-border only, no background) */
  variant?: DsAccordionVariant;
  /** Regular (default) or Small */
  size?: DsAccordionSize;
  /** Controlled open state */
  open?: boolean;
  /** Initial open state for uncontrolled usage */
  defaultOpen?: boolean;
  /** Called when the user toggles the item */
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function DsAccordion({
  title,
  subtitle,
  icon,
  tagsActions,
  children,
  variant = "contained",
  size = "regular",
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
}: DsAccordionProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const titleVariant = size === "small" ? "paragraph-small-medium" : "paragraph-medium";
  const subtitleVariant = size === "small" ? "paragraph-mini-regular" : "paragraph-small-regular";

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div
      className={cx(
        "ds-accordion",
        `ds-accordion--${variant}`,
        `ds-accordion--${size}`,
        isOpen && "ds-accordion--open",
        className,
      )}
      data-component="accordion"
      data-figma-node="3143:15292"
      data-variant={variant}
      data-size={size}
      data-open={isOpen ? "true" : "false"}
    >
      <button
        type="button"
        className="ds-accordion__trigger"
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <div className="ds-accordion__title-and-icon">
          {icon != null && (
            <div className="ds-accordion__icon-aligner" aria-hidden>
              {icon}
            </div>
          )}
          <div className="ds-accordion__text">
            <DsTypography as="span" variant={titleVariant} className="ds-accordion__title">
              {title}
            </DsTypography>
            {subtitle != null && (
              <DsTypography as="span" variant={subtitleVariant} className="ds-accordion__subtitle">
                {subtitle}
              </DsTypography>
            )}
          </div>
        </div>
        {tagsActions != null && (
          <div className="ds-accordion__tags-actions">{tagsActions}</div>
        )}
        <span className="ds-accordion__chevron" aria-hidden>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {isOpen && children != null && (
        <div className="ds-accordion__content">{children}</div>
      )}
    </div>
  );
}
