import { AlertTriangle, CheckCircle2, Circle, CircleDot, Search as SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatJiraTicketContext,
  getJiraTicket,
  searchJiraTickets,
  type JiraTicketDetail,
  type JiraTicketSummary,
} from "../../integrations/jiraClient";
import { DsButton } from "../ds/Button";
import { DsSpinner } from "../ds/Spinner";
import "./JiraTicketPicker.css";

type Tab = "search" | "recent" | "assigned-to-me";

const TABS: { id: Tab; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "recent", label: "Recent" },
  { id: "assigned-to-me", label: "Assigned to me" },
];

function StatusIcon({ category }: { category: JiraTicketSummary["statusCategory"] }) {
  if (category === "done") return <CheckCircle2 size={14} className="jiraPicker__statusIcon--done" aria-hidden />;
  if (category === "in-progress")
    return <CircleDot size={14} className="jiraPicker__statusIcon--progress" aria-hidden />;
  return <Circle size={14} className="jiraPicker__statusIcon--todo" aria-hidden />;
}

export function JiraTicketPicker({
  onSelect,
  onSwitchToManual,
}: {
  onSelect: (ticket: JiraTicketDetail, formattedContext: string) => void;
  onSwitchToManual: () => void;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JiraTicketSummary[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [preview, setPreview] = useState<JiraTicketDetail | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const run = async (mode: Tab, q?: string) => {
      setLoadingResults(true);
      setListError(null);
      try {
        const tickets = await searchJiraTickets(mode, q, { signal: controller.signal });
        setResults(tickets);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setListError(err instanceof Error ? err.message : "Couldn't load tickets.");
      } finally {
        setLoadingResults(false);
      }
    };

    if (tab === "search") {
      if (query.trim().length < 2) {
        setResults([]);
        setLoadingResults(false);
        return () => controller.abort();
      }
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void run("search", query.trim()), 300);
    } else {
      void run(tab);
    }

    return () => {
      controller.abort();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [tab, query]);

  const openPreview = async (key: string) => {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const detail = await getJiraTicket(key);
      setPreview(detail);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Couldn't load this ticket.");
    } finally {
      setLoadingPreview(false);
    }
  };

  if (preview) {
    return (
      <div className="jiraPicker__preview">
        <div className="jiraPicker__previewHeader">
          <span className="jiraPicker__previewKey">{preview.key}</span>
          <span className="jiraPicker__previewMeta">
            {preview.type} · {preview.status}
            {preview.priority ? ` · ${preview.priority}` : ""}
          </span>
        </div>
        <p className="jiraPicker__previewTitle">{preview.title}</p>
        {preview.assignee ? <p className="jiraPicker__previewLine">Assignee: {preview.assignee}</p> : null}
        {preview.sprint ? <p className="jiraPicker__previewLine">Sprint: {preview.sprint}</p> : null}
        {preview.epic ? <p className="jiraPicker__previewLine">Epic: {preview.epic}</p> : null}
        {!preview.descriptionIsEmpty ? (
          <p className="jiraPicker__previewDescription">{preview.description.slice(0, 320)}</p>
        ) : (
          <p className="jiraPicker__previewDescriptionEmpty">No description on this ticket.</p>
        )}
        <div className="jiraPicker__previewActions">
          <DsButton variant="ghost" size="small" type="button" onClick={() => setPreview(null)}>
            Back to results
          </DsButton>
          <DsButton
            variant="primary"
            size="small"
            type="button"
            onClick={() => onSelect(preview, formatJiraTicketContext(preview))}
          >
            Use this ticket
          </DsButton>
        </div>
      </div>
    );
  }

  return (
    <div className="jiraPicker">
      <div className="jiraPicker__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "jiraPicker__tab jiraPicker__tab--active" : "jiraPicker__tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <label className="jiraPicker__searchField">
          <SearchIcon size={14} aria-hidden />
          <input
            className="jiraPicker__searchInput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets by title…"
            autoFocus
          />
        </label>
      ) : null}

      <div className="jiraPicker__results">
        {loadingPreview ? (
          <div className="jiraPicker__state">
            <DsSpinner size={16} aria-hidden />
            <span>Loading ticket…</span>
          </div>
        ) : previewError ? (
          <div className="jiraPicker__state jiraPicker__state--error">
            <AlertTriangle size={14} aria-hidden />
            <span>{previewError}</span>
          </div>
        ) : loadingResults ? (
          <div className="jiraPicker__state">
            <DsSpinner size={16} aria-hidden />
            <span>Loading tickets…</span>
          </div>
        ) : listError ? (
          <div className="jiraPicker__state jiraPicker__state--error">
            <AlertTriangle size={14} aria-hidden />
            <span>{listError}</span>
          </div>
        ) : tab === "search" && query.trim().length < 2 ? (
          <div className="jiraPicker__state">Type at least 2 characters to search.</div>
        ) : results.length === 0 ? (
          <div className="jiraPicker__state">
            {tab === "assigned-to-me" ? "Nothing assigned to you right now." : "No tickets found."}
          </div>
        ) : (
          results.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              className="jiraPicker__resultRow"
              onClick={() => void openPreview(ticket.key)}
            >
              <StatusIcon category={ticket.statusCategory} />
              <span className="jiraPicker__resultKey">{ticket.key}</span>
              <span className="jiraPicker__resultTitle">{ticket.title}</span>
            </button>
          ))
        )}
      </div>

      <button type="button" className="jiraPicker__manualLink" onClick={onSwitchToManual}>
        Enter a ticket key manually instead
      </button>
    </div>
  );
}
