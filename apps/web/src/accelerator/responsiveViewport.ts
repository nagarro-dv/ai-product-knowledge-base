/**
 * Shared viewport state for the Compare-directions responsive review: ONE
 * value governs the Original component preview and every direction's
 * preview at once, so "how does this behave at a given width" is always
 * answered by comparing all of them together, not by toggling cards one at
 * a time. Desktop is deliberately the fluid, zero-config default — nothing
 * about today's preview behavior changes until a user explicitly picks
 * Tablet/Mobile or drags a frame's resize handle.
 */

export type ViewportPreset = "desktop" | "tablet" | "mobile" | "custom";
export type ViewportOrientation = "portrait" | "landscape";

export type ResponsiveViewport = {
  preset: ViewportPreset;
  /** px; ignored while preset === "desktop" (desktop is always fluid, width: 100%). */
  width: number;
  /** px; ignored while preset === "desktop". */
  height: number;
  orientation: ViewportOrientation;
};

const DEVICE_BASE_DIMENSIONS: Record<"tablet" | "mobile", { width: number; height: number }> = {
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

export const VIEWPORT_MIN_WIDTH = 280;
export const VIEWPORT_MAX_WIDTH = 1600;
const DEFAULT_CUSTOM_HEIGHT = 520;

export const DEFAULT_VIEWPORT: ResponsiveViewport = {
  preset: "desktop",
  width: 1024,
  height: 640,
  orientation: "landscape",
};

export function presetLabel(preset: ViewportPreset): string {
  if (preset === "desktop") return "Desktop";
  if (preset === "tablet") return "Tablet";
  if (preset === "mobile") return "Mobile";
  return "Custom";
}

/** Resolves a device preset click into a full viewport state, applying the requested orientation. */
export function viewportForPreset(preset: "tablet" | "mobile", orientation: ViewportOrientation): ResponsiveViewport {
  const base = DEVICE_BASE_DIMENSIONS[preset];
  const dimensions = orientation === "landscape" ? { width: base.height, height: base.width } : base;
  return { preset, width: dimensions.width, height: dimensions.height, orientation };
}

/** Flips the current viewport's orientation — a no-op for desktop/custom, where orientation isn't a meaningful concept. */
export function withFlippedOrientation(viewport: ResponsiveViewport): ResponsiveViewport {
  if (viewport.preset !== "tablet" && viewport.preset !== "mobile") return viewport;
  const orientation: ViewportOrientation = viewport.orientation === "portrait" ? "landscape" : "portrait";
  return viewportForPreset(viewport.preset, orientation);
}

/** Called while dragging a frame's resize handle — always switches into "custom", clamped to a sane range. */
export function withCustomWidth(viewport: ResponsiveViewport, rawWidth: number): ResponsiveViewport {
  const width = Math.round(Math.max(VIEWPORT_MIN_WIDTH, Math.min(VIEWPORT_MAX_WIDTH, rawWidth)));
  const height = viewport.preset === "desktop" ? DEFAULT_CUSTOM_HEIGHT : viewport.height;
  return { preset: "custom", width, height, orientation: viewport.orientation };
}
