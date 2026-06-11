/**
 * Figma Code Connect — DsButton
 * Run `npx @figma/code-connect publish` (after installing @figma/code-connect) to push to Figma.
 * Figma: file 8Ry9Oa2niLBGvoWPo9rLQT, node 33:476
 */

// @ts-nocheck — @figma/code-connect not installed; file serves as Code Connect source + MCP reference
import figma from "@figma/code-connect";
import { DsButton } from "./Button";

figma.connect(
  DsButton,
  "https://www.figma.com/design/8Ry9Oa2niLBGvoWPo9rLQT?node-id=33-476",
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
      leftIcon: figma.boolean("LeftIcon", {
        true: figma.instance("LeftIcon"),
        false: undefined,
      }),
      rightIcon: figma.boolean("RightIcon", {
        true: figma.instance("RightIcon"),
        false: undefined,
      }),
    },
    example: ({ variant, size, leftIcon, rightIcon }) => (
      <DsButton variant={variant} size={size} leftIcon={leftIcon} rightIcon={rightIcon}>
        Label
      </DsButton>
    ),
  }
);
