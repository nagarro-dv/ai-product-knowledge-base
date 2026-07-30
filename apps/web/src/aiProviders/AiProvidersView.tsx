import { AlertTriangle, Bot, Check, ChevronDown, CircleDashed } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAgentProviders,
  refreshAgentProviders,
  type AgentAuthMethod,
  type AgentProvider,
} from "../agentSseClient";
import { AssistantServiceRecovery } from "../AssistantServiceRecovery";
import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import { ConnectMethodModal } from "./ConnectMethodModal";
import { PersonalKeyModal } from "./PersonalKeyModal";
import {
  getPreferredAuthMethod,
  resolveActiveAuthMethod,
  setPreferredAuthMethod,
  subscribeAuthPreferences,
} from "./authPreferences";
import { PROVIDER_ICONS, providerRowStatus, type ProviderRowStatus } from "./providerMeta";
import { SettingsSectionHeader } from "../settings/SettingsSectionHeader";
import { formatCheckedAt } from "../settings/relativeTime";
import "./AiProvidersView.css";

type RowStatus = ProviderRowStatus;

const rowStatusOf = providerRowStatus;

function methodStatusIcon(method: AgentAuthMethod) {
  if (method.ok) return <Check size={13} strokeWidth={2.5} className="aiModels__methodIcon--ok" aria-hidden />;
  if (method.status === "unavailable")
    return <AlertTriangle size={13} className="aiModels__methodIcon--warn" aria-hidden />;
  return <CircleDashed size={13} className="aiModels__methodIcon--muted" aria-hidden />;
}

