import { FolderPlus, House, Search } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { sourceById } from "../knowledge/sources";
import { ArtifactDrawer, ArtifactPeek, type DrawerState } from "./Artifacts";
import { INITIAL_ARTIFACTS, KIND_LABELS, TEMPLATE_OUTLINES, draftFromTemplate, type Artifact } from "./artifactData";
import { Composer, Starters, type Attachment, type ComposerHandle } from "./Composer";
import { parsePrompt, promptText, type PromptSegment } from "./promptSlots";
import {
  DEFAULT_TRACKED_METRICS,
  INITIAL_CHATS,
  INITIAL_INITIATIVES,
  CONNECTED_COUNT,
  CREATE_STARTERS,
  SEARCH_STARTERS,
  START_STARTERS,
  STAGES,
  type Chat,
  type ContextRef,
  type Message,
  type Starter,
} from "./data";
import { InitiativeDrawer, type InitiativeDrawerActions } from "./InitiativeDrawer";
import { InsightsPage } from "./InsightsPage";
import { AgentsPage, ChatPage, CreatePage, SearchPage } from "./OtherPages";
import { RollOnce } from "./RollingNumber";
import { ShareProvider } from "./ShareMenu";
import { StartPage, type StartActions } from "./StartPage";
// Same canvas, composer and source chips as v1 — v2 changes what surrounds them.
import "../accelerator/DsAcceleratorTool.css";
import "../accelerator/SlotIntake.css";
import "./KnowledgeV2.css";

type Page =
  | { kind: "start" }
  | { kind: "search" }
  | { kind: "create" }
  | { kind: "agents" }
  | { kind: "insights"; id?: string }
  | { kind: "chat"; id: string };

const NAV = [
  { kind: "start", label: "Start", icon: House },
  { kind: "search", label: "Search", icon: Search },
  { kind: "create", label: "Create", icon: FolderPlus },
] as const;

