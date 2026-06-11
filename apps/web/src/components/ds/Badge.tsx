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

export type DsBadgeProps = {
  children: ReactNode;
  variant?: DsBadgeVariant;
  state?: DsBadgeState;
  /** Figma boolean property: `showIconLeft` */
  showIconLeft?: boolean;
  /** Figma boolean property: `showIconRight` */
  showIconRight?: boolean;
  /** Optional swap for the left icon slot (shown when `showIconLeft` is true). */
  leftIcon?: ReactNode;
  /** Optional swap for the right icon slot (shown when `showIconRight` is true). */
  rightIcon?: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className">;

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Figma: Badge component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 488:1944.
 * Axes: Variant × State.
 */
export function DsBadge({
  children,
  variant = "primary",
  state = "default",
  showIconLeft = false,
  showIconRight = false,
  leftIcon,
  rightIcon,
  className,
  ...rest
}: DsBadgeProps) {
  const leftIconNode = leftIcon ?? <Plus aria-hidden />;
  const rightIconNode = rightIcon ?? <Plus aria-hidden />;

  return (
    <span
      className={classNames("ds-badge", `ds-badge--${variant}`, className)}
      data-component="badge"
      data-figma-node="488:1944"
      data-variant={variant}
      data-state={state}
      data-show-icon-left={showIconLeft ? "true" : "false"}
      data-show-icon-right={showIconRight ? "true" : "false"}
      {...rest}
    >
      {showIconLeft ? <span className="ds-badge__icon ds-badge__icon--left">{leftIconNode}</span> : null}
      <DsTypography as="span" variant="paragraph-mini-bold" color="inherit" className="ds-badge__text">
        {children}
      </DsTypography>
      {showIconRight ? <span className="ds-badge__icon ds-badge__icon--right">{rightIconNode}</span> : null}
    </span>
  );
}
