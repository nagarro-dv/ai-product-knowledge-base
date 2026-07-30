import { RefreshCw } from "lucide-react";
import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import "./SettingsSectionHeader.css";

/**
 * Shared by both Settings tabs so "Refresh" sits in the exact same place
 * regardless of how long the description text is — the description always
 * gets its own full-width row, and the actions row is a separate row below
 * it, not a flex sibling that can wrap unpredictably.
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
  return (
    <header className="settingsSectionHeader">
      <DsTypography as="p" variant="paragraph-regular" className="settingsSectionHeader__description">
        {description}
      </DsTypography>
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
    </header>
  );
}
