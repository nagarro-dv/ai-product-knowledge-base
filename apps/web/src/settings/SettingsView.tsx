import { AiProvidersView } from "../aiProviders/AiProvidersView";
import { WorkspaceView } from "../integrations/WorkspaceView";
import { DsTypography } from "../components/ds/DsTypography";
import "./SettingsView.css";

export type SettingsTab = "ai-models" | "workspace";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "ai-models", label: "AI Models" },
  { id: "workspace", label: "Workspace" },
];

/**
 * Configuration lives here, deliberately separate from the DS Accelerator
 * workflow — this is a place you visit occasionally to set things up, not a
 * peer "tool" you switch into during daily work. One lightweight tab switcher
 * instead of a full sidebar, since there are only two sections.
 */
export function SettingsView({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  return (
    <div className="settingsView">
      <header className="settingsView__header">
        <DsTypography as="h1" variant="heading-3">
          Settings
        </DsTypography>
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
      </header>
      <div className="settingsView__body">
        {activeTab === "ai-models" ? <AiProvidersView /> : <WorkspaceView />}
      </div>
    </div>
  );
}
