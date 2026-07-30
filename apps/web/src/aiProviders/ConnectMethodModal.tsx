import { AlertTriangle, Check, Copy, KeyRound, Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  disconnectAuthMethod,
  reconnectAuthMethod,
  refreshAgentProviders,
  type AgentAuthMethod,
  type AgentProvider,
} from "../agentSseClient";
import { DsButton } from "../components/ds/Button";
import { DsIconButton } from "../components/ds/IconButton";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import { DisconnectConfirm } from "./DisconnectConfirm";
import "./ConnectMethodModal.css";

function CopyChip({ value, ariaLabel }: { value: string; ariaLabel: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (permissions/insecure context) — the value is
      // still selectable text in the chip, so the user can copy manually.
    }
  };

  return (
    <div className="connectModal__chip">
      <code className="connectModal__chipCode">{value}</code>
      <DsIconButton
        variant="ghost"
        size="mini"
        aria-label={copied ? "Copied" : ariaLabel}
        onClick={() => void copy()}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </DsIconButton>
    </div>
  );
}

export function ConnectMethodModal({
  provider,
  method,
  onProvidersUpdated,
  onClose,
  onRequestReturnFocus,
}: {
  provider: AgentProvider;
  method: AgentAuthMethod;
  /** Receives the fresh provider list after a successful check-again, disconnect, or reconnect. */
  onProvidersUpdated: (providers: AgentProvider[]) => void;
  onClose: () => void;
  /** Called on close so focus can return to whatever row/button opened this modal. */
  onRequestReturnFocus?: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `connect-modal-title-${method.id}`;

  useEffect(() => {
    primaryButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      onRequestReturnFocus?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLocalRuntime = method.kind === "local-runtime";

  const handleCheckAgain = async () => {
    setChecking(true);
    setErrorMessage(null);
    try {
      // For local-runtime methods this also clears any in-app disconnect —
      // harmless no-op if it was never dismissed — so "I've signed in" always
      // works whether this is a genuine first sign-in or a reconnect.
      const providers = isLocalRuntime
        ? await reconnectAuthMethod(provider.id, method.id)
        : await refreshAgentProviders();
      onProvidersUpdated(providers);
      setCheckedOnce(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const providers = await disconnectAuthMethod(provider.id, method.id);
      onProvidersUpdated(providers);
      setConfirmingDisconnect(false);
      setCheckedOnce(false);
      setSuccessMessage(
        `Disconnected. DS Accelerator won't use your ${method.label} sign-in until you reconnect it — your session on this computer is unaffected.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="connectModal__root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="connectModal__backdrop"
        aria-label="Close"
        onClick={() => {
          onClose();
          onRequestReturnFocus?.();
        }}
      />
      <div className="connectModal">
        <header className="connectModal__header">
          <div className="connectModal__headerIcon" aria-hidden>
            {isLocalRuntime ? <Terminal size={18} /> : <KeyRound size={18} />}
          </div>
          <DsTypography as="h2" id={titleId} variant="heading-5" className="connectModal__title">
            {isLocalRuntime ? `Connect ${method.label}` : `Set up ${provider.label}`}
          </DsTypography>
          <DsIconButton
            variant="ghost"
            size="small"
            aria-label="Close dialog"
            className="connectModal__closeButton"
            onClick={() => {
              onClose();
              onRequestReturnFocus?.();
            }}
          >
            <X size={16} aria-hidden />
          </DsIconButton>
        </header>

        {errorMessage ? (
          <div className="connectModal__errorBanner" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <DsTypography as="p" variant="paragraph-small">
              {errorMessage}
            </DsTypography>
          </div>
        ) : null}

        {successMessage ? (
          <div className="connectModal__resultBanner" role="status" aria-live="polite">
            <Check size={16} aria-hidden />
            <DsTypography as="p" variant="paragraph-small">
              {successMessage}
            </DsTypography>
          </div>
        ) : null}

        {method.status === "unavailable" && method.error ? (
          <div className="connectModal__errorBanner">
            <AlertTriangle size={16} aria-hidden />
            <div>
              <DsTypography as="p" variant="paragraph-small-bold">
                This wasn't working last time we checked
              </DsTypography>
              <DsTypography as="p" variant="paragraph-small">
                {method.error}
              </DsTypography>
            </div>
          </div>
        ) : null}

        {isLocalRuntime ? (
          <div className="connectModal__body">
            <DsTypography as="p" variant="paragraph-regular">
              This uses your personal {provider.label} plan on this computer — nothing is shared with teammates, and
              no API key is needed.
            </DsTypography>
            <ol className="connectModal__steps">
              <li>
                <DsTypography as="p" variant="paragraph-regular">
                  Open a terminal on this computer.
                </DsTypography>
              </li>
              <li>
                <DsTypography as="p" variant="paragraph-regular">
                  Run this command and follow the sign-in steps:
                </DsTypography>
                {method.signInCommand ? (
                  <CopyChip value={method.signInCommand} ariaLabel="Copy sign-in command" />
                ) : (
                  <DsTypography as="p" variant="paragraph-small">
                    {method.hint}
                  </DsTypography>
                )}
              </li>
              <li>
                <DsTypography as="p" variant="paragraph-regular">
                  Come back here and select "I've signed in".
                </DsTypography>
              </li>
            </ol>
            {method.installUrl ? (
              <DsTypography as="p" variant="paragraph-mini-regular" className="connectModal__footnote">
                Don't have {method.label} installed? Visit {method.installUrl.replace(/^https?:\/\//, "")} for setup
                instructions.
              </DsTypography>
            ) : null}
          </div>
        ) : (
          <div className="connectModal__body">
            <DsTypography as="p" variant="paragraph-regular">
              {provider.label} is set up once, centrally, by your workspace admin — not by individual users. This
              keeps billing and access in one place.
            </DsTypography>
            <div className="connectModal__adminCard">
              <DsTypography as="p" variant="paragraph-small-bold">
                For your admin
              </DsTypography>
              <DsTypography as="p" variant="paragraph-small">
                Add this key to the assistant service, then restart it:
              </DsTypography>
              {method.envVar ? (
                <CopyChip value={method.envVar} ariaLabel="Copy setting name" />
              ) : (
                <DsTypography as="p" variant="paragraph-small">
                  {method.hint}
                </DsTypography>
              )}
            </div>
            {method.envVar ? (
              <button type="button" className="connectModal__disclosure" onClick={() => setShowTechnical((v) => !v)}>
                {showTechnical ? "Hide" : "Show"} technical details
              </button>
            ) : null}
            {showTechnical ? (
              <DsTypography as="p" variant="paragraph-mini-regular" className="connectModal__footnote">
                {method.hint}
              </DsTypography>
            ) : null}
            <DsTypography as="p" variant="paragraph-mini-regular" className="connectModal__footnote">
              Already an admin and just added this? Check again below — no restart needed to see it appear here
              once the service picks it up.
            </DsTypography>
          </div>
        )}

        {checkedOnce && !checking ? (
          <div className="connectModal__resultBanner" role="status" aria-live="polite">
            {method.ok ? (
              <>
                <Check size={16} aria-hidden />
                <DsTypography as="p" variant="paragraph-small">
                  Connected — you're all set.
                </DsTypography>
              </>
            ) : (
              <DsTypography as="p" variant="paragraph-small">
                Still not connected. {isLocalRuntime ? "Make sure the sign-in finished in your terminal." : "Double-check the key, then try again."}
              </DsTypography>
            )}
          </div>
        ) : null}

        {confirmingDisconnect ? (
          <footer className="connectModal__actions">
            <DisconnectConfirm
              providerLabel={provider.label}
              busy={busy}
              onCancel={() => setConfirmingDisconnect(false)}
              onConfirm={() => void handleDisconnect()}
            />
          </footer>
        ) : (
          <footer className="connectModal__actions">
            {isLocalRuntime && method.ok ? (
              <>
                <DsButton variant="destructive" size="small" onClick={() => setConfirmingDisconnect(true)} disabled={busy}>
                  Disconnect
                </DsButton>
                <div className="connectModal__actionsSpacer" />
              </>
            ) : null}
            <DsButton
              variant="ghost"
              size="small"
              onClick={() => {
                onClose();
                onRequestReturnFocus?.();
              }}
            >
              Close
            </DsButton>
            <DsButton
              ref={primaryButtonRef}
              variant="primary"
              size="small"
              onClick={() => void handleCheckAgain()}
              disabled={checking}
              leftIcon={checking ? <DsSpinner size={14} aria-hidden /> : undefined}
            >
              {checking
                ? "Checking…"
                : method.status === "unavailable"
                  ? "Reconnect"
                  : isLocalRuntime
                    ? "I've signed in — check again"
                    : "Check again"}
            </DsButton>
          </footer>
        )}
      </div>
    </div>
  );
}