const PLACEHOLDERS: Record<Page["kind"], string> = {
  start: "Ask anything about your product — or about something agents found…",
  search: `Search across Jira, Figma, Zendesk and ${CONNECTED_COUNT - 3} more sources…`,
  create: "Describe an initiative to plan, or pick a template above…",
  agents: "Ask about what your agents found…",
  insights: "Ask about an insight, or what's behind it…",
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
  // Text plus [slot] chips — see promptSlots.ts.
  const [draft, setDraft] = useState<PromptSegment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const composerRef = useRef<ComposerHandle | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const replyTimer = useRef<number | undefined>(undefined);
  const contentEndRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const fullDockHeight = useRef(FALLBACK_DOCK_HEIGHT);
  const [artifacts, setArtifacts] = useState<Artifact[]>(INITIAL_ARTIFACTS);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  // The initiative open in the right-hand drawer, from Start, Create or Insights.
  const [openInitiativeId, setOpenInitiativeId] = useState<string | null>(null);
  const [overContent, setOverContent] = useState(false);
  // Scrolled away from the top: content fades out under the top edge.
  const [scrolled, setScrolled] = useState(false);
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
      setScrolled(main.scrollTop > 2);
      // The bottom fade behind the box spans the whole main column.
      const dock = dockRef.current;
      if (dock) main.style.setProperty("--kb2-dock-bleed", `${Math.max(0, (main.clientWidth - dock.offsetWidth) / 2)}px`);
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
    setDrawer(null);
    setOpenInitiativeId(null);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const addContext = useCallback((ref: ContextRef) => {
    setAttachments((current) => (current.some((a) => a.id === ref.id) ? current : [...current, { kind: "context", id: ref.id, ref }]));
    composerRef.current?.focus();
  }, []);

  const prefill = useCallback(
    (prompt: string, ref?: ContextRef) => {
      setDraft(parsePrompt(prompt));
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
    const text = promptText(draft).trim();
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

    setDraft([]);
    setAttachments([]);
    setPendingChatId(chatId);
    window.clearTimeout(replyTimer.current);
    // A template prompt gets a starter document with that template's sections.
    const template = context.find((c) => c.kind === "template");
    const templateId = template?.id.replace(/^template:/, "");
    const draftDoc =
      template && templateId && TEMPLATE_OUTLINES[templateId]
        ? draftFromTemplate(chatId, `${template.label} — draft`, TEMPLATE_OUTLINES[templateId])
        : null;
    replyTimer.current = window.setTimeout(() => {
      if (draftDoc) setArtifacts((current) => [...current, draftDoc]);
      setChats((current) =>
        current.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, demoReply(sources, context, draftDoc)] } : c)),
      );
      setPendingChatId(null);
    }, 900);
  };

  const initiativeRef = (initiative: { id: string; title: string }): ContextRef => ({
    id: `initiative:${initiative.id}`,
    label: initiative.title,
    kind: "initiative",
  });

  const initiativeActions: InitiativeDrawerActions = {
    advance,
    refine: (initiative) => {
      setOpenInitiativeId(null);
      prefill(
        `Help me refine “${initiative.title}”: what's missing from the case for it, what would raise confidence, and what should the next step be?`,
        initiativeRef(initiative),
      );
    },
    askSource: (initiative, sourceId) => {
      setOpenInitiativeId(null);
      prefill(`What does ${sourceById(sourceId).label} tell us about “${initiative.title}”? Show the details behind it.`, initiativeRef(initiative));
      setAttachments((current) =>
        current.some((a) => a.kind === "source" && a.id === sourceId) ? current : [...current, { kind: "source", id: sourceId }],
      );
    },
    openInsight: (id) => go({ kind: "insights", id }),
    addNote: (id, text) =>
      setInitiatives((current) =>
        current.map((i) =>
          i.id === id ? { ...i, updated: "Just now", notes: [...(i.notes ?? []), { id: uid("note"), text, added: "Just now" }] } : i,
        ),
      ),
  };

  const startActions: StartActions = {
    openInitiative: setOpenInitiativeId,
    addContext,
    explore: prefill,
    startInitiative: (id) => {
      advance(id);
      go({ kind: "create" });
    },
    openChat: (id) => go({ kind: "chat", id }),
    openAgents: () => go({ kind: "agents" }),
    openCreate: () => go({ kind: "create" }),
    openInsights: (id) => go({ kind: "insights", id }),
  };

  const pickStarter = (starter: Starter) => prefill(starter.prompt);
  const activeChat = page.kind === "chat" ? chats.find((c) => c.id === page.id) : undefined;
  const chatArtifacts = activeChat ? artifacts.filter((a) => a.chatId === activeChat.id) : [];
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const closeInitiative = useCallback(() => setOpenInitiativeId(null), []);
  const scopedSourceIds = new Set(attachments.filter((a) => a.kind === "source").map((a) => a.id));

  return (
    <ShareProvider
      onSentToJpd={(item, key) => {
        if (item.kind !== "initiative") return;
        setInitiatives((current) => current.map((i) => (i.id === item.id ? { ...i, jpdKey: key } : i)));
      }}
    >
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

        <div className="kb2Main" ref={mainRef} data-scrolled={scrolled}>
          <div className={`kb2Main__inner kb2Main__inner--${page.kind}`}>
            {/* Impact scores roll in on a page's first visit only. */}
            <RollOnce key={page.kind} scope={page.kind}>
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
                  onOpen={(initiative) => setOpenInitiativeId(initiative.id)}
                  onPickTemplate={(template) =>
                    prefill(template.prompt, { id: `template:${template.id}`, label: template.label, kind: "template" })
                  }
                />
              ) : page.kind === "insights" ? (
                <InsightsPage
                  initiatives={initiatives}
                  selectedId={page.id}
                  // Selecting within the page shouldn't scroll back to the top.
                  onSelect={(id) => setPage({ kind: "insights", id })}
                  onBack={() => go({ kind: "start" })}
                  actions={startActions}
                />
              ) : page.kind === "agents" ? (
                <AgentsPage onBack={() => go({ kind: "start" })} onOpenCreate={() => go({ kind: "create" })} />
              ) : activeChat ? (
                <ChatPage
                  chat={activeChat}
                  pending={pendingChatId === activeChat.id}
                  artifacts={chatArtifacts}
                  onOpenArtifact={(id) => setDrawer({ mode: "view", id, fromList: false })}
                />
              ) : (
                <DsTypography as="p" variant="paragraph-small">
                  That chat no longer exists.
                </DsTypography>
              )}
            </RollOnce>

            {/* Landing pages: clear space between the content and the prompt box
                once it settles at the bottom of the page. */}
            {page.kind === "start" || page.kind === "search" || page.kind === "create" ? (
              <div className="kb2LandingGap" aria-hidden />
            ) : null}
            <div ref={contentEndRef} className="kb2ContentEnd" aria-hidden />
            <div ref={dockRef} className={`kb2ComposerDock${overContent ? " kb2ComposerDock--floating" : ""}`}>
              <Composer
                ref={composerRef}
                compact={compact}
                onFocusWithinChange={setComposerFocused}
                value={draft}
                onChange={setDraft}
                initiatives={initiatives}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                onSubmit={send}
                placeholder={PLACEHOLDERS[page.kind]}
                label="Prompt"
              />
            </div>

            {/* Landing pages end with room below the prompt box, so scrolling to
                the bottom leaves it in the middle of the screen. */}
            {page.kind === "start" || page.kind === "search" || page.kind === "create" ? (
              <div className="kb2Tail">
                {page.kind === "start" ? <Starters starters={START_STARTERS} onPick={pickStarter} /> : null}
                {page.kind === "search" ? <Starters starters={SEARCH_STARTERS} onPick={pickStarter} /> : null}
                {page.kind === "create" ? <Starters starters={CREATE_STARTERS} onPick={pickStarter} /> : null}
              </div>
            ) : null}
          </div>
        </div>

        {activeChat && !drawer ? <ArtifactPeek artifacts={chatArtifacts} onOpen={() => setDrawer({ mode: "list" })} /> : null}
        <InitiativeDrawer
          initiativeId={openInitiativeId}
          initiatives={initiatives}
          onClose={closeInitiative}
          actions={initiativeActions}
        />
        <ArtifactDrawer
          state={activeChat ? drawer : null}
          artifacts={chatArtifacts}
          onStateChange={setDrawer}
          onClose={closeDrawer}
          onChange={(next) => setArtifacts((current) => current.map((a) => (a.id === next.id ? next : a)))}
          onAddToPrompt={(artifact) =>
            addContext({ id: `file:${artifact.id}`, label: `${artifact.title} (${KIND_LABELS[artifact.kind]})`, kind: "file" })
          }
        />
      </main>
    </ShareProvider>
  );
}

/** Honest placeholder reply: says what a real answer would draw on. */
function demoReply(sources: string[], context: ContextRef[], draftDoc: Artifact | null): Message {
  const from = sources.length > 0 ? sources.map((id) => sourceById(id).label).join(", ") : `all ${CONNECTED_COUNT} connected sources`;
  const about = context.length > 0 ? `, using ${context.map((c) => `“${c.label}”`).join(" and ")} as context` : "";
  return {
    id: uid("m"),
    role: "assistant",
    demo: true,
    text: draftDoc
      ? `I've started “${draftDoc.title}” with the template's sections — open it to fill it in. Answering isn't connected yet in this preview; once it is, I'll draft each section from ${from}${about} and cite every source.`
      : `Answering isn't connected yet in this preview. Once it is, I'll answer from ${from}${about}, cite every source I use, and suggest a next step — such as starting an initiative or extracting a brief.`,
    sources,
    artifacts: draftDoc ? [draftDoc.id] : undefined,
  };
}
