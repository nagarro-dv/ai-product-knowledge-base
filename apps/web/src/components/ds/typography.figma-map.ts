import type { DsTypographyVariant } from "./typography.types";

const styleToVariant: Record<string, DsTypographyVariant> = {
  heading1: "heading-1",
  heading2: "heading-2",
  heading3: "heading-3",
  heading4: "heading-4",
  heading5: "heading-5",
  paragraphdefault: "paragraph-default",
  paragraphlarge: "paragraph-large",
  paragraphregular: "paragraph-regular",
  paragraphmedium: "paragraph-medium",
  paragraphbold: "paragraph-bold",
  paragraphsmallregular: "paragraph-small-regular",
  paragraphsmall: "paragraph-small",
  paragraphsmallmedium: "paragraph-small-medium",
  paragraphsmallbold: "paragraph-small-bold",
  paragraphminiregular: "paragraph-mini-regular",
  paragraphmini: "paragraph-mini",
  paragraphminimedium: "paragraph-mini-medium",
  paragraphminibold: "paragraph-mini-bold",
  monospace: "monospace",
  monospaced: "monospace",
};

function normalizeFigmaTextStyle(textStyleName: string): string {
  return textStyleName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getDsTypographyVariantFromFigmaTextStyle(
  textStyleName: string
): DsTypographyVariant | undefined {
  return styleToVariant[normalizeFigmaTextStyle(textStyleName)];
}

export { normalizeFigmaTextStyle };
