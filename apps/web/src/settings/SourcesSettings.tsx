import { AlertTriangle, Check, ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { SOURCE_GROUPS, UPLOAD_SOURCE_ID, type KnowledgeSource } from "../knowledge/sources";
import { CONNECTED_SOURCES, SOURCE_ATTENTION, type SourceAttention } from "../knowledgeV2/data";
import { fetchJpdConnection, type JpdConnection } from "../knowledgeV2/productDiscovery";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { SOURCE_DESCRIPTIONS } from "./sourceDescriptions";
import "./SourcesSettings.css";

type Filter = "all" | "attention" | "connected" | "available";

type SourceState = {
  status: "connected" | "attention" | "available";
  /** "Connecting…", "Re-indexing…" while a demo action runs. */
  busy?: string;
  items?: string;
  synced?: string;
  attention?: SourceAttention;
};

/** Every source a client can connect, with its category — "Upload files" isn't a connection. */
const CATALOG = SOURCE_GROUPS.flatMap((group) =>
  group.sources.filter((s) => s.id !== UPLOAD_SOURCE_ID).map((source) => ({ source, category: group.label })),
);

function initialStates(): Record<string, SourceState> {
  const states: Record<string, SourceState> = {};
  for (const { source } of CATALOG) states[source.id] = { status: "available" };
  for (const c of CONNECTED_SOURCES) states[c.id] = { status: "connected", items: c.items, synced: c.synced };
  for (const a of SOURCE_ATTENTION) states[a.id] = { ...states[a.id], status: "attention", attention: a };
  return states;
}

/** How long the demo pretends connecting or re-indexing takes. */
const DEMO_DELAY_MS = 1200;

/**
 * Settings › Sources: every tool the knowledge base can learn from. Ones that
 * need someone to act come first, with the steps to fix them; then the
 * connected ones (re-index, disconnect); then everything else as tiles,
 * each saying what it brings, to connect. With 40+ tools, a search box and status filters keep it usable.
 *
 * Connections are simulated (fixture data, local state) — except Jira's
 * Product Discovery link, which reflects the agent server's real settings.
 */
export function SourcesSettings() {
  const [states, setStates] = useState(initialStates);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [jpd, setJpd] = useState<JpdConnection | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchJpdConnection().then((result) => {
      if (!cancelled) setJpd(result);
    });
    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const update = (id: string, next: Partial<SourceState>) => setStates((current) => ({ ...current, [id]: { ...current[id]!, ...next } }));

  /** Runs a demo action: shows `busy` on the row, then applies `done`. */
  const simulate = (id: string, busy: string, done: Partial<SourceState>) => {
    update(id, { busy });
    timers.current.push(window.setTimeout(() => update(id, { ...done, busy: undefined }), DEMO_DELAY_MS));
  };

  const connect = (id: string) =>
    simulate(id, "Connecting…", { status: "connected", attention: undefined, items: states[id]?.items ?? "Indexing…", synced: "Just now" });
  const reindex = (id: string) => simulate(id, "Re-indexing…", { synced: "Just now" });
  const disconnect = (id: string) => {
    setConfirming(null);
    update(id, { status: "available", attention: undefined, items: undefined, synced: undefined });
  };

  const counts = useMemo(() => {
    const all = Object.values(states);
    return {
      all: all.length,
      attention: all.filter((s) => s.status === "attention").length,
      connected: all.filter((s) => s.status === "connected").length,
      available: all.filter((s) => s.status === "available").length,
    };
  }, [states]);

  const needle = query.trim().toLowerCase();
  const matches = CATALOG.filter(
    ({ source, category }) => !needle || source.label.toLowerCase().includes(needle) || category.toLowerCase().includes(needle),
  );
  const inStatus = (status: SourceState["status"]) =>
    (filter === "all" || filter === status) ? matches.filter(({ source }) => states[source.id]?.status === status) : [];
  const attention = inStatus("attention");
  const connected = inStatus("connected");
  const available = inStatus("available");
  const shown = attention.length + connected.length + available.length;

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "attention", label: "Needs attention" },
    { id: "connected", label: "Connected" },
    { id: "available", label: "Not connected" },
  ];

  return (
    <section className="sourcesSettings" aria-label="Sources">
      <SettingsSectionHeader
        description="Connect the tools your product knowledge base learns from."
        lastCheckedLabel={`Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        onRefresh={() => {
          setCheckedAt(Date.now());
          void fetchJpdConnection().then(setJpd);
        }}
        refreshing={false}
      />

      <div className="sourcesSettings__toolbar">
        <div className="sourcesSettings__filters" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="sourcesSettings__filter"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="sourcesSettings__count" data-tone={f.id === "attention" && counts.attention ? "warn" : undefined}>
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>
        <label className="sourcesSettings__search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder={`Search ${counts.all} sources…`}
            aria-label="Search sources"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" className="sourcesSettings__clear" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      <p className="sourcesSettings__srOnly" role="status">
        {needle ? `${shown} source${shown === 1 ? "" : "s"} match “${query.trim()}”` : ""}
      </p>

      {shown === 0 ? (
        <div className="sourcesSettings__empty">
          <DsTypography as="p" variant="paragraph-small-bold">
            {needle ? `No sources match “${query.trim()}”` : "Nothing here"}
          </DsTypography>
          <DsTypography as="p" variant="paragraph-mini-regular" className="sourcesSettings__muted">
            {needle ? "Try another name, or a kind of tool like “analytics” or “design”." : "Try another filter."}
          </DsTypography>
        </div>
      ) : null}

      {attention.length ? (
        <SourceSection title="Needs attention" count={attention.length}>
          {attention.map(({ source, category }) => {
            const state = states[source.id]!;
            return (
              <div key={source.id} className="sourcesSettings__row sourcesSettings__row--attention">
                <div className="sourcesSettings__rowMain">
                  <SourceLogo source={source} />
                  <RowCopy title={source.label} category={category} detail={state.attention?.reason} tone="warn" />
                  <AlertTriangle size={16} className="sourcesSettings__warnIcon" aria-label="Needs attention" />
                  <RowActions
                    id={source.id}
                    label={source.label}
                    busy={state.busy}
                    confirming={confirming === source.id}
                    onConfirm={setConfirming}
                    onDisconnect={disconnect}
                  />
                </div>
                {state.attention ? (
                  <div className="sourcesSettings__fix">
                    <ol className="sourcesSettings__steps">
                      {state.attention.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <DsButton variant="secondary" size="small" disabled={!!state.busy} onClick={() => connect(source.id)}>
                      {state.busy ?? state.attention.action}
                    </DsButton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </SourceSection>
      ) : null}

      {connected.length ? (
        <SourceSection title="Connected" count={connected.length}>
          {connected.map(({ source, category }) => {
            const state = states[source.id]!;
            const jpdLine =
              source.id === "jira" && jpd?.configured
                ? `Sends ideas to Product Discovery · ${jpd.projectName ?? jpd.projectKey} (${jpd.projectKey})`
                : null;
            return (
              <div key={source.id} className="sourcesSettings__row">
                <div className="sourcesSettings__rowMain">
                  <SourceLogo source={source} />
                  <RowCopy
                    title={source.label}
                    category={category}
                    detail={state.busy ?? `${state.items ?? "Indexed"} · synced ${state.synced?.toLowerCase() ?? "just now"}`}
                    extra={
                      jpdLine && jpd?.site ? (
                        <a className="sourcesSettings__link" href={`https://${jpd.site}`} target="_blank" rel="noreferrer">
                          {jpdLine}
                          <ExternalLink size={11} aria-hidden />
                        </a>
                      ) : null
                    }
                  />
                  <Check size={16} className="sourcesSettings__okIcon" aria-label="Connected" />
                  <RowActions
                    id={source.id}
                    label={source.label}
                    busy={state.busy}
                    confirming={confirming === source.id}
                    onConfirm={setConfirming}
                    onDisconnect={disconnect}
                    onReindex={reindex}
                  />
                </div>
              </div>
            );
          })}
        </SourceSection>
      ) : null}

      {available.length ? (
        <SourceSection title="Available to connect" count={available.length} layout="grid">
          {available.map(({ source }) => {
            const state = states[source.id]!;
            return (
              <div key={source.id} className="sourcesSettings__tile">
                <div className="sourcesSettings__tileHead">
                  <SourceLogo source={source} />
                  <DsTypography as="p" variant="paragraph-small-bold">
                    {source.label}
                  </DsTypography>
                </div>
                {SOURCE_DESCRIPTIONS[source.label] ? (
                  <DsTypography as="p" variant="paragraph-mini-regular" className="sourcesSettings__tileText">
                    {SOURCE_DESCRIPTIONS[source.label]}
                  </DsTypography>
                ) : null}
                <DsButton
                  variant="secondary"
                  size="mini"
                  className="sourcesSettings__tileAction"
                  disabled={!!state.busy}
                  onClick={() => connect(source.id)}
                  aria-label={state.busy ? undefined : `Connect ${source.label}`}
                >
                  {state.busy ?? "Connect"}
                </DsButton>
              </div>
            );
          })}
        </SourceSection>
      ) : null}

      <p className="sourcesSettings__note">
        Demo: connecting, re-indexing and disconnecting are simulated here. Jira Product Discovery is the exception — it
        uses the agent server's settings (see the README).
      </p>
    </section>
  );
}

