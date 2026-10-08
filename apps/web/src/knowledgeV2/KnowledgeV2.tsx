import { FolderPlus, House, Search } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { sourceById } from "../knowledge/sources";
import { Composer, Starters, type Attachment, type ComposerHandle } from "./Composer";
import {
  DEFAULT_TRACKED_METRICS,
  INITIAL_CHATS,
  INITIAL_INITIATIVES,
  SEARCH_STARTERS,
  START_STARTERS,
  STAGES,
  type Chat,
  type ContextRef,
  type Message,
  type Starter,
} from "./data";
import { AgentsPage, ChatPage, CreatePage, SearchPage } from "./OtherPages";
import { StartPage, type StartActions } from "./StartPage";
// Same canvas, composer and source chips as v1 — v2 changes what surrounds them.
import "../accelerator/DsAcceleratorTool.css";
import "../accelerator/SlotIntake.css";
import "./KnowledgeV2.css";

type Page = { kind: "start" } | { kind: "search" } | { kind: "create" } | { kind: "agents" } | { kind: "chat"; id: string };

const NAV = [
  { kind: "start", label: "Start", icon: House },
  { kind: "search", label: "Search", icon: Search },
  { kind: "create", label: "Create", icon: FolderPlus },
] as const;

const PLACEHOLDERS: Record<Page["kind"], string> = {
  start: "Ask anything about your product — or about something agents found…",
  search: "Search across Jira, Figma, Zendesk and 4 more sources…",
  create: "Describe an initiative to plan, or pick a template above…",
  agents: "Ask about what your agents found…",
  chat: "Ask a follow-up…",
};

/** Height of the full prompt box plus the strip under it, before it has been measured. */
const FALLBACK_DOCK_HEIGHT = 170;

let nextId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;

/**
 * Product Knowledge Base v2 — proactive rather than prompt-first. Background
 * agents watch the connected sources and bring proposals, metric changes and
 * insights to Start; Search shows what the knowledge base holds; Create runs
 * initiatives from proposal to validation. The prompt box stays on every page.
 *
 * Everything is fixture data (./data.ts) and replies are canned — there is no
 * knowledge backend or agent runtime yet.
 */
