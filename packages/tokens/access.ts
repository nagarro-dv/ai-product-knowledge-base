/**
 * Read a nested token value by dot path, e.g. `"general.color.foreground"`.
 * Matches how Figma variable paths are often written; use with resolved `theme` from `createTokens`.
 */
export function tokenAt<T = unknown>(root: unknown, path: string): T | undefined {
  if (path === "") return root as T;
  let cur: unknown = root;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur as T | undefined;
}

/** Leaf tokens in the resolved theme are often `{ value, type, ... }`; this returns the primitive for RN styles. */
export function tokenValue(
  root: unknown,
  path: string
): string | number | undefined {
  const v = tokenAt<unknown>(root, path);
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "value" in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === "string" || typeof inner === "number") return inner;
  }
  return undefined;
}