/** A titled group of sources: a bordered list of rows, or a grid of tiles. */
function SourceSection({
  title,
  count,
  layout = "list",
  children,
}: {
  title: string;
  count: number;
  layout?: "list" | "grid";
  children: ReactNode;
}) {
  return (
    <section className="sourcesSettings__section" aria-label={title}>
      <h2 className="sourcesSettings__sectionTitle">
        {title} <span className="sourcesSettings__muted">{count}</span>
      </h2>
      <div className={layout === "grid" ? "sourcesSettings__grid" : "sourcesSettings__list"}>{children}</div>
    </section>
  );
}

function SourceLogo({ source, muted }: { source: KnowledgeSource; muted?: boolean }) {
  return (
    <span className="sourcesSettings__logo" data-muted={muted || undefined}>
      <SourceMark source={source} size={16} />
    </span>
  );
}

function RowCopy({
  title,
  category,
  detail,
  tone,
  extra,
}: {
  title: string;
  category?: string;
  detail?: string;
  tone?: "warn";
  extra?: ReactNode;
}) {
  return (
    <div className="sourcesSettings__copy">
      <DsTypography as="p" variant="paragraph-small-bold">
        {title}
        {category ? <span className="sourcesSettings__categoryTag">{category}</span> : null}
      </DsTypography>
      {detail ? (
        <DsTypography
          as="p"
          variant="paragraph-mini-regular"
          className={tone === "warn" ? "sourcesSettings__detail sourcesSettings__detail--warn" : "sourcesSettings__detail"}
        >
          {detail}
        </DsTypography>
      ) : null}
      {extra}
    </div>
  );
}