export function KnowledgeV2() {
  const [page, setPage] = useState<Page>({ kind: "start" });
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [initiatives, setInitiatives] = useState(INITIAL_INITIATIVES);
  const [trackedMetricIds, setTrackedMetricIds] = useState(DEFAULT_TRACKED_METRICS);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const composerRef = useRef<ComposerHandle | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const replyTimer = useRef<number | undefined>(undefined);
  const contentEndRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const fullDockHeight = useRef(FALLBACK_DOCK_HEIGHT);
  const [overContent, setOverContent] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const compact = overContent && !composerFocused;

  useEffect(() => () => window.clearTimeout(replyTimer.current), []);

  // The prompt box floats over content (and goes compact) until the page is
  // scrolled to where the content ends. Measured from a marker at the end of
  // the content — not from the box itself — so the box changing height can't
  // flip it back and forth.
  useLayoutEffect(() => {
    const main = mainRef.current;
    const end = contentEndRef.current;
    if (!main || !end) return;
    const update = () => {
      const roomForFullBox = main.getBoundingClientRect().bottom - fullDockHeight.current;
      setOverContent(end.getBoundingClientRect().top > roomForFullBox + 1);
    };
    update();
    main.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(main);
    if (main.firstElementChild) observer.observe(main.firstElementChild);
    return () => {
      main.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // Remember how tall the full box is, so the check above knows how much room it needs.
  useLayoutEffect(() => {
    if (!compact && dockRef.current) fullDockHeight.current = dockRef.current.offsetHeight;
  });

  const go = useCallback((next: Page) => {
    setPage(next);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const addContext = useCallback((ref: ContextRef) => {
    setAttachments((current) => (current.some((a) => a.id === ref.id) ? current : [...current, { kind: "context", id: ref.id, ref }]));
    composerRef.current?.focus();
  }, []);

  const prefill = useCallback(
    (prompt: string, ref?: ContextRef) => {
      setDraft(prompt);
      if (ref) addContext(ref);
      composerRef.current?.focus();
    },
    [addContext],
  );

  const advance = useCallback((id: string) => {
    setInitiatives((current) =>
      current.map((i) => {
        if (i.id !== id) return i;
        const next = STAGES[STAGES.findIndex((s) => s.id === i.stage) + 1];
        return next ? { ...i, stage: next.id, updated: "Just now" } : i;
      }),
    );
  }, []);

  const toggleSource = useCallback((id: string) => {
    setAttachments((current) =>
      current.some((a) => a.kind === "source" && a.id === id)
        ? current.filter((a) => !(a.kind === "source" && a.id === id))
        : [...current, { kind: "source", id }],
    );
  }, []);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const sources = attachments.filter((a) => a.kind === "source").map((a) => a.id);
    const context = attachments.flatMap((a) => (a.kind === "context" ? [a.ref] : []));
    const userMessage: Message = { id: uid("m"), role: "user", text, sources, context };

    let chatId: string;
    if (page.kind === "chat") {
      chatId = page.id;
      setChats((current) =>
        current.map((c) => (c.id === chatId ? { ...c, updated: "Just now", messages: [...c.messages, userMessage] } : c)),
      );
    } else {
      chatId = uid("chat");
      const title = text.length > 34 ? `${text.slice(0, 32).trimEnd()}…` : text;
      setChats((current) => [{ id: chatId, title, updated: "Just now", messages: [userMessage] }, ...current]);
      go({ kind: "chat", id: chatId });
    }

    setDraft("");
    setAttachments([]);
    setPendingChatId(chatId);
    window.clearTimeout(replyTimer.current);
    replyTimer.current = window.setTimeout(() => {
      setChats((current) =>
        current.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, demoReply(sources, context)] } : c)),
      );
      setPendingChatId(null);
    }, 900);
  };

  const startActions: StartActions = {
    addContext,
    explore: prefill,
    startInitiative: (id) => {
      advance(id);
      go({ kind: "create" });
    },
    openChat: (id) => go({ kind: "chat", id }),
    openAgents: () => go({ kind: "agents" }),
    openCreate: () => go({ kind: "create" }),
  };

  const pickStarter = (starter: Starter) => prefill(starter.prompt);
  const activeChat = page.kind === "chat" ? chats.find((c) => c.id === page.id) : undefined;
  const scopedSourceIds = new Set(attachments.filter((a) => a.kind === "source").map((a) => a.id));

  return (
    <main className="accelerator kb2" aria-label="Product Knowledge Base v2">
      <nav className="kb2Sidebar" aria-label="Knowledge base">
        <ul className="kb2Nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = page.kind === item.kind;
            return (
              <li key={item.kind}>
                <button
                  type="button"
                  className="kb2Nav__item"
                  aria-current={active ? "page" : undefined}
                  onClick={() => go({ kind: item.kind })}
                >
                  {item.label}
                  <Icon size={16} strokeWidth={1.9} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="kb2Sidebar__divider" />
        <span className="kb2Eyebrow kb2Sidebar__label">History</span>
        <ul className="kb2Nav kb2Nav--history">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                className="kb2Nav__item"
                aria-current={page.kind === "chat" && page.id === chat.id ? "page" : undefined}
                onClick={() => go({ kind: "chat", id: chat.id })}
                title={chat.title}
              >
                <span className="kb2Ellipsis">{chat.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="kb2Main" ref={mainRef}>
        <div className={`kb2Main__inner kb2Main__inner--${page.kind}`}>
          {page.kind === "start" ? (
            <StartPage
              initiatives={initiatives}
              trackedMetricIds={trackedMetricIds}
              onTrackedMetricsChange={setTrackedMetricIds}
              actions={startActions}
            />
          ) : page.kind === "search" ? (
            <SearchPage
              scopedSourceIds={scopedSourceIds}
              onToggleSource={toggleSource}
              onSearchTopic={(topic) => prefill(`What's new about ${topic.toLowerCase()} this week? Group what you find by source.`)}
            />
          ) : page.kind === "create" ? (
            <CreatePage
              initiatives={initiatives}
              onAdvance={advance}
              onExplore={(initiative) =>
                prefill(`Summarize where “${initiative.title}” stands and what the next step should be.`, {
                  id: `initiative:${initiative.id}`,
                  label: initiative.title,
                  kind: "initiative",
                })
              }
              onPickTemplate={(template) =>
                prefill(template.prompt, { id: `template:${template.id}`, label: template.label, kind: "template" })
              }
            />
          ) : page.kind === "agents" ? (
            <AgentsPage onBack={() => go({ kind: "start" })} onOpenCreate={() => go({ kind: "create" })} />
          ) : activeChat ? (
            <ChatPage chat={activeChat} pending={pendingChatId === activeChat.id} />
          ) : (
            <DsTypography as="p" variant="paragraph-small">
              That chat no longer exists.
            </DsTypography>
          )}

          <div ref={contentEndRef} className="kb2ContentEnd" aria-hidden />
          <div ref={dockRef} className={`kb2ComposerDock${overContent ? " kb2ComposerDock--floating" : ""}`}>
            <Composer
              ref={composerRef}
              compact={compact}
              onFocusWithinChange={setComposerFocused}
              value={draft}
              onChange={setDraft}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              onSubmit={send}
              placeholder={PLACEHOLDERS[page.kind]}
              label="Prompt"
            />
          </div>

          {page.kind === "start" ? <Starters starters={START_STARTERS} onPick={pickStarter} /> : null}
          {page.kind === "search" ? <Starters starters={SEARCH_STARTERS} onPick={pickStarter} /> : null}
        </div>
      </div>
    </main>
  );
}

/** Honest placeholder reply: says what a real answer would draw on. */
function demoReply(sources: string[], context: ContextRef[]): Message {
  const from = sources.length > 0 ? sources.map((id) => sourceById(id).label).join(", ") : "all 7 connected sources";
  const about = context.length > 0 ? `, using ${context.map((c) => `“${c.label}”`).join(" and ")} as context` : "";
  return {
    id: uid("m"),
    role: "assistant",
    demo: true,
    text: `Answering isn't connected yet in this preview. Once it is, I'll answer from ${from}${about}, cite every source I use, and suggest a next step — such as starting an initiative or extracting a brief.`,
    sources,
  };
}
