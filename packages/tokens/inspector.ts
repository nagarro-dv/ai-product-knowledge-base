import type { Mode } from "./mode";
import defaultTheme from "./theme/default.json";
import nagarroTheme from "./theme/nagarro.json";
import { createTokens } from "./runtime";
import { flattenTheme, pathToCssVar } from "./flatten";

export type TokenInspectorEntry = {
  path: string;
  cssVar: string;
  resolved: string | number;
  rawValueInTheme: string | number | null;
  linkedPath: string | null;
  linkedPathResolved: string | number | null;
};

function getBaseTheme(theme: Mode["theme"]): Record<string, unknown> {
  return (theme === "nagarro" ? nagarroTheme : defaultTheme) as Record<string, unknown>;
}

function getRawThemeLeaf(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function interpretRawLeaf(leaf: unknown): {
  rawValueInTheme: string | number | null;
  linkedPath: string | null;
} {
  if (leaf === undefined || leaf === null) {
    return { rawValueInTheme: null, linkedPath: null };
  }
  if (typeof leaf === "string" || typeof leaf === "number") {
    return { rawValueInTheme: leaf, linkedPath: null };
  }
  if (typeof leaf === "object" && !Array.isArray(leaf) && "value" in leaf) {
    const v = (leaf as { value: unknown }).value;
    if (typeof v === "string") {
      if (v.startsWith("{") && v.endsWith("}")) {
        const inner = v.slice(1, -1);
        return { rawValueInTheme: v, linkedPath: inner };
      }
      return { rawValueInTheme: v, linkedPath: null };
    }
    if (typeof v === "number") {
      return { rawValueInTheme: v, linkedPath: null };
    }
  }
  return { rawValueInTheme: null, linkedPath: null };
}

export function getTokenInspectorRows(mode: Mode): TokenInspectorEntry[] {
  const { theme } = createTokens(mode);
  const flat: Record<string, string | number> = {};
  flattenTheme(theme, "", flat);

  const base = getBaseTheme(mode.theme);
  const rows: TokenInspectorEntry[] = [];

  for (const path of Object.keys(flat).sort()) {
    const resolved = flat[path];
    if (resolved === undefined) continue;

    const leaf = getRawThemeLeaf(base, path);
    const { rawValueInTheme, linkedPath } = interpretRawLeaf(leaf);

    let linkedPathResolved: string | number | null = null;
    if (linkedPath && flat[linkedPath] !== undefined) {
      linkedPathResolved = flat[linkedPath];
    }

    rows.push({
      path,
      cssVar: pathToCssVar(path),
      resolved,
      rawValueInTheme,
      linkedPath,
      linkedPathResolved,
    });
  }

  return rows;
}
