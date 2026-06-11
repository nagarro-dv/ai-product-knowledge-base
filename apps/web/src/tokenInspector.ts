import { getTokenInspectorRows } from "@ds-starter/tokens";
import type { Mode } from "@ds-starter/tokens";

export type InspectorRow = {
  rowId: string;
  logicalPath: string;
  cssVar: string;
  type: string;
  alias: string | null;
  resolvedLight: string;
  resolvedDark: string;
  sourceLayer: string;
  wfSizing: string | null;
};

function inferType(path: string, resolved: string | number): string {
  if (typeof resolved === "string") {
    if (resolved.startsWith("#") || resolved.startsWith("rgb")) return "color";
    if (path.includes("font-family")) return "text";
  }
  if (path.includes("color.")) return "color";
  if (path.includes("typography.") && path.includes("font")) return "text";
  if (typeof resolved === "number") return "number";
  return "string";
}

export function buildInspectorRows(mode: Mode): InspectorRow[] {
  const lightRows = getTokenInspectorRows({ ...mode, appearance: "Light" });
  const darkRows = getTokenInspectorRows({ ...mode, appearance: "Dark" });
  const darkByPath = new Map(darkRows.map((row) => [row.path, row.resolved]));

  return lightRows.map((row) => ({
    rowId: row.cssVar,
    logicalPath: row.path,
    cssVar: row.cssVar,
    type: inferType(row.path, row.resolved),
    alias: row.linkedPath,
    resolvedLight: String(row.resolved),
    resolvedDark: String(darkByPath.get(row.path) ?? row.resolved),
    sourceLayer: "ds-tokens",
    wfSizing: null,
  }));
}
