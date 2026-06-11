import type { Mode } from "@ds-starter/tokens";

export const MODE_ATTR = {
  theme: "data-ds-theme",
  appearance: "data-ds-appearance",
  density: "data-ds-density",
} as const;

export type { Mode };

export function modeSnapshotKey(mode: Mode): string {
  return `${mode.theme}|${mode.appearance}|${mode.density}`;
}

export function parseModeFromDoc(el: HTMLElement): Mode {
  const themeAttr = el.getAttribute(MODE_ATTR.theme);
  const theme: Mode["theme"] = themeAttr === "nagarro" ? "nagarro" : "default";
  return {
    theme,
    appearance: (el.getAttribute(MODE_ATTR.appearance) as Mode["appearance"]) ?? "Light",
    density: (el.getAttribute(MODE_ATTR.density) as Mode["density"]) ?? "Standard",
  };
}

export function setModeOnDocument(mode: Mode): void {
  document.documentElement.setAttribute(MODE_ATTR.theme, mode.theme);
  document.documentElement.setAttribute(MODE_ATTR.appearance, mode.appearance);
  document.documentElement.setAttribute(MODE_ATTR.density, mode.density);
}
