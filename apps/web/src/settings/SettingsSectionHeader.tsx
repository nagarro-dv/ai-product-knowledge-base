import { RefreshCw } from "lucide-react";
import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import "./SettingsSectionHeader.css";

/**
 * Where SettingsView wants the open tab's "Checked …" + Refresh: a spot in
 * the Settings title row, beside the tabs. Without one, they render inline.
 */
export const SettingsActionsSlot = createContext<HTMLElement | null>(null);

/**
 * Shared by both Settings tabs: the tab's description, and its "Checked …"
 * + Refresh, which go up beside the Settings tabs (SettingsActionsSlot) so
 * they sit in the exact same place on every tab.
 */
export function SettingsSectionHeader({
  description,
  lastCheckedLabel,
  onRefresh,
  refreshing,
}: {
  description: string;
  lastCheckedLabel?: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const slot = useContext(SettingsActionsSlot);
  const actions = (
    <div className="settingsSectionHeader__actions">
      {lastCheckedLabel ? (
        <DsTypography as="span" variant="paragraph-mini-regular" className="settingsSectionHeader__checkedAt">
          {lastCheckedLabel}
        </DsTypography>
      ) : null}
      <DsButton
        variant="ghost"
        size="mini"
        onClick={onRefresh}
        leftIcon={<RefreshCw size={12} aria-hidden className={refreshing ? "settingsSectionHeader__spin" : undefined} />}
        disabled={refreshing}
      >
        {refreshing ? "Checking…" : "Refresh"}
      </DsButton>
    </div>
  );
  return (
    <header className="settingsSectionHeader">
      <DsTypography as="p" variant="paragraph-regular" className="settingsSectionHeader__description">
        {description}
      </DsTypography>
      {slot ? createPortal(actions, slot) : actions}
    </header>
  );
}
