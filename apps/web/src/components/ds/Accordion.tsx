import { useId, useState, type ElementType, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { DsTypography } from "./DsTypography";
import "./Accordion.css";

/**
 * Figma: Accordion component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 3143:15292.
 * Axes: variant (Contained / Ghost) × size (Regular / Small).
 * Open/Closed controlled via `open` prop or internal state (`defaultOpen`).
 * Focus ring applied via CSS :has(:focus-visible) on the root element.
 *
 * Accessibility (screen readers):
 * - The trigger `<button>` is linked to its content panel via matching
 *   `aria-controls` / `id`, and its `aria-expanded` reflects open state.
 * - The content panel is exposed as `role="region"` labelled by the trigger.
 * - Per the WAI-ARIA APG accordion pattern, the trigger button is wrapped in
 *   a heading element (`headingLevel` prop, default `3`) so accordion items
 *   are discoverable when a screen reader user navigates a page by heading.
 * - The content panel stays mounted in the DOM at all times and is hidden
 *   via the native `hidden` attribute when collapsed (instead of being
 *   unmounted), so in-page find and screen reader "read all" can still
 *   reach it structurally, and layout/animation code has a real element to
 *   measure instead of a mount/unmount cycle.
 */

export type DsAccordionVariant = "contained" | "ghost";
export type DsAccordionSize = "regular" | "small";
export type DsAccordionHeadingLevel = 2 | 3 | 4 | 5 | 6;

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
  /**
   * Heading level (`h2`–`h6`) the trigger button is wrapped in, so the
   * accordion item is discoverable via heading navigation and fits into the
   * page's existing heading hierarchy. Defaults to `3` (`<h3>`), matching
   * the level `AccordionShowcase` already uses for its section titles.
   */
  headingLevel?: DsAccordionHeadingLevel;
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
  headingLevel = 3,
  className,
}: DsAccordionProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const titleVariant = size === "small" ? "paragraph-small-medium" : "paragraph-medium";
  const subtitleVariant = size === "small" ? "paragraph-mini-regular" : "paragraph-small-regular";

  // Stable per-instance ids so the trigger and panel can reference each
  // other regardless of how many DsAccordion instances render on the page.
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;
  const HeadingTag = `h${headingLevel}` as ElementType;

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
      <HeadingTag className="ds-accordion__heading">
        <button
          type="button"
          id={triggerId}
          className="ds-accordion__trigger"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
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
      </HeadingTag>
      {children != null && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="ds-accordion__content"
          hidden={!isOpen}
        >
          {children}
        </div>
      )}
    </div>
  );
}
