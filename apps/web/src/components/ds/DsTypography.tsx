import {
  forwardRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type Ref,
  type ReactNode,
} from "react";

import type { DsTypographyVariant } from "./typography.types";
export type { DsTypographyVariant } from "./typography.types";

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type DsTypographyOwnProps = {
  as?: ElementType;
  variant?: DsTypographyVariant;
  children?: ReactNode;
  /** Optional override. When omitted, color inherits from context. */
  color?: string;
  className?: string;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset" | string;
  href?: string;
  target?: string;
  rel?: string;
  [key: string]: unknown;
};

export type DsTypographyProps = DsTypographyOwnProps &
  Omit<HTMLAttributes<HTMLElement>, keyof DsTypographyOwnProps | "color" | "children" | "style" | "className">;

const DsTypographyImpl = (
  { as, variant = "paragraph-regular", children, color, className, style, ...rest }: DsTypographyProps,
  ref: Ref<HTMLElement>
) => {
  const Component = (as ?? "span") as ElementType;
  const composedStyle = color === undefined ? style : { color, ...style };
  return (
    <Component
      ref={ref as never}
      className={classNames("ds-text", `ds-text--${variant}`, className)}
      style={composedStyle}
      {...(rest as object)}
    >
      {children}
    </Component>
  );
};

export const DsTypography = forwardRef<HTMLElement, DsTypographyProps>(DsTypographyImpl);

