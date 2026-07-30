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
