import { Check, Copy, Download, Ellipsis, ExternalLink, FileText, Link2, Mail, Printer, Share, X, type LucideIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { computeAnchoredPosition, type PopoverPosition } from "../accelerator/popoverPosition";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { sourceById } from "../knowledge/sources";
import { jpdFieldsFor, type JpdFieldValue } from "./jpdFields";
import { createJpdIdea, fetchJpdConnection, type JpdConnection, type JpdIdea } from "./productDiscovery";
import { riceFor } from "./rice";
import { ImpactBadge } from "./RiceScore";
import { slugify, toMarkdown, type Shareable } from "./sharing";
import { Tip } from "./Tip";
import "./ShareMenu.css";

/*
 * Sharing out of the knowledge base. A Share menu sends to Slack, Microsoft
 * Teams or Jira Product Discovery through a compose dialog; a ⋯ menu holds
 * the rest (copy, download, print/PDF, email, Confluence, Notion). Sending
 * to Product Discovery creates a real idea when the agent server has a Jira
 * API token (productDiscovery.ts); everything else is a demo, but the dialog
 * and the summary it carries are the real thing, and downloads, copying and
 * email do work.
 */

type Destination = "slack" | "teams" | "jpd";

const DESTINATIONS: Record<Destination, { label: string; source: string; targets: string[]; targetLabel: string; send: string }> = {
  slack: {
    label: "Slack",
    source: "slack",
    targets: ["#product-team", "#growth-squad", "#billing-squad", "#leadership"],
    targetLabel: "Channel",
    send: "Send to Slack",
  },
  teams: {
    label: "Microsoft Teams",
    source: "microsoft-teams",
    targets: ["Product › General", "Growth › Planning", "Leadership › Weekly"],
    targetLabel: "Team and channel",
    send: "Send to Teams",
  },
  jpd: {
    label: "Jira Product Discovery",
    source: "jira",
    targets: ["Growth discovery (GROW)", "Platform discovery (PLAT)"],
    targetLabel: "Project",
    send: "Create idea",
  },
};

/** An optional link on a toast, e.g. to open what was just created. */
type ToastAction = { label: string; href: string };
type Toast = { id: number; message: string; action?: ToastAction };

type ShareContextValue = {
  openDialog: (item: Shareable, destination: Destination) => void;
  notify: (message: string, action?: ToastAction) => void;
};

const ShareContext = createContext<ShareContextValue | null>(null);

export function useShare(): ShareContextValue {
  const value = useContext(ShareContext);
  if (!value) throw new Error("Share actions need a <ShareProvider>.");
  return value;
}

let nextKey = 142;
/** Links to ideas really created in Product Discovery, by key (demo keys have none). */
const jpdLinks = new Map<string, string>();
let toastId = 0;

/**
 * Holds the compose dialog and the toasts. `onSentToJpd` lets the page mark
 * an initiative as sent (and show its idea key).
 */
export function ShareProvider({
  children,
  onSentToJpd,
}: {
  children: ReactNode;
  onSentToJpd: (item: Shareable, key: string) => void;
}) {
  const [dialog, setDialog] = useState<{ item: Shareable; destination: Destination } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, action?: ToastAction) => {
    const id = toastId++;
    setToasts((current) => [...current, { id, message, action }]);
    // Toasts with a link stay longer, so there's time to use it.
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), action ? 9000 : 4200);
  }, []);

  const value = useMemo<ShareContextValue>(
    () => ({ openDialog: (item, destination) => setDialog({ item, destination }), notify }),
    [notify],
  );

  return (
    <ShareContext.Provider value={value}>
      {children}
      {dialog ? (
        <ShareDialog
          item={dialog.item}
          destination={dialog.destination}
          onClose={() => setDialog(null)}
          onSent={(target, idea) => {
            const { item, destination } = dialog;
            setDialog(null);
            if (destination === "jpd") {
              const key = idea?.key ?? `PD-${nextKey++}`;
              if (idea) jpdLinks.set(idea.key, idea.url);
              onSentToJpd(item, key);
              notify(
                idea
                  ? `Created ${key} in ${target}${idea.skipped.length ? ` — left out: ${idea.skipped.map((s) => s.name).join(", ")}` : ""}.`
                  : `Created ${key} in ${target} — demo, nothing left this browser.`,
                idea ? { label: "Open in Jira", href: idea.url } : undefined,
              );
            } else {
              notify(`Shared to ${target} — demo, nothing left this browser.`);
            }
          }}
        />
      ) : null}
      {createPortal(
        <div className="kb2Toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="kb2Toast">
              <Check size={15} aria-hidden />
              {toast.message}
              {toast.action ? (
                <a className="kb2Toast__action" href={toast.action.href} target="_blank" rel="noopener noreferrer">
                  {toast.action.label}
                  <ExternalLink size={13} aria-hidden />
                </a>
              ) : null}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ShareContext.Provider>
  );
}

// ── Menus ───────────────────────────────────────────────────────────────────

type MenuItem = { label: string; icon: ReactNode; onSelect: () => void; hint?: string } | "divider";

function Menu({ anchor, items, onClose }: { anchor: HTMLElement; items: MenuItem[]; onClose: () => void }) {
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => setPosition(computeAnchoredPosition(anchor, 360)), [anchor]);
  useEffect(() => {
    if (position) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [position]);
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        anchor.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const options = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const index = options.indexOf(document.activeElement as HTMLElement);
        const next = options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length];
        next?.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  if (!position) return null;
  // Right-align with the trigger when that keeps it on screen (triggers sit at card edges).
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268));
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="kb2Menu2"
      data-placement={position.placement}
      style={{ top: position.top, bottom: position.bottom, left, maxHeight: position.maxHeight }}
    >
      {items.map((item, index) =>
        item === "divider" ? (
          <div key={`d${index}`} className="kb2Menu2__divider" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="kb2Menu2__item"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span className="kb2Menu2__icon">{item.icon}</span>
            <span className="kb2Menu2__label">{item.label}</span>
            {item.hint ? <span className="kb2Menu2__hint">{item.hint}</span> : null}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

const logo = (source: string) => <SourceMark source={sourceById(source)} size={15} />;
const icon = (Icon: LucideIcon) => <Icon size={15} strokeWidth={1.8} aria-hidden />;

function useShareItems(item: Shareable) {
  const { openDialog, notify } = useShare();

  const shareItems: MenuItem[] = [
    { label: "Slack", icon: logo("slack"), onSelect: () => openDialog(item, "slack") },
    { label: "Microsoft Teams", icon: logo("microsoft-teams"), onSelect: () => openDialog(item, "teams") },
    ...(item.canSendToJpd
      ? [{ label: "Jira Product Discovery", icon: logo("jira"), onSelect: () => openDialog(item, "jpd") }]
      : []),
  ];

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(done);
    } catch {
      notify("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  const moreItems: MenuItem[] = [
    { label: "Copy link", icon: icon(Link2), hint: "demo link", onSelect: () => copy(item.link, "Link copied.") },
    { label: "Copy as text", icon: icon(Copy), onSelect: () => copy(`${item.title}\n\n${item.summary}`, "Copied the summary.") },
    "divider",
    {
      label: "Download as Markdown",
      icon: icon(Download),
      onSelect: () => {
        const blob = new Blob([toMarkdown(item)], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(item.title)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        notify(`Downloaded ${slugify(item.title)}.md`);
      },
    },
    { label: "Print or save as PDF", icon: icon(Printer), onSelect: () => printSummary(item) },
    {
      label: "Email",
      icon: icon(Mail),
      onSelect: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(`${item.summary}\n\n${item.link}`)}`;
      },
    },
    "divider",
    {
      label: "Create Confluence page",
      icon: logo("confluence"),
      onSelect: () => notify(`Would create a Confluence page for “${item.title}” — demo.`),
    },
    { label: "Add to Notion", icon: logo("notion"), onSelect: () => notify(`Would add “${item.title}” to Notion — demo.`) },
  ];

  return { shareItems, moreItems };
}

/** Prints a clean page with just the summary — the browser's print dialog can save it as PDF. */
function printSummary(item: Shareable) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  const escape = (text: string) => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  doc.open();
  doc.write(
    `<!doctype html><title>${escape(item.title)}</title><body style="font:14px/1.6 system-ui,sans-serif;margin:40px;max-width:680px">` +
      `<p style="color:#666;margin:0">${escape(item.label)}</p><h1 style="margin:4px 0 16px">${escape(item.title)}</h1>` +
      `<pre style="white-space:pre-wrap;font:inherit">${escape(item.summary)}</pre></body>`,
  );
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 1000);
}

/**
 * Share + ⋯ for an item. "full" shows a labelled Share button; "icons" uses
 * icon buttons (tight headers); "compact" is a single ⋯ holding everything
 * (small cards).
 */
export function ShareActions({ item, variant = "full" }: { item: Shareable; variant?: "full" | "icons" | "compact" }) {
  const { shareItems, moreItems } = useShareItems(item);
  const [open, setOpen] = useState<{ which: "share" | "more"; anchor: HTMLElement } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const toggle = (which: "share" | "more", anchor: HTMLElement) =>
    setOpen((current) => (current?.which === which ? null : { which, anchor }));

  const items =
    open?.which === "share" ? shareItems : variant === "compact" ? [...shareItems, "divider" as const, ...moreItems] : moreItems;

  return (
    <span className="kb2ShareActions">
      {variant === "full" ? (
        <button
          type="button"
          className="kb2Button"
          aria-haspopup="menu"
          aria-expanded={open?.which === "share"}
          onClick={(event) => toggle("share", event.currentTarget)}
        >
          <Share size={14} aria-hidden />
          Share
        </button>
      ) : null}
      {variant === "icons" ? (
        <Tip label="Share">
          <button
            type="button"
            className="kb2IconButton"
            aria-label="Share"
            aria-haspopup="menu"
            aria-expanded={open?.which === "share"}
            onClick={(event) => toggle("share", event.currentTarget)}
          >
            <Share size={15} aria-hidden />
          </button>
        </Tip>
      ) : null}
      <Tip label={variant === "compact" ? "Share and export" : "More options"}>
        <button
          type="button"
          className="kb2IconButton"
          aria-label={variant === "compact" ? `Share or export ${item.title}` : "More share and export options"}
          aria-haspopup="menu"
          aria-expanded={open?.which === "more"}
          onClick={(event) => toggle("more", event.currentTarget)}
        >
          <Ellipsis size={16} aria-hidden />
        </button>
      </Tip>
      {open ? <Menu anchor={open.anchor} items={items} onClose={close} /> : null}
    </span>
  );
}

/**
 * Once an initiative has been sent to Jira Product Discovery (from the Share
 * or ⋯ menu), its idea key — nothing before that.
 */
export function JpdStatus({ sentKey, size = "md" }: { sentKey?: string; size?: "md" | "sm" }) {
  const { notify } = useShare();
  if (!sentKey) return null;
  const url = jpdLinks.get(sentKey);
  return (
    <button
      type="button"
      className="kb2JpdChip"
      onClick={() =>
        url ? window.open(url, "_blank", "noopener,noreferrer") : notify(`${sentKey} would open in Jira Product Discovery — demo.`)
      }
      title="Open in Jira Product Discovery"
    >
      <SourceMark source={sourceById("jira")} size={13} />
      {size === "sm" ? `Discovery · ${sentKey}` : `In Product Discovery · ${sentKey}`}
    </button>
  );
}

/** A Product Discovery field value as it'll read there: ratings as five dots, like JPD shows them. */
function JpdFieldDisplay({ field }: { field: JpdFieldValue }) {
  if (field.kind === "rating") {
    const n = Number(field.value);
    return (
      <strong className="kb2JpdRating" aria-label={`${n} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} data-on={i <= n} aria-hidden />
        ))}
        <span className="kb2Muted">{n} / 5</span>
      </strong>
    );
  }
  if (field.kind === "percent") return <strong>{field.value}%</strong>;
  return <strong className="kb2JpdFields__text">{[field.value].flat().join(", ")}</strong>;
}

