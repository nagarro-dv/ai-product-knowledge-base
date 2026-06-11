/**
 * Figma Code Connect — DsProgressLinear (Progress Linear)
 * Figma: file 8Ry9Oa2niLBGvoWPo9rLQT, node 2053:3292
 */

// @ts-nocheck
import figma from "@figma/code-connect";
import { DsProgressLinear } from "./ProgressLinear";

figma.connect(
  DsProgressLinear,
  "https://www.figma.com/design/8Ry9Oa2niLBGvoWPo9rLQT?node-id=2053-3292",
  {
    props: {
      variant: figma.enum("Variant", {
        Primary: "primary",
        Warning: "warning",
        Error: "error",
        Success: "success",
        Accent: "accent",
        Neutral: "neutral",
      }),
    },
    example: ({ variant }) => (
      <DsProgressLinear
        value={65}
        variant={variant}
        label="Progress"
        showLabel
      />
    ),
  }
);
