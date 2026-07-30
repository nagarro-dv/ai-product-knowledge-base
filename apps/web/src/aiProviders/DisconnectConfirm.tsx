import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import "./ConnectMethodModal.css";

/**
 * Shared confirmation step for disconnecting any auth method — used by both
 * PersonalKeyModal (personal API keys) and ConnectMethodModal (local-runtime
 * CLI sign-ins) so every provider's disconnect flow reads and behaves the
 * same way, per the product requirement that this be one reusable lifecycle
 * rather than a bespoke one per provider.
 */
export function DisconnectConfirm({
  providerLabel,
  busy,
  busyLabel = "Disconnecting…",
  onCancel,
  onConfirm,
}: {
  providerLabel: string;
  busy: boolean;
  busyLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="connectModal__confirm" role="alertdialog" aria-label={`Confirm disconnect ${providerLabel}`}>
      <DsTypography as="p" variant="paragraph-small">
        Disconnect {providerLabel}? You can reconnect at any time.
      </DsTypography>
      <DsButton variant="ghost" size="small" onClick={onCancel} disabled={busy}>
        Keep it
      </DsButton>
      <DsButton variant="destructive" size="small" onClick={onConfirm} disabled={busy}>
        {busy ? busyLabel : "Disconnect"}
      </DsButton>
    </div>
  );
}
