import { DsTypography } from "./DsTypography";
import type { DsTypographyVariant } from "./typography.types";

const variants: DsTypographyVariant[] = [
  "heading-1",
  "heading-2",
  "heading-3",
  "heading-4",
  "heading-5",
  "paragraph-default",
  "paragraph-large",
  "paragraph-regular",
  "paragraph-medium",
  "paragraph-bold",
  "paragraph-small",
  "paragraph-small-regular",
  "paragraph-small-medium",
  "paragraph-small-bold",
  "paragraph-mini",
  "paragraph-mini-regular",
  "paragraph-mini-medium",
  "paragraph-mini-bold",
  "monospace",
];

export function TypographyShowcase() {
  return (
    <section
      style={{
        display: "grid",
        gap: "12px",
        padding: "24px",
        background: "var(--ds-general-color-background)",
        color: "var(--ds-general-color-foreground)",
      }}
    >
      {variants.map((variant) => (
        <div
          key={variant}
          style={{
            display: "grid",
            gap: "4px",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid var(--ds-general-color-muted)",
            background: "var(--ds-general-color-surface)",
          }}
        >
          <DsTypography as="span" variant="paragraph-mini-medium" color="var(--ds-general-color-muted-foreground)">
            {variant}
          </DsTypography>
          <DsTypography as="p" variant={variant}>
            The quick brown fox jumps over the lazy dog.
          </DsTypography>
        </div>
      ))}
    </section>
  );
}
