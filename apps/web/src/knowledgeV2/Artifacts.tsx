import {
  ArrowLeft,
  ArrowUpRight,
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Plus,
  Presentation,
  X,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { sourceById } from "../knowledge/sources";
import {
  KIND_LABELS,
  isExternal,
  type Artifact,
  type ChartArtifact,
  type DeckArtifact,
  type DocArtifact,
  type DocBlock,
  type FigmaArtifact,
  type JiraArtifact,
} from "./artifactData";
import { ShareActions } from "./ShareMenu";
import { shareArtifact } from "./sharing";
import { Tip } from "./Tip";
import "./Artifacts.css";

/** Logo or icon that marks what kind of thing an artifact is. */
function KindMark({ artifact, size = 14 }: { artifact: Artifact; size?: number }) {
  if (artifact.kind === "figma" || artifact.kind === "jira") return <SourceMark source={sourceById(artifact.kind)} size={size} />;
  const icons: Record<"doc" | "deck" | "chart", LucideIcon> = { doc: FileText, deck: Presentation, chart: ChartColumn };
  const Icon = icons[artifact.kind];
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}

// ── Thumbnails ──────────────────────────────────────────────────────────────

/**
 * A drawn miniature of the artifact — page, slide, chart, Figma canvas or
 * Jira card — so a stack of them reads at a glance. Sized by its container.
 */
export function ArtifactThumb({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case "doc":
      return (
        <span className="kb2Thumb kb2Thumb--doc" aria-hidden>
          <span className="kb2Thumb__title" />
          {artifact.blocks.slice(0, 7).map((block) => (
            <span key={block.id} className={`kb2Thumb__line kb2Thumb__line--${block.type}`} />
          ))}
        </span>
      );
    case "deck":
      return (
        <span className="kb2Thumb kb2Thumb--deck" aria-hidden>
          <span className="kb2Thumb__slide">
            <span className="kb2Thumb__accent" />
            <span className="kb2Thumb__title" />
            <span className="kb2Thumb__line" />
            <span className="kb2Thumb__line kb2Thumb__line--short" />
          </span>
        </span>
      );
    case "chart": {
      const max = Math.max(...artifact.bars.map((bar) => bar.value));
      return (
        <span className="kb2Thumb kb2Thumb--chart" aria-hidden>
          <span className="kb2Thumb__title" />
          <span className="kb2Thumb__bars">
            {artifact.bars.map((bar) => (
              <span key={bar.label} style={{ height: `${(bar.value / max) * 100}%` }} />
            ))}
          </span>
        </span>
      );
    }
    case "figma":
      return (
        <span className="kb2Thumb kb2Thumb--figma" style={{ "--kb2-thumb-accent": artifact.accent } as React.CSSProperties} aria-hidden>
          {artifact.frames.slice(0, 3).map((frame) => (
            <span key={frame} className="kb2Thumb__frame">
              <span className="kb2Thumb__frameBar" />
              <span className="kb2Thumb__line" />
              <span className="kb2Thumb__line kb2Thumb__line--short" />
              <span className="kb2Thumb__button" />
            </span>
          ))}
        </span>
      );
    case "jira":
      return (
        <span className="kb2Thumb kb2Thumb--jira" aria-hidden>
          <span className="kb2Thumb__jiraHead">
            <span className={`kb2Thumb__issueIcon kb2Thumb__issueIcon--${artifact.issueType.toLowerCase()}`} />
            <span className="kb2Thumb__key">{artifact.key}</span>
          </span>
          <span className="kb2Thumb__title" />
          <span className="kb2Thumb__line" />
          <span className={`kb2Thumb__status kb2Thumb__status--${statusClass(artifact.status)}`} />
        </span>
      );
  }
}

function statusClass(status: JiraArtifact["status"]) {
  return status === "Done" ? "done" : status === "In progress" ? "progress" : "todo";
}

// ── Inline card (in the thread) ─────────────────────────────────────────────

/** A file card under a message, like the ones Claude shows for created files. */
export function ArtifactCard({ artifact, onOpen }: { artifact: Artifact; onOpen: () => void }) {
  return (
    <button type="button" className="kb2ArtifactCard" onClick={onOpen}>
      <span className="kb2ArtifactCard__thumb">
        <ArtifactThumb artifact={artifact} />
      </span>
      <span className="kb2ArtifactCard__text">
        <DsTypography as="span" variant="paragraph-small-bold" className="kb2Ellipsis">
          {artifact.title}
        </DsTypography>
        <span className="kb2ArtifactCard__meta">
          <KindMark artifact={artifact} size={12} />
          {KIND_LABELS[artifact.kind]} · {artifact.updated}
        </span>
      </span>
      <span className="kb2ArtifactCard__action">
        {isExternal(artifact) ? "Preview" : "Open"}
      </span>
    </button>
  );
}

// ── Peeking stack (right edge of a chat) ────────────────────────────────────

/**
 * The chat's newest work, peeking in from the right edge as a small stack.
 * Hovering fans the cards out; clicking opens the drawer with every file.
 */
export function ArtifactPeek({ artifacts, onOpen }: { artifacts: Artifact[]; onOpen: () => void }) {
  const shown = artifacts.slice(-3).reverse();
  if (shown.length === 0) return null;
  return (
    <button
      type="button"
      className="kb2Peek"
      onClick={onOpen}
      aria-label={`Show ${artifacts.length} file${artifacts.length === 1 ? "" : "s"} from this chat`}
    >
      {shown.map((artifact, index) => (
        <span key={artifact.id} className="kb2Peek__card" style={{ "--i": index } as React.CSSProperties}>
          <ArtifactThumb artifact={artifact} />
        </span>
      ))}
      <span className="kb2Peek__count">
        {artifacts.length} file{artifacts.length === 1 ? "" : "s"}
      </span>
    </button>
  );
}

// ── Drawer ──────────────────────────────────────────────────────────────────

export type DrawerState = { mode: "list" } | { mode: "view"; id: string; fromList: boolean };

/** Keep in sync with the slide transition in Artifacts.css. */
const SLIDE_MS = 420;

/**
 * Right-hand drawer. "list" is a narrow column of every file in the chat;
 * "view" widens to ~60% of the screen and opens one file — documents and
 * decks are editable in place, Figma and Jira items show a preview with a
 * way out to the real thing.
 */
export function ArtifactDrawer({
  state,
  artifacts,
  onStateChange,
  onClose,
  onChange,
  onAddToPrompt,
}: {
  state: DrawerState | null;
  artifacts: Artifact[];
  onStateChange: (state: DrawerState) => void;
  onClose: () => void;
  onChange: (artifact: Artifact) => void;
  onAddToPrompt: (artifact: Artifact) => void;
}) {
  // Keep the last state mounted while the drawer slides out.
  const [shown, setShown] = useState(state);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (state) {
      setShown(state);
      // Two frames: the first paints the drawer off-screen, so the second has
      // a starting position to transition from. With one, the browser can
      // fold both into the same frame and the drawer just appears.
      let second = 0;
      const first = window.requestAnimationFrame(() => {
        second = window.requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        window.cancelAnimationFrame(first);
        window.cancelAnimationFrame(second);
      };
    }
    setOpen(false);
    // Unmount a beat after the slide-out so its last frame isn't cut off.
    const timer = window.setTimeout(() => setShown(null), SLIDE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target as HTMLElement).isContentEditable) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state, onClose]);

  if (!shown) return null;
  const current = shown.mode === "view" ? artifacts.find((a) => a.id === shown.id) : undefined;
  const viewing = shown.mode === "view" && current;

  return (
    <>
      {/* Light dimming behind the drawer; clicking it closes the drawer. */}
      <div className="kb2DrawerScrim" data-open={open} onClick={onClose} aria-hidden />
      <aside
        className={`kb2Drawer kb2Drawer--${viewing ? "view" : "list"}`}
        data-open={open}
        aria-label={viewing ? current.title : "Files in this chat"}
      >
        <header className="kb2Drawer__header">
          {viewing && shown.fromList ? (
            <Tip label="All files">
              <button type="button" className="kb2IconButton" aria-label="All files" onClick={() => onStateChange({ mode: "list" })}>
                <ArrowLeft size={16} aria-hidden />
              </button>
            </Tip>
          ) : null}
          <div className="kb2Drawer__heading">
            {viewing ? (
              <span className="kb2Drawer__kind">
                <KindMark artifact={current} size={13} />
                {KIND_LABELS[current.kind]}
              </span>
            ) : null}
            <DsTypography as="h2" variant="paragraph-bold" className="kb2Ellipsis">
              {viewing ? current.title : `Files in this chat (${artifacts.length})`}
            </DsTypography>
          </div>
          {viewing ? <ShareActions item={shareArtifact(current)} variant="icons" /> : null}
          {viewing ? (
            <Tip label="Add to prompt">
              <button type="button" className="kb2IconButton" aria-label="Add to prompt" onClick={() => onAddToPrompt(current)}>
                <Plus size={16} aria-hidden />
              </button>
            </Tip>
          ) : null}
          <Tip label="Close">
            <button ref={closeRef} type="button" className="kb2IconButton" aria-label="Close" onClick={onClose}>
              <X size={16} aria-hidden />
            </button>
          </Tip>
        </header>

        <div className="kb2Drawer__body">
          {viewing ? (
            <div key={current.id} className="kb2Drawer__content">
              <ArtifactView artifact={current} onChange={onChange} />
            </div>
          ) : (
            <ul className="kb2Drawer__list kb2Drawer__content">
              {[...artifacts].reverse().map((artifact) => (
                <li key={artifact.id}>
                  <button
                    type="button"
                    className="kb2DrawerItem"
                    onClick={() => onStateChange({ mode: "view", id: artifact.id, fromList: true })}
                  >
                    <span className="kb2DrawerItem__thumb">
                      <ArtifactThumb artifact={artifact} />
                    </span>
                    <span className="kb2DrawerItem__text">
                      <DsTypography as="span" variant="paragraph-small-bold">
                        {artifact.title}
                      </DsTypography>
                      <span className="kb2ArtifactCard__meta">
                        <KindMark artifact={artifact} size={12} />
                        {KIND_LABELS[artifact.kind]} · {artifact.updated}
                      </span>
                      {isExternal(artifact) ? (
                        <span className="kb2DrawerItem__preview">
                          {artifact.kind === "figma" ? `${artifact.frames.length} frames` : `${artifact.key} · ${artifact.status}`}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function ArtifactView({ artifact, onChange }: { artifact: Artifact; onChange: (artifact: Artifact) => void }) {
  switch (artifact.kind) {
    case "doc":
      return <DocEditor doc={artifact} onChange={onChange} />;
    case "deck":
      return <DeckEditor deck={artifact} onChange={onChange} />;
    case "chart":
      return <ChartView chart={artifact} />;
    case "figma":
      return <FigmaView figma={artifact} />;
    case "jira":
      return <JiraView issue={artifact} />;
  }
}

// ── Document editor ─────────────────────────────────────────────────────────

let newBlockId = 0;

/**
 * Editable blocks remount whenever their saved text changes. React tracks the
 * text node it rendered; once the user has typed into the element, the
 * browser may have replaced that node, and patching it in place can duplicate
 * or drop text.
 */
const editKey = (block: DocBlock) => `${block.id}:${block.text}`;

/**
 * Edit-in-place document: every heading, paragraph and bullet is editable.
 * Enter starts a new block after the current one; Backspace in an empty
 * block removes it. Text is committed on blur so typing never resets the caret.
 */
function DocEditor({ doc, onChange }: { doc: DocArtifact; onChange: (artifact: Artifact) => void }) {
  const [status, setStatus] = useState<"saved" | "editing">("saved");
  const [copied, setCopied] = useState(false);
  const focusId = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!focusId.current || !bodyRef.current) return;
    const el = bodyRef.current.querySelector<HTMLElement>(`[data-block="${focusId.current}"]`);
    focusId.current = null;
    if (!el) return;
    el.focus();
    // Caret to the end.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });

  const save = (blocks: DocBlock[], title = doc.title) => {
    onChange({ ...doc, title, blocks, updated: "Just now" });
    setStatus("saved");
  };

  const commit = (id: string, text: string) => {
    const block = doc.blocks.find((x) => x.id === id);
    if (block && block.text !== text) save(doc.blocks.map((x) => (x.id === id ? { ...x, text } : x)));
    else setStatus("saved");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, block: DocBlock, index: number) => {
    const text = event.currentTarget.textContent ?? "";
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const next: DocBlock = { id: `nb${newBlockId++}`, type: block.type === "li" ? "li" : "p", text: "" };
      const blocks = doc.blocks.map((x) => (x.id === block.id ? { ...x, text } : x));
      blocks.splice(index + 1, 0, next);
      focusId.current = next.id;
      save(blocks);
    } else if (event.key === "Backspace" && text === "" && doc.blocks.length > 1) {
      event.preventDefault();
      const previous = doc.blocks[index - 1];
      if (previous) focusId.current = previous.id;
      save(doc.blocks.filter((x) => x.id !== block.id));
    }
  };

  const copy = async () => {
    const markdown = [
      `# ${doc.title}`,
      ...doc.blocks.map((x) => (x.type === "h2" ? `\n## ${x.text}` : x.type === "li" ? `- ${x.text}` : x.text)),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — nothing else to do.
    }
  };

  // Consecutive bullets render inside one <ul>.
  const groups: { list: boolean; items: { block: DocBlock; index: number }[] }[] = [];
  doc.blocks.forEach((block, index) => {
    const list = block.type === "li";
    const last = groups[groups.length - 1];
    if (last && last.list && list) last.items.push({ block, index });
    else groups.push({ list, items: [{ block, index }] });
  });

  const editable = (block: DocBlock, index: number) => ({
    "data-block": block.id,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": block.type === "h2" ? "Heading" : "Write something…",
    onInput: () => setStatus("editing"),
    onBlur: (event: React.FocusEvent<HTMLElement>) => commit(block.id, event.currentTarget.textContent ?? ""),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, block, index),
  });

  return (
    <div className="kb2Doc">
      <div className="kb2Doc__toolbar">
        <span className="kb2Doc__status" aria-live="polite">
          {status === "editing" ? "Editing…" : (
            <>
              <Check size={13} aria-hidden /> Saved
            </>
          )}
        </span>
        <button type="button" className="kb2Button kb2Button--small" onClick={copy}>
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? "Copied" : "Copy as Markdown"}
        </button>
      </div>
      <div className="kb2Doc__page" ref={bodyRef}>
        <h1
          key={doc.title}
          className="kb2Doc__title"
          contentEditable
          suppressContentEditableWarning
          onInput={() => setStatus("editing")}
          onBlur={(event) => {
            const title = event.currentTarget.textContent?.trim() || doc.title;
            if (title !== doc.title) save(doc.blocks, title);
            else setStatus("saved");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        >
          {doc.title}
        </h1>
        {groups.map((group) =>
          group.list ? (
            <ul key={group.items[0]!.block.id}>
              {group.items.map(({ block, index }) => (
                <li key={editKey(block)} {...editable(block, index)}>
                  {block.text}
                </li>
              ))}
            </ul>
          ) : (
            <Fragment key={group.items[0]!.block.id}>
              {group.items.map(({ block, index }) =>
                block.type === "h2" ? (
                  <h2 key={editKey(block)} {...editable(block, index)}>
                    {block.text}
                  </h2>
                ) : (
                  <p key={editKey(block)} {...editable(block, index)}>
                    {block.text}
                  </p>
                ),
              )}
            </Fragment>
          ),
        )}
      </div>
    </div>
  );
}

// ── Deck ────────────────────────────────────────────────────────────────────

function DeckEditor({ deck, onChange }: { deck: DeckArtifact; onChange: (artifact: Artifact) => void }) {
  const [index, setIndex] = useState(0);
  const slide = deck.slides[index]!;

  const updateSlide = (next: DeckArtifact["slides"][number]) =>
    onChange({ ...deck, updated: "Just now", slides: deck.slides.map((s) => (s.id === next.id ? next : s)) });

  return (
    <div className="kb2Deck">
      <div className="kb2Deck__stage">
        <div className="kb2Deck__slide" key={slide.id}>
          <span className="kb2Deck__accent" aria-hidden />
          <h3
            key={slide.title}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => {
              const title = event.currentTarget.textContent ?? "";
              if (title !== slide.title) updateSlide({ ...slide, title });
            }}
          >
            {slide.title}
          </h3>
          <ul>
            {slide.bullets.map((bullet, i) => (
              <li
                key={`${slide.id}-${i}:${bullet}`}
                contentEditable
                suppressContentEditableWarning
                onBlur={(event) => {
                  const text = event.currentTarget.textContent ?? "";
                  if (text !== bullet) updateSlide({ ...slide, bullets: slide.bullets.map((x, j) => (j === i ? text : x)) });
                }}
              >
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="kb2Deck__nav">
        <Tip label="Previous slide">
          <button type="button" className="kb2IconButton" aria-label="Previous slide" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
        </Tip>
        <span className="kb2Muted kb2Small">
          Slide {index + 1} of {deck.slides.length}
        </span>
        <Tip label="Next slide">
          <button
            type="button"
            className="kb2IconButton"
            aria-label="Next slide"
            disabled={index === deck.slides.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </Tip>
      </div>
      <ol className="kb2Deck__strip" aria-label="Slides">
        {deck.slides.map((s, i) => (
          <li key={s.id}>
            <button type="button" className="kb2Deck__mini" aria-current={i === index} onClick={() => setIndex(i)}>
              <span className="kb2Deck__miniTitle">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Chart ───────────────────────────────────────────────────────────────────

function ChartView({ chart }: { chart: ChartArtifact }) {
  const max = Math.max(...chart.bars.map((bar) => bar.value));
  return (
    <div className="kb2ChartView">
      <p className="kb2Muted">{chart.caption}</p>
      <div className="kb2ChartView__plot" role="img" aria-label={chart.bars.map((bar) => `${bar.label} ${bar.value}${chart.unit}`).join(", ")}>
        {chart.bars.map((bar) => (
          <div key={bar.label} className="kb2ChartView__col">
            <span className="kb2ChartView__value">
              {bar.value}
              {chart.unit}
            </span>
            <span className="kb2ChartView__bar" style={{ height: `${(bar.value / max) * 100}%` }} />
            <span className="kb2ChartView__label">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── External previews ───────────────────────────────────────────────────────

function OpenOutside({ href, label }: { href: string; label: string }) {
  return (
    <div className="kb2External__out">
      <a className="kb2Button kb2Button--primary" href={href} target="_blank" rel="noopener noreferrer">
        {label} <ArrowUpRight size={14} aria-hidden />
      </a>
      <span className="kb2Muted kb2Small">Demo link — opens the product's website.</span>
    </div>
  );
}

function FigmaView({ figma }: { figma: FigmaArtifact }) {
  return (
    <div className="kb2External">
      <div className="kb2FigmaCanvas" style={{ "--kb2-thumb-accent": figma.accent } as React.CSSProperties}>
        {figma.frames.map((frame) => (
          <figure key={frame} className="kb2FigmaCanvas__frame">
            <figcaption>{frame}</figcaption>
            <span className="kb2FigmaCanvas__screen" aria-hidden>
              <span className="kb2Thumb__frameBar" />
              <span className="kb2Thumb__line" />
              <span className="kb2Thumb__line kb2Thumb__line--short" />
              <span className="kb2Thumb__line" />
              <span className="kb2Thumb__button" />
            </span>
          </figure>
        ))}
      </div>
      <dl className="kb2External__meta">
        <div>
          <dt>Frames</dt>
          <dd>{figma.frames.length}</dd>
        </div>
        <div>
          <dt>Last edit</dt>
          <dd>{figma.updated.replace(/^Edited /, "")}</dd>
        </div>
      </dl>
      <OpenOutside href={figma.url} label="Open in Figma" />
    </div>
  );
}

function JiraView({ issue }: { issue: JiraArtifact }) {
  return (
    <div className="kb2External">
      <div className="kb2JiraCard">
        <div className="kb2JiraCard__head">
          <span className={`kb2Thumb__issueIcon kb2Thumb__issueIcon--${issue.issueType.toLowerCase()}`} aria-hidden />
          <span className="kb2JiraCard__key">{issue.key}</span>
          <span className={`kb2JiraCard__status kb2JiraCard__status--${statusClass(issue.status)}`}>{issue.status}</span>
        </div>
        <DsTypography as="h3" variant="paragraph-bold">
          {issue.title}
        </DsTypography>
        <p className="kb2JiraCard__summary">{issue.summary}</p>
        <dl className="kb2External__meta">
          <div>
            <dt>Type</dt>
            <dd>{issue.issueType}</dd>
          </div>
          <div>
            <dt>Assignee</dt>
            <dd>{issue.assignee}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{issue.updated}</dd>
          </div>
        </dl>
      </div>
      <OpenOutside href={issue.url} label="Open in Jira" />
    </div>
  );
}
