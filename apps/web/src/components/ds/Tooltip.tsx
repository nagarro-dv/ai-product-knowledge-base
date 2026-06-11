import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { DsTypography } from "./DsTypography";
import "./Tooltip.css";

export type DsTooltipSide = "top" | "bottom" | "left" | "right";
export type DsTooltipTrigger = "hover" | "click";

export type DsTooltipProps = {
  content: ReactNode;
  children: ReactElement;
  side?: DsTooltipSide;
  trigger?: DsTooltipTrigger;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Figma: Tooltip component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 2640:407.
 * Axes: Side=Top|Bottom|Left|Right. Trigger + visibility are implemented in code.
 */
export function DsTooltip({
  content,
  children,
  side = "top",
  trigger = "hover",
  open,
  defaultOpen = false,
  onOpenChange,
  className,
}: DsTooltipProps) {
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (!(event.target instanceof Node)) return;
      if (wrapper.contains(event.target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isValidElement(children)) {
    return null;
  }

  const triggerHandlers = {
    onMouseEnter: () => {
      if (trigger === "hover") setOpen(true);
    },
    onMouseLeave: () => {
      if (trigger === "hover") setOpen(false);
    },
    onFocus: () => {
      if (trigger === "hover") setOpen(true);
    },
    onBlur: () => {
      if (trigger === "hover") setOpen(false);
    },
    onClick: () => {
      if (trigger === "click") setOpen(!isOpen);
    },
  };

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props as Record<string, unknown>;

  return (
    <span ref={wrapperRef} className="ds-tooltip-anchor" data-component="tooltip" data-figma-node="2640:407">
      {cloneElement(child, {
        ...triggerHandlers,
        ...childProps,
        onMouseEnter: (event: unknown) => {
          const original = childProps.onMouseEnter as ((event: unknown) => void) | undefined;
          original?.(event);
          triggerHandlers.onMouseEnter();
        },
        onMouseLeave: (event: unknown) => {
          const original = childProps.onMouseLeave as ((event: unknown) => void) | undefined;
          original?.(event);
          triggerHandlers.onMouseLeave();
        },
        onFocus: (event: unknown) => {
          const original = childProps.onFocus as ((event: unknown) => void) | undefined;
          original?.(event);
          triggerHandlers.onFocus();
        },
        onBlur: (event: unknown) => {
          const original = childProps.onBlur as ((event: unknown) => void) | undefined;
          original?.(event);
          triggerHandlers.onBlur();
        },
        onClick: (event: unknown) => {
          const original = childProps.onClick as ((event: unknown) => void) | undefined;
          original?.(event);
          triggerHandlers.onClick();
        },
        "aria-describedby": isOpen ? tooltipId : undefined,
      })}

      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          data-side={side}
          className={classNames("ds-tooltip", `ds-tooltip--${side}`, className)}
        >
          <DsTypography as="span" variant="paragraph-mini" color="inherit" className="ds-tooltip__label">
            {content}
          </DsTypography>
          <span className="ds-tooltip__arrow" aria-hidden />
        </span>
      )}
    </span>
  );
}
