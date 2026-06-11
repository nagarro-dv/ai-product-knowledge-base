import { forwardRef } from "react";

import { DsTypography, type DsTypographyProps } from "./DsTypography";

export type { DsTypographyVariant } from "./typography.types";

export type DsTextProps = Omit<DsTypographyProps, "as">;

export const DsText = forwardRef<HTMLSpanElement, DsTextProps>(function DsText(props, ref) {
  return <DsTypography {...props} as="span" ref={ref} />;
});
