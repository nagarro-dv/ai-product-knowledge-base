import type { HTMLAttributes, ReactNode } from "react";
import { Plus } from "lucide-react";

import { DsTypography } from "./DsTypography";
import "./Badge.css";

export type DsBadgeVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "neutral"
  | "success"
  | "warning";

export type DsBadgeState = "default" | "hover" | "focus";

export type DsBadgeIconPosition = "left" | "right";

export type DsBadgeProps = {
  children: ReactNode;
  variant?: DsBadgeVariant;
  state?: DsBadgeState;
  /**
   * Single-icon convenience API. Renders one icon before (default) or after the label.
   * Preferred over `showIconLeft`/`showIconRight` + `leftIcon`/`rightIcon` for the common
   * "one icon, one side" case.
   */
  icon?: ReactNode;
  /** Where `icon` renders. Defaults to `"left"` (before the label). */
  iconPosition?: DsBadgeIconPosition;
  /**
   * @deprecated Prefer `icon` (with `iconPosition="left"`, the default). Still fully supported
   * for existing call sites and for the two-icon (`left` + `right`) combination.
   * Figma boolean property: `showIconLeft`
   */
  showIconLeft?: boolean;
  /**
   * @deprecated Prefer `icon` with `iconPosition="right"`. Still fully supported for existing
   * call sites and for the two-icon (`left` + `right`) combination.
   * Figma boolean property: `showIconRight`
   */
  showIconRight?: boolean;
  /** @deprecated Prefer `icon`. Optional swap for the left icon slot (shown when `showIconLeft` is true, or implicitly when `icon`/`iconPosition="left"` is used). */
  leftIcon?: ReactNode;
  /** @deprecated Prefer `icon` with `iconPosition="right"`. Optional swap for the right icon slot. */
  rightIcon?: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className">;

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Figma: Badge component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 488:1944.
 * Axes: Variant × State.
 *
 * Icon API: use `icon` (+ optional `iconPosition`) for the common single-icon case.
 * The legacy `showIconLeft`/`showIconRight`/`leftIcon`/`rightIcon` props remain fully
 * functional (including the two-icon combination) for existing call sites.
 */
export function DsBadge({
  children,
  variant = "primary",
  state = "default",
  icon,
  iconPosition = "left",
  showIconLeft = false,
  showIconRight = false,
  leftIcon,
  rightIcon,
  className,
  ...rest
}: DsBadgeProps) {
  const hasIconProp = icon !== undefined;

  const resolvedShowIconLeft = showIconLeft || (hasIconProp && iconPosition === "left");
  const resolvedShowIconRight = showIconRight || (hasIconProp && iconPosition === "right");

  const leftIconNode = leftIcon ?? (hasIconProp && iconPosition === "left" ? icon : undefined) ?? <Plus aria-hidden />;
  const rightIconNode =
    rightIcon ?? (hasIconProp && iconPosition === "right" ? icon : undefined) ?? <Plus aria-hidden />;

  return (
    <span
      className={classNames("ds-badge", `ds-badge--${variant}`, className)}
      data-component="badge"
      data-figma-node="488:1944"
      data-variant={variant}
      data-state={state}
      data-show-icon-left={resolvedShowIconLeft ? "true" : "false"}
      data-show-icon-right={resolvedShowIconRight ? "true" : "false"}
      {...rest}
    >
      {resolvedShowIconLeft ? (
        <span className="ds-badge__icon ds-badge__icon--left">{leftIconNode}</span>
      ) : null}
      <DsTypography as="span" variant="paragraph-mini-bold" color="inherit" className="ds-badge__text">
        {children}
      </DsTypography>
      {resolvedShowIconRight ? (
        <span className="ds-badge__icon ds-badge__icon--right">{rightIconNode}</span>
      ) : null}
    </span>
  );
}
