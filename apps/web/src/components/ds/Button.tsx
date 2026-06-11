import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";

import { DsTypography, type DsTypographyVariant } from "./DsTypography";
import "./Button.css";

/**
 * Figma: Button component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 33:476.
 * Axes: Style × Size; optional LeftIcon / RightIcon slots (boolean-driven in Figma → pass nodes or omit).
 */
export type DsButtonVariant = "primary" | "secondary" | "raised" | "ghost" | "destructive" | "inverse";
export type DsButtonSize = "large" | "regular" | "small" | "mini";

export type DsButtonProps = {
  children: ReactNode;
  variant?: DsButtonVariant;
  size?: DsButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  className?: string;
};

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const DsButton = forwardRef<HTMLButtonElement, DsButtonProps>(function DsButton(
  {
    children,
    variant = "primary",
    size = "regular",
    leftIcon,
    rightIcon,
    className,
    type = "button",
    disabled,
    ...rest
  },
  ref
) {
  const isRaised = variant === "raised";
  const textVariant: DsTypographyVariant =
    size === "large" ? "paragraph-regular" : size === "mini" ? "paragraph-mini" : "paragraph-small";

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={classNames("ds-btn", `ds-btn--${variant}`, className)}
      data-size={size}
      data-variant={variant}
      data-component="button"
      data-figma-node="33:476"
      {...rest}
    >
      {isRaised && (
        <>
          <span className="ds-btn__raised-underlay" aria-hidden />
          <span className="ds-btn__raised-inner" aria-hidden />
        </>
      )}
      {leftIcon != null ? <span className="ds-btn__icon">{leftIcon}</span> : null}
      <DsTypography as="span" variant={textVariant} color="inherit" className="ds-btn__text">
        {children}
      </DsTypography>
      {rightIcon != null ? <span className="ds-btn__icon">{rightIcon}</span> : null}
    </button>
  );
});

/** Placeholder icon matching Figma “Icon / Placeholder” slot (currentColor, token-sized via parent .ds-btn__icon). */
export function DsButtonIconPlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 6v12M6 12h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
