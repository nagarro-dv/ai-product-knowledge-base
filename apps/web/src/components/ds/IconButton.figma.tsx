/**
 * Figma Code Connect — DsIconButton
 * Figma: file 8Ry9Oa2niLBGvoWPo9rLQT, node 220:64625
 */

// @ts-nocheck
import figma from "@figma/code-connect";
import { DsIconButton } from "./IconButton";

figma.connect(
  DsIconButton,
  "https://www.figma.com/design/8Ry9Oa2niLBGvoWPo9rLQT?node-id=220-64625",
  {
    props: {
      variant: figma.enum("Style", {
        Primary: "primary",
        Secondary: "secondary",
        Raised: "raised",
        Ghost: "ghost",
        Destructive: "destructive",
        Inverse: "inverse",
      }),
      size: figma.enum("Size", {
        Large: "large",
        Regular: "regular",
        Small: "small",
        Mini: "mini",
      }),
    },
    example: ({ variant, size }) => (
      <DsIconButton variant={variant} size={size} aria-label="Action">
        {/* pass any Lucide icon or SVG */}
        <MyIcon />
      </DsIconButton>
    ),
  }
);
