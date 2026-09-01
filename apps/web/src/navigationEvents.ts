import type { SettingsTab } from "./settings/SettingsView";

/**
 * Cross-view navigation events. Kept in a neutral module (not App.tsx) so
 * leaf components can dispatch them without creating an import cycle back
 * through App.tsx, which is what actually listens for them.
 */
export const OPEN_SETTINGS_EVENT = "ds-open-settings";

export function openSettings(tab?: SettingsTab): void {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: tab }));
}

/** Recent-runs history lives in the persistent app topbar (next to Settings) but its data/drawer are owned by DsAcceleratorTool — same cross-view pattern as OPEN_SETTINGS_EVENT, just reversed in direction. */
export const OPEN_HISTORY_EVENT = "ds-open-history";

export function openHistory(): void {
  window.dispatchEvent(new CustomEvent(OPEN_HISTORY_EVENT));
}
