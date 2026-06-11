import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";

import { DsTypography, type DsTypographyVariant } from "./DsTypography";
import "./LinkButton.css";

/**
 * Figma: Link Button component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 2500:8380 (doc frame 2688:15957).
 * Axes: Type (Accent | Primary) × Size; optional LeftIcon / RightIcon (Figma booleans).
 */
export type DsLinkButtonVariant = "accent" | "primary";
export type DsLinkButtonSize = "default" | "large" | "small" | "mini";

type SharedLinkButtonProps = {
  children: ReactNode;
  variant?: DsLinkButtonVariant;
  size?: DsLinkButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
};

export type DsLinkButtonAsAnchor = SharedLinkButtonProps & {
  href: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedLinkButtonProps | "className">;

export type DsLinkButtonAsButton = SharedLinkButtonProps & {
  href?: undefined;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedLinkButtonProps | "className">;

export type DsLinkButtonProps = DsLinkButtonAsAnchor | DsLinkButtonAsButton;

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const DsLinkButton = forwardRef<HTMLAnchorElement | HTMLButtonElement, DsLinkButtonProps>(
  function DsLinkButton(props, ref) {
    const {
      children,
      variant = "accent",
      size = "default",
      leftIcon,
      rightIcon,
      className,
      href,
      ...rest
    } = props;

    const rootClass = classNames("ds-link-btn", `ds-link-btn--${variant}`, className);
    const textVariant: DsTypographyVariant =
      size === "large" ? "paragraph-regular" : size === "mini" ? "paragraph-mini" : "paragraph-small";

    const inner = (
      <>
        {leftIcon != null ? <span className="ds-link-btn__icon">{leftIcon}</span> : null}
        <DsTypography as="span" variant={textVariant} color="inherit" className="ds-link-btn__text">
          {children}
        </DsTypography>
        {rightIcon != null ? <span className="ds-link-btn__icon">{rightIcon}</span> : null}
      </>
    );

    const dataAttrs = {
      "data-component": "link-button",
      "data-variant": variant,
      "data-size": size,
      "data-figma-node": "2500:8380",
    } as const;

    if (typeof href === "string") {
      return (
        <a
          ref={ref as Ref<HTMLAnchorElement>}
          href={href}
          className={rootClass}
          {...dataAttrs}
          {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {inner}
        </a>
      );
    }

    const { type = "button", disabled, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type={type}
        disabled={disabled}
        className={rootClass}
        {...dataAttrs}
        {...buttonRest}
      >
        {inner}
      </button>
    );
  }
);

/** Placeholder icon matching Figma “Icon / Placeholder”; inherits `currentColor`. */
export function DsLinkButtonIconPlaceholder() {
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

/** Right chevron for Link Button `RightIcon` (Figma boolean); inherits `currentColor`, sized by `--ds-link-btn-icon-size`. */
export function DsLinkButtonChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
