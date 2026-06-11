/**
 * Figma Code Connect — DsSpinner (Spinner)
 * Figma: file 8Ry9Oa2niLBGvoWPo9rLQT, node 2747:12962
 */

// @ts-nocheck
import figma from "@figma/code-connect";
import { DsSpinner } from "./Spinner";

figma.connect(
  DsSpinner,
  "https://www.figma.com/design/8Ry9Oa2niLBGvoWPo9rLQT?node-id=2747-12962",
  {
    props: {},
    example: () => (
      <DsSpinner size={24} aria-label="Loading" />
    ),
  }
);
