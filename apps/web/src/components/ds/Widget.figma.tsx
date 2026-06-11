/**
 * Figma Code Connect — Widget
 * Figma: file 8Ry9Oa2niLBGvoWPo9rLQT, node 2771:6507
 */

// @ts-nocheck
import figma from "@figma/code-connect";
import { Widget } from "./Widget";

figma.connect(
  Widget,
  "https://www.figma.com/design/8Ry9Oa2niLBGvoWPo9rLQT?node-id=2771-6507",
  {
    props: {
      surfaceStyle: figma.enum("Style", {
        Flat: "flat",
        Raised: "raised",
        Floating: "floating",
      }),
      background: figma.enum("Background", {
        Default: "default",
        "Background UI": "background",
        Muted: "muted",
      }),
    },
    example: ({ surfaceStyle, background }) => (
      <Widget surfaceStyle={surfaceStyle} background={background}>
        {/* widget content */}
      </Widget>
    ),
  }
);