// ── Compose dialog ──────────────────────────────────────────────────────────

function ShareDialog({
  item,
  destination,
  onClose,
  onSent,
}: {
  item: Shareable;
  destination: Destination;
  onClose: () => void;
  /** `idea` is set when it was really created in Product Discovery. */
  onSent: (target: string, idea?: JpdIdea) => void;
}) {
  const config = DESTINATIONS[destination];
  const [target, setTarget] = useState(config.targets[0]!);
  // Product Discovery: whether the agent server can create real ideas (undefined while checking).
  const [connection, setConnection] = useState<JpdConnection | null | undefined>(destination === "jpd" ? undefined : null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const live = destination === "jpd" && connection?.configured === true;
  const liveTarget = live ? `${connection.projectName ?? connection.projectKey} (${connection.projectKey})` : null;
  const [message, setMessage] = useState(
    destination === "jpd" ? item.summary : `${item.label}: ${item.title}\n\n${item.summary}\n\n${item.link}`,
  );
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (destination !== "jpd") return;
    let cancelled = false;
    void fetchJpdConnection().then((result) => {
      if (!cancelled) setConnection(result);
    });
    return () => {
      cancelled = true;
    };
  }, [destination]);

  const rice = item.initiative ? riceFor(item.initiative) : null;
  // The idea's Product Discovery fields — only the ones that space has, once we know.
  const available = connection?.fields ? new Set(connection.fields.map((f) => f.name.toLowerCase())) : null;
  const jpdFields = item.initiative
    ? jpdFieldsFor(item.initiative).filter((f) => !available || available.has(f.name.toLowerCase()))
    : [];

  const send = async () => {
    if (!live) {
      onSent(target);
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const idea = await createJpdIdea({
        title: item.title,
        description: message,
        fields: jpdFields.map(({ name, value }) => ({ name, value })),
      });
      onSent(liveTarget!, idea);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Couldn't create the idea.");
      setSending(false);
    }
  };

  return createPortal(
    <div className="kb2DialogScrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="kb2Dialog" role="dialog" aria-modal="true" aria-labelledby="kb2-share-title">
        <header className="kb2Dialog__header">
          <span className="kb2Dialog__logo">
            <SourceMark source={sourceById(config.source)} size={18} />
          </span>
          <div>
            <DsTypography as="h2" id="kb2-share-title" variant="paragraph-bold" className="kb2Dialog__title">
              {destination === "jpd" ? "Send to Jira Product Discovery" : `Share to ${config.label}`}
            </DsTypography>
            <span className="kb2Muted kb2Small">
              {item.label} · {item.title}
            </span>
          </div>
          <button ref={closeRef} type="button" className="kb2IconButton" aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="kb2Dialog__body">
          <label className="kb2Field">
            <span className="kb2Field__label">{config.targetLabel}</span>
            {liveTarget ? (
              <select value={liveTarget} disabled className="kb2Field__control">
                <option>{liveTarget}</option>
              </select>
            ) : (
              <select value={target} onChange={(event) => setTarget(event.target.value)} className="kb2Field__control">
                {config.targets.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            )}
          </label>

          {destination === "jpd" ? (
            <section className="kb2JpdFields" aria-label="Idea fields">
              <div className="kb2JpdFields__row">
                <span>Idea</span>
                <strong>{item.title}</strong>
              </div>
              {rice && item.initiative ? (
                <>
                  <div className="kb2JpdFields__row kb2JpdFields__row--score">
                    <span>Impact score</span>
                    <strong>
                      <ImpactBadge score={rice.impactScore} /> / 100 · {rice.confidence.label} confidence
                    </strong>
                  </div>
                  {jpdFields.map((field) => (
                    <div key={field.name} className="kb2JpdFields__row">
                      <span>{field.name}</span>
                      <JpdFieldDisplay field={field} />
                    </div>
                  ))}
                </>
              ) : (
                <div className="kb2JpdFields__row">
                  <span>Scoring</span>
                  <strong>Not scored yet — score it in Product Discovery</strong>
                </div>
              )}
            </section>
          ) : null}

          <label className="kb2Field">
            <span className="kb2Field__label">{destination === "jpd" ? "Description" : "Message"}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="kb2Field__control kb2Field__control--area"
              rows={destination === "jpd" ? 8 : 10}
            />
          </label>
          {destination === "jpd" && connection === undefined ? (
            <p className="kb2Dialog__note">
              <FileText size={13} aria-hidden />
              Checking the connection to Product Discovery…
            </p>
          ) : live ? (
            <p className="kb2Dialog__note kb2Dialog__note--live">
              <Check size={13} aria-hidden />
              Connected — this creates a real idea in {connection.projectName ?? connection.projectKey} on {connection.site}.
            </p>
          ) : (
            <p className="kb2Dialog__note">
              <FileText size={13} aria-hidden />
              {destination === "jpd" && connection?.error
                ? `Not connected: ${connection.error} Sending stays a demo until that's fixed.`
                : "Demo: the message and fields are real, but nothing is sent from this prototype."}
            </p>
          )}
          {sendError ? (
            <p className="kb2Dialog__note kb2Dialog__note--error" role="alert">
              <X size={13} aria-hidden />
              {sendError}
            </p>
          ) : null}
        </div>

        <footer className="kb2Dialog__footer">
          <button type="button" className="kb2Button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="kb2Button kb2Button--primary"
            disabled={sending || (destination === "jpd" && connection === undefined)}
            onClick={() => void send()}
          >
            {sending ? "Sending…" : config.send}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
