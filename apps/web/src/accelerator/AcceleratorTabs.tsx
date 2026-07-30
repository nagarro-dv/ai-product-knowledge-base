import { Check, Lock } from "lucide-react";
import { DsTypography } from "../components/ds/DsTypography";
import "./AcceleratorTabs.css";

export type TabId = "overview" | "directions" | "implementation";

type TabDefinition = {
  id: TabId;
  label: string;
};

const TABS: readonly TabDefinition[] = [
  { id: "overview", label: "Overview" },
  { id: "directions", label: "Directions" },
  { id: "implementation", label: "Implementation" },
];

/**
 * Persistent, always-visible tab bar for one Change. Unlike the old
 * forward-only stage rail, every unlocked tab stays clickable for the rest
 * of the run — the shell tracks which tab is being viewed independently of
 * the underlying ToolState (see DsAcceleratorTool's viewOverride).
 */
export function AcceleratorTabs({
  activeTab,
  directionsUnlocked,
  implementationUnlocked,
  hasError,
  errorTab,
  onSelectTab,
}: {
  activeTab: TabId;
  directionsUnlocked: boolean;
  implementationUnlocked: boolean;
  hasError: boolean;
  errorTab: TabId;
  onSelectTab: (tab: TabId) => void;
}) {
  const isUnlocked = (id: TabId) =>
    id === "overview" || (id === "directions" ? directionsUnlocked : implementationUnlocked);
  // A tab reads as "done" once the next one has opened up — the same signal
  // that unlocked it in the first place, just read from the other side.
  const isDone = (id: TabId) =>
    (id === "overview" && directionsUnlocked) || (id === "directions" && implementationUnlocked);

  return (
    <div className="acceleratorTabs" role="tablist" aria-label="Change stages">
      {TABS.map((tab, index) => {
        const unlocked = isUnlocked(tab.id);
        const done = isDone(tab.id);
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={!unlocked}
            title={unlocked ? undefined : "Not available yet"}
            className={`acceleratorTabs__tab${isActive ? " acceleratorTabs__tab--active" : ""}${done ? " acceleratorTabs__tab--done" : ""}`}
            onClick={() => unlocked && onSelectTab(tab.id)}
          >
            <span className="acceleratorTabs__marker" aria-hidden>
              {!unlocked ? (
                <Lock size={11} strokeWidth={2} />
              ) : done ? (
                <Check size={11} strokeWidth={2.5} />
              ) : (
                index + 1
              )}
            </span>
            <DsTypography as="span" variant={isActive ? "paragraph-small-bold" : "paragraph-small"}>
              {tab.label}
            </DsTypography>
            {hasError && tab.id === errorTab ? (
              <span className="acceleratorTabs__errorDot" aria-label="This tab has an error" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