function MethodRow({
  provider,
  method,
  isActive,
  canSelect,
  onSelect,
  onOpenModal,
  retryBusy,
  onRetry,
  rowRef,
}: {
  provider: AgentProvider;
  method: AgentAuthMethod;
  isActive: boolean;
  canSelect: boolean;
  onSelect: () => void;
  onOpenModal: () => void;
  retryBusy: boolean;
  onRetry: () => void;
  rowRef: (el: HTMLButtonElement | null) => void;
}) {
  const isPersonalKey = method.id === "personal-api-key";
  const connectLabel = isPersonalKey || method.kind === "local-runtime" ? "Connect" : "Set up";

  return (
    <div className="aiModels__methodRow">
      {methodStatusIcon(method)}
      <div className="aiModels__methodCopy">
        <DsTypography as="p" variant="paragraph-small-bold">
          {method.label}
        </DsTypography>
        <DsTypography as="p" variant="paragraph-mini-regular" className="aiModels__methodDescription">
          {method.description}
          {method.ok && isPersonalKey && method.maskedHint ? ` · Key ${method.maskedHint}` : ""}
          {method.ok && method.model ? ` · ${method.model}` : ""}
          {!method.ok && method.status === "unavailable" ? " · Needs attention" : ""}
        </DsTypography>
      </div>
      <div className="aiModels__methodAction">
        {method.status === "not-configured" ? (
          <DsButton ref={rowRef} variant="ghost" size="mini" onClick={onOpenModal}>
            {connectLabel}
          </DsButton>
        ) : method.status === "unavailable" ? (
          <>
            <DsButton variant="ghost" size="mini" onClick={onRetry} disabled={retryBusy}>
              {retryBusy ? "…" : "Retry"}
            </DsButton>
            <DsButton ref={rowRef} variant="ghost" size="mini" onClick={onOpenModal}>
              Details
            </DsButton>
          </>
        ) : isActive ? (
          <>
            <DsTypography as="span" variant="paragraph-mini-regular" className="aiModels__activeLabel">
              Active
            </DsTypography>
            {method.source === "personal" ? (
              <DsButton
                ref={rowRef}
                variant="ghost"
                size="mini"
                onClick={onOpenModal}
                aria-label={`Manage ${method.label}`}
              >
                Manage
              </DsButton>
            ) : null}
          </>
        ) : canSelect ? (
          <DsButton
            variant="ghost"
            size="mini"
            onClick={onSelect}
            aria-label={`Use ${method.label} for ${provider.label}`}
          >
            Use this
          </DsButton>
        ) : method.source === "personal" && method.ok ? (
          <DsButton ref={rowRef} variant="ghost" size="mini" onClick={onOpenModal}>
            Manage
          </DsButton>
        ) : null}
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  expanded,
  onToggle,
  onOpenModal,
  refreshing,
  onRetry,
  rowTriggerRefs,
}: {
  provider: AgentProvider;
  expanded: boolean;
  onToggle: () => void;
  onOpenModal: (methodId: string) => void;
  refreshing: boolean;
  onRetry: () => void;
  rowTriggerRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
}) {
  const Icon = PROVIDER_ICONS[provider.id] ?? Bot;
  const methods = provider.authMethods ?? [];
  const status = rowStatusOf(provider);
  const active = resolveActiveAuthMethod(provider);
  const connectedCount = methods.filter((m) => m.ok).length;
  const preferred = getPreferredAuthMethod(provider.id);
  const statusLabel =
    status === "connected"
      ? `Connected via ${active?.label ?? "an active method"}`
      : status === "attention"
        ? "Needs attention"
        : "Not connected";

  return (
    <div className={`aiModels__row${expanded ? " aiModels__row--expanded" : ""}`}>
      <button
        type="button"
        className="aiModels__rowHeader"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`aiModels-methods-${provider.id}`}
      >
        <span className={`aiModels__avatar aiModels__avatar--${status}`} aria-hidden>
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="aiModels__rowTitle">
          <DsTypography as="span" variant="paragraph-small-bold">
            {provider.label}
          </DsTypography>
        </span>
        <span className={`aiModels__rowStatus aiModels__rowStatus--${status}`}>{statusLabel}</span>
        <ChevronDown size={16} className={expanded ? "aiModels__chevron aiModels__chevron--open" : "aiModels__chevron"} aria-hidden />
      </button>

      {expanded ? (
        <div id={`aiModels-methods-${provider.id}`} className="aiModels__methods">
          {connectedCount > 1 ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="aiModels__multiHint">
              Several sign-in methods are connected — pick which one powers your runs.
            </DsTypography>
          ) : null}
          {methods.map((method) => (
            <MethodRow
              key={method.id}
              provider={provider}
              method={method}
              isActive={active?.id === method.id}
              canSelect={connectedCount > 1 && method.ok}
              onSelect={() => setPreferredAuthMethod(provider.id, method.id)}
              onOpenModal={() => onOpenModal(method.id)}
              retryBusy={refreshing}
              onRetry={onRetry}
              rowRef={(el) => rowTriggerRefs.current.set(`${provider.id}:${method.id}`, el)}
            />
          ))}
          {preferred && !methods.some((m) => m.id === preferred && m.ok) ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="aiModels__warningNote">
              Your saved choice isn't available right now — the default connected method is used instead.
            </DsTypography>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AiProvidersView() {
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [, setPreferenceVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<{ providerId: string; methodId: string } | null>(null);
  const rowTriggerRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAgentProviders({ signal });
      setProviders(list);
      setLastCheckedAt(Date.now());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        "We couldn't reach the assistant service, so model status is unknown.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await refreshAgentProviders();
      setProviders(list);
      setLastCheckedAt(Date.now());
    } catch {
      setError("We couldn't refresh model status. Make sure the assistant service is running.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => subscribeAuthPreferences(() => setPreferenceVersion((v) => v + 1)), []);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((v) => v + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const modalTarget = useMemo(() => {
    if (!activeModal) return null;
    const provider = providers.find((p) => p.id === activeModal.providerId);
    const method = provider?.authMethods?.find((m) => m.id === activeModal.methodId);
    if (!provider || !method) return null;
    return { provider, method };
  }, [activeModal, providers]);

  return (
    <section className="aiModels" aria-label="AI Models">
      <SettingsSectionHeader
        description="Choose which AI powers your work."
        lastCheckedLabel={lastCheckedAt && !loading ? formatCheckedAt(lastCheckedAt) : null}
        onRefresh={() => void refresh()}
        refreshing={loading || refreshing}
      />

      {loading ? (
        <div className="aiModels__loading" role="status">
          <span>Checking model status…</span>
        </div>
      ) : error ? (
        <AssistantServiceRecovery onRecovered={() => load()} />
      ) : (
        <div className="aiModels__list">
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              expanded={expandedId === provider.id}
              onToggle={() => setExpandedId((cur) => (cur === provider.id ? null : provider.id))}
              onOpenModal={(methodId) => setActiveModal({ providerId: provider.id, methodId })}
              refreshing={refreshing}
              onRetry={() => void refresh()}
              rowTriggerRefs={rowTriggerRefs}
            />
          ))}
        </div>
      )}

      {modalTarget ? (
        modalTarget.method.id === "personal-api-key" ? (
          <PersonalKeyModal
            provider={modalTarget.provider}
            method={modalTarget.method}
            onProvidersUpdated={(list) => {
              setProviders(list);
              setLastCheckedAt(Date.now());
            }}
            onClose={() => setActiveModal(null)}
            onRequestReturnFocus={() =>
              rowTriggerRefs.current.get(`${modalTarget.provider.id}:${modalTarget.method.id}`)?.focus()
            }
          />
        ) : (
          <ConnectMethodModal
            provider={modalTarget.provider}
            method={modalTarget.method}
            onProvidersUpdated={(list) => {
              setProviders(list);
              setLastCheckedAt(Date.now());
            }}
            onClose={() => setActiveModal(null)}
            onRequestReturnFocus={() =>
              rowTriggerRefs.current.get(`${modalTarget.provider.id}:${modalTarget.method.id}`)?.focus()
            }
          />
        )
      ) : null}
    </section>
  );
}
