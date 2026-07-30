import { AlertTriangle, Check, KeyRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { connectPersonalKey, disconnectPersonalKey, type AgentAuthMethod, type AgentProvider } from "../agentSseClient";
import { DsButton } from "../components/ds/Button";
import { DsIconButton } from "../components/ds/IconButton";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import { DisconnectConfirm } from "./DisconnectConfirm";
import "./ConnectMethodModal.css";
import "./PersonalKeyModal.css";

/** Where to create a key, per provider — official consoles only. */
const KEY_SOURCES: Record<string, { label: string; url: string }> = {
  openai: { label: "platform.openai.com/api-keys", url: "https://platform.openai.com/api-keys" },
  claude: { label: "console.anthropic.com", url: "https://console.anthropic.com/settings/keys" },
  gemini: { label: "aistudio.google.com/apikey", url: "https://aistudio.google.com/apikey" },
  cursor: { label: "cursor.com/dashboard", url: "https://cursor.com/dashboard" },
};

export function PersonalKeyModal({
  provider,
  method,
  onProvidersUpdated,
  onClose,
  onRequestReturnFocus,
}: {
  provider: AgentProvider;
  method: AgentAuthMethod;
  /** Receives the fresh provider list after a successful connect/disconnect. */
  onProvidersUpdated: (providers: AgentProvider[]) => void;
  onClose: () => void;
  onRequestReturnFocus?: () => void;
}) {
  const isConnected = method.ok && Boolean(method.maskedHint);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = `personal-key-modal-${provider.id}`;

  const close = () => {
    onClose();
    onRequestReturnFocus?.();
  };

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setErrorMessage("Paste your API key first.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const providers = await connectPersonalKey(provider.id, trimmed);
      onProvidersUpdated(providers);
      setKeyInput("");
      setSuccessMessage("Connected — your key checked out and is stored securely on this computer.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const providers = await disconnectPersonalKey(provider.id);
      onProvidersUpdated(providers);
      setConfirmingDisconnect(false);
      setSuccessMessage("Disconnected. Your key was removed from this computer.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const keySource = KEY_SOURCES[provider.id];

  return (
    <div className="connectModal__root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="connectModal__backdrop" aria-label="Close" onClick={close} />
      <div className="connectModal">
        <header className="connectModal__header">
          <div className="connectModal__headerIcon" aria-hidden>
            <KeyRound size={18} />
          </div>
          <DsTypography as="h2" id={titleId} variant="heading-5" className="connectModal__title">
            {isConnected ? `Your ${provider.label} key` : `Connect your ${provider.label} key`}
          </DsTypography>
          <DsIconButton
            variant="ghost"
            size="small"
            aria-label="Close dialog"
            className="connectModal__closeButton"
            onClick={close}
          >
            <X size={16} aria-hidden />
          </DsIconButton>
        </header>

        {errorMessage ? (
          <div className="connectModal__errorBanner" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <div>
              <DsTypography as="p" variant="paragraph-small">
                {errorMessage}
              </DsTypography>
            </div>
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

        {isConnected ? (
          <div className="connectModal__body">
            <div className="personalKeyModal__connectedRow">
              <DsTypography as="p" variant="paragraph-regular">
                Key ending <code className="personalKeyModal__mask">{method.maskedHint}</code> is connected and
                working.
              </DsTypography>
              {method.savedAt ? (
                <DsTypography as="p" variant="paragraph-mini-regular" className="connectModal__footnote">
                  Added {new Date(method.savedAt).toLocaleDateString()}
                </DsTypography>
              ) : null}
            </div>
            <DsTypography as="p" variant="paragraph-small" className="connectModal__footnote">
              For security, the full key can't be viewed again. You can replace it with a new one, or remove it
              from this computer entirely.
            </DsTypography>
            <label className="personalKeyModal__field">
              <DsTypography as="span" variant="paragraph-small">
                Replace with a new key
              </DsTypography>
              <input
                ref={inputRef}
                type="password"
                className="personalKeyModal__input"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste a new API key"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
        ) : (
          <div className="connectModal__body">
            <DsTypography as="p" variant="paragraph-regular">
              Your key is checked with {provider.label} first, then stored securely on this computer. It's used
              only for your own runs and billed to your own account — and it can never be viewed again after
              saving.
            </DsTypography>
            <label className="personalKeyModal__field">
              <DsTypography as="span" variant="paragraph-small">
                API key
              </DsTypography>
              <input
                ref={inputRef}
                type="password"
                className="personalKeyModal__input"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste your API key"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {keySource ? (
              <DsTypography as="p" variant="paragraph-mini-regular" className="connectModal__footnote">
                Don't have one yet? Create a key at{" "}
                <a href={keySource.url} target="_blank" rel="noreferrer" className="personalKeyModal__link">
                  {keySource.label}
                </a>
                .
              </DsTypography>
            ) : null}
          </div>
        )}

        <footer className="connectModal__actions">
          {isConnected ? (
            confirmingDisconnect ? (
              <DisconnectConfirm
                providerLabel={provider.label}
                busy={busy}
                busyLabel="Removing…"
                onCancel={() => setConfirmingDisconnect(false)}
                onConfirm={() => void handleDisconnect()}
              />
            ) : (
              <>
                <DsButton
                  variant="destructive"
                  size="small"
                  onClick={() => setConfirmingDisconnect(true)}
                  disabled={busy}
                >
                  Disconnect
                </DsButton>
                <div className="connectModal__actionsSpacer" />
                <DsButton variant="ghost" size="small" onClick={close}>
                  Close
                </DsButton>
                <DsButton
                  variant="primary"
                  size="small"
                  onClick={() => void handleConnect()}
                  disabled={busy || !keyInput.trim()}
                  leftIcon={busy ? <DsSpinner size={14} aria-hidden /> : undefined}
                >
                  {busy ? "Checking…" : "Replace key"}
                </DsButton>
              </>
            )
          ) : (
            <>
              <DsButton variant="ghost" size="small" onClick={close}>
                Cancel
              </DsButton>
              <DsButton
                variant="primary"
                size="small"
                onClick={() => void handleConnect()}
                disabled={busy || !keyInput.trim()}
                leftIcon={busy ? <DsSpinner size={14} aria-hidden /> : undefined}
              >
                {busy ? "Checking key…" : "Connect"}
              </DsButton>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
