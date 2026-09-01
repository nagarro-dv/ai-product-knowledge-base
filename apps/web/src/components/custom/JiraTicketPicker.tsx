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
  if (category === "done") return <CheckCircle2 size={16} className="jiraPicker__statusIcon--done" aria-hidden />;
  if (category === "in-progress")
    return <CircleDot size={16} className="jiraPicker__statusIcon--progress" aria-hidden />;
  return <Circle size={16} className="jiraPicker__statusIcon--todo" aria-hidden />;
}

export function JiraTicketPicker({
  onSelect,
  onPreviewChange,
  showOwnFooter = false,
}: {
  /** Only consulted when `showOwnFooter` is true. */
  onSelect?: (ticket: JiraTicketDetail, formattedContext: string) => void;
  /** Fires whenever the previewed ticket changes (including back-to-results → null), so a
   * parent-owned footer (SourceModal's) can drive confirmation instead of this component
   * owning its own. Switching to manual entry is also the parent's call now (one
   * consistently-placed link owns that, instead of this component rendering its own) —
   * so there's no `onSwitchToManual` prop here anymore. */
  onPreviewChange?: (ticket: JiraTicketDetail | null, formattedContext: string) => void;
  /** Renders this component's own "Back to results"/"Use this ticket" footer. Off by
   * default — both real callers now use a shared, always-visible modal footer instead. */
  showOwnFooter?: boolean;
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
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus lands somewhere real on open regardless of the default tab — the old
  // `autoFocus` on the search input only worked when "Search" happened to be selected.
  useEffect(() => {
    activeTabRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The search field stays mounted (see .jiraPicker__searchField--inactive) so switching
  // tabs never changes the modal's height — but it should still take focus when the user
  // actually switches to it, the way a freshly-mounted field would.
  useEffect(() => {
    if (tab === "search" && !preview) searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
      onPreviewChange?.(detail, formatJiraTicketContext(detail));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Couldn't load this ticket.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreview(null);
    setPreviewError(null);
    onPreviewChange?.(null, "");
  };

  return (
    <div className="jiraPicker">
      {/* Browse-mode chrome (which list you're looking at) is only relevant while
          browsing — replaced as one unit by a single "back" affordance once a specific
          ticket is open, so the layout visibly reflects having moved from "browsing" to
          "reviewing one ticket" (and "Back to results" lives with the other navigation,
          not inside the content box it's meant to take you out of). Both rows below keep
          a reserved height regardless of which state is showing, so switching tabs or
          opening/closing a preview doesn't change the modal's overall height. */}
      {!preview ? (
        <div className="jiraPicker__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={tab === t.id ? activeTabRef : undefined}
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
      ) : (
        <button type="button" className="jiraPicker__previewBack" onClick={closePreview}>
          Back to results
        </button>
      )}

      <label
        className={`jiraPicker__searchField${tab === "search" && !preview ? "" : " jiraPicker__searchField--inactive"}`}
      >
        <SearchIcon size={14} aria-hidden />
        <input
          ref={searchInputRef}
          className="jiraPicker__searchInput"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tickets by title…"
          tabIndex={tab === "search" && !preview ? 0 : -1}
          aria-hidden={!(tab === "search" && !preview)}
        />
      </label>

      <div className="jiraPicker__results">
        {preview ? (
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
            {showOwnFooter ? (
              <div className="jiraPicker__previewActions">
                <DsButton variant="ghost" size="small" type="button" onClick={closePreview}>
                  Back to results
                </DsButton>
                <DsButton
                  variant="primary"
                  size="small"
                  type="button"
                  onClick={() => onSelect?.(preview, formatJiraTicketContext(preview))}
                >
                  Use this ticket
                </DsButton>
              </div>
            ) : null}
          </div>
        ) : loadingPreview ? (
          <div className="jiraPicker__state" aria-live="polite">
            <DsSpinner size={16} aria-hidden />
            <span>Loading ticket…</span>
          </div>
        ) : previewError ? (
          <div className="jiraPicker__state jiraPicker__state--error" aria-live="polite">
            <AlertTriangle size={14} aria-hidden />
            <span>{previewError}</span>
          </div>
        ) : loadingResults ? (
          <div className="jiraPicker__state" aria-live="polite">
            <DsSpinner size={16} aria-hidden />
            <span>Loading tickets…</span>
          </div>
        ) : listError ? (
          <div className="jiraPicker__state jiraPicker__state--error" aria-live="polite">
            <AlertTriangle size={14} aria-hidden />
            <span>{listError}</span>
          </div>
        ) : tab === "search" && query.trim().length < 2 ? (
          <div className="jiraPicker__state" aria-live="polite">
            Type at least 2 characters to search.
          </div>
        ) : results.length === 0 ? (
          <div className="jiraPicker__state" aria-live="polite">
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
    </div>
  );
}
