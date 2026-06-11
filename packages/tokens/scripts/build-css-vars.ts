/**
 * Emits semantic CSS custom properties from resolved tokens.
 * Output: apps/web/src/styles/tokens.generated.css (do not edit by hand).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { flattenTheme, formatCssValue, pathToCssVar } from "../flatten";
import type { Mode } from "../mode";
import { createTokens } from "../runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../../apps/web/src/styles/tokens.generated.css");

const MODES: Mode[] = [];
for (const theme of ["default", "nagarro"] as const) {
  for (const appearance of ["Light", "Dark"] as const) {
    for (const density of ["Compact", "Standard", "Comfortable"] as const) {
      MODES.push({ theme, appearance, density });
    }
  }
}

let css = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: packages/tokens/scripts/build-css-vars.ts
 * Regenerate: npm run tokens:build
 *
 * Set on <html>:
 *   data-ds-theme="default" | "nagarro"
 *   data-ds-appearance="Light" | "Dark"
 *   data-ds-density="Compact" | "Standard" | "Comfortable"
 */

`;

for (const mode of MODES) {
  const { theme } = createTokens(mode);
  const flat: Record<string, string | number> = {};
  flattenTheme(theme, "", flat);

  const selector = `[data-ds-theme="${mode.theme}"][data-ds-appearance="${mode.appearance}"][data-ds-density="${mode.density}"]`;
  css += `${selector} {\n`;
  for (const key of Object.keys(flat).sort()) {
    const val = flat[key];
    if (val === undefined) continue;
    const formatted = formatCssValue(key, val);
    if (formatted === "") continue;
    css += `  ${pathToCssVar(key)}: ${formatted};\n`;
  }
  css += "}\n\n";
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, css, "utf8");
console.log(`[build-css-vars] wrote ${OUT} (${MODES.length} mode blocks)`);