/** Re-index and Disconnect — Disconnect asks once before it acts. */
function RowActions({
  id,
  label,
  busy,
  confirming,
  onConfirm,
  onDisconnect,
  onReindex,
}: {
  id: string;
  label: string;
  busy?: string;
  confirming: boolean;
  onConfirm: (id: string | null) => void;
  onDisconnect: (id: string) => void;
  onReindex?: (id: string) => void;
}) {
  if (confirming) {
    return (
      <div className="sourcesSettings__actions" role="group" aria-label={`Disconnect ${label}?`}>
        <span className="sourcesSettings__confirm">Disconnect {label}?</span>
        <DsButton variant="ghost" size="mini" onClick={() => onConfirm(null)}>
          Cancel
        </DsButton>
        <DsButton variant="destructive" size="mini" onClick={() => onDisconnect(id)}>
          Disconnect
        </DsButton>
      </div>
    );
  }
  return (
    <div className="sourcesSettings__actions">
      {onReindex ? (
        <DsButton variant="ghost" size="mini" disabled={!!busy} onClick={() => onReindex(id)}>
          Re-index
        </DsButton>
      ) : null}
      <DsButton variant="ghost" size="mini" disabled={!!busy} onClick={() => onConfirm(id)}>
        Disconnect
      </DsButton>
    </div>
  );
}
