import { useState } from "react";
import { AiProvidersView } from "../aiProviders/AiProvidersView";
import { SettingsActionsSlot } from "./SettingsSectionHeader";
import { SourcesSettings } from "./SourcesSettings";
import { DsTypography } from "../components/ds/DsTypography";
import "./SettingsView.css";

export type SettingsTab = "ai-models" | "workspace";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "ai-models", label: "AI Models" },
  { id: "workspace", label: "Sources" },
];

/**
 * Configuration lives here, apart from the knowledge base itself — a place
 * you visit occasionally to set things up: the AI models, and the sources
 * the knowledge base learns from. One lightweight tab switcher instead of a
 * full sidebar, since there are only two sections.
 */
export function SettingsView({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  // Where the open tab's "Checked …" + Refresh go: beside the tabs, in the title row.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  return (
    <div className="settingsView">
      <header className="settingsView__header">
        <DsTypography as="h1" variant="heading-3">
          Settings
        </DsTypography>
        <div className="settingsView__headerEnd">
          <div className="settingsView__actions" ref={setActionsSlot} />
          <div className="settingsView__tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "settingsView__tab settingsView__tab--active" : "settingsView__tab"}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="settingsView__body">
        <SettingsActionsSlot.Provider value={actionsSlot}>
          {activeTab === "ai-models" ? <AiProvidersView /> : <SourcesSettings />}
        </SettingsActionsSlot.Provider>
      </div>
    </div>
  );
}
