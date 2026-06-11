import Dark from "./appearance/Dark.json";
import Light from "./appearance/Light.json";
import Compact from "./density/Compact.json";
import Standard from "./density/Standard.json";
import Comfortable from "./density/Comfortable.json";
import defaultTheme from "./theme/default.json";
import nagarroTheme from "./theme/nagarro.json";
import type { Mode } from "./mode";

function baseThemeFor(mode: Mode) {
  return mode.theme === "nagarro" ? nagarroTheme : defaultTheme;
}

export function createTokens(mode: Mode) {
  const appearance = mode.appearance === "Dark" ? Dark : Light;
  const density =
    mode.density === "Compact"
      ? Compact
      : mode.density === "Comfortable"
        ? Comfortable
        : Standard;

  const baseTheme = baseThemeFor(mode);
  const context = {
    ...appearance,
    ...density,
  };

  const themePass1 = resolveObject(baseTheme, context) as Record<string, unknown>;
  const theme = resolveObject(baseTheme, {
    ...context,
    general: themePass1.general,
  });

  return {
    appearance,
    density,
    theme,
  };
}

function isAlias(value: string) {
  return value.startsWith("{") && value.endsWith("}");
}

function getValueFromPath(obj: unknown, path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function unwrapPrimitive(v: unknown): unknown {
  if (v !== null && typeof v === "object" && "value" in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean") {
      return inner;
    }
  }
  return v;
}

function resolveValue(value: unknown, context: unknown): unknown {
  if (typeof value === "string" && isAlias(value)) {
    const path = value.replace(/[{}]/g, "");
    const resolved = getValueFromPath(context, path);
    return unwrapPrimitive(resolved);
  }
  return value;
}

function resolveObject(obj: unknown, context: unknown): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const key in obj as Record<string, unknown>) {
    const value = (obj as Record<string, unknown>)[key];

    if (value !== null && typeof value === "object" && "value" in value) {
      result[key] = resolveValue((value as { value: unknown }).value, context);
    } else {
      result[key] = resolveObject(value, context);
    }
  }

  return result;
}
