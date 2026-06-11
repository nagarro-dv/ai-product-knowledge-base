import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import "./IconButton.css";

/**
 * Figma: Icon Button component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 220:64625 (doc frame 2688:14717).
 * Axes: Style × Size; icon slot via `children` (pass SVG or `DsIconButtonIconPlaceholder`).
 */
export type DsIconButtonVariant = "primary" | "secondary" | "raised" | "ghost" | "destructive" | "inverse";
export type DsIconButtonSize = "large" | "regular" | "small" | "mini";

export type DsIconButtonProps = {
  children: ReactNode;
  variant?: DsIconButtonVariant;
  size?: DsIconButtonSize;
  /** Required for icon-only controls when no visible label. */
  "aria-label": string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  className?: string;
};

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const DsIconButton = forwardRef<HTMLButtonElement, DsIconButtonProps>(function DsIconButton(
  { children, variant = "primary", size = "regular", className, type = "button", disabled, ...rest },
  ref
) {
  const isRaised = variant === "raised";

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={classNames("ds-icon-btn", `ds-icon-btn--${variant}`, className)}
      data-size={size}
      data-variant={variant}
      data-component="icon-button"
      data-figma-node="220:64625"
      {...rest}
    >
      {isRaised && (
        <>
          <span className="ds-icon-btn__raised-underlay" aria-hidden />
          <span className="ds-icon-btn__raised-inner" aria-hidden />
        </>
      )}
      <span className="ds-icon-btn__icon">{children}</span>
    </button>
  );
});

/** Placeholder icon matching Figma “Icon / Placeholder” (diamond), `currentColor` + token sizing. */
export function DsIconButtonIconPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4.5 19.5 12 12 19.5 4.5 12 12 4.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
