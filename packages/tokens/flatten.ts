/**
 * Shared flatten + CSS var naming (used by CSS build + token inspector).
 */

export function flattenTheme(obj: unknown, prefix: string, out: Record<string, string | number>): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    if (prefix && (typeof obj === "string" || typeof obj === "number")) {
      out[prefix] = obj;
    }
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k.startsWith("$")) continue;
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flattenTheme(v, p, out);
    } else if (v !== undefined && (typeof v === "string" || typeof v === "number")) {
      out[p] = v;
    }
  }
}

export function pathToCssVar(pathKey: string): string {
  return `--ds-${pathKey.replace(/\./g, "-")}`;
}

export function isBracketAlias(value: string): boolean {
  return value.startsWith("{") && value.endsWith("}");
}

/** CSS font-family names with spaces (e.g. `Equip Extended`) must be quoted; Safari drops invalid stacks more strictly than Chrome. */
const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
]);

/**
 * Map Token Studio / Figma font names to the family name registered in web `@font-face`
 * (e.g. Fontsource). JSON stays designer-facing per token-consistency skill.
 */
export function mapDesignerFontFamilyToWebCss(value: string): string {
  const t = value.trim();
  if (t === "Geist" || t === "Equip") return "Geist Sans";
  if (t === "Equip Extended") return "Geist Sans";
  return value;
}

export function quoteFontFamilyToken(value: string): string {
  return value
    .split(",")
    .map((segment) => {
      const part = segment.trim();
      if (!part) return "";
      const unquoted = part.replace(/^["']|["']$/g, "");
      const lower = unquoted.toLowerCase();
      if (GENERIC_FONT_FAMILIES.has(lower)) return unquoted;
      // Single CSS identifier: no quotes required (Geist, Menlo, Equip).
      if (/^[-a-zA-Z0-9]+$/.test(unquoted)) return unquoted;
      const escaped = unquoted.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    })
    .filter(Boolean)
    .join(", ");
}

export function formatCssValue(path: string, value: string | number): string {
  if (typeof value === "string") {
    if (isBracketAlias(value)) return "";
    if (path.includes("font-family")) {
      return quoteFontFamilyToken(mapDesignerFontFamilyToWebCss(value));
    }
    return value;
  }
  const leaf = path.split(".").pop() ?? "";
  if (leaf.includes("weight") || leaf === "opacity") return String(value);
  if (typeof value === "number" && value > 0 && value < 1 && !Number.isInteger(value)) return String(value);
  return `${value}px`;
}
