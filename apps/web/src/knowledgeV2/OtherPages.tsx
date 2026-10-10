import { ArrowLeft, ArrowRight, Check, Pause, Play, Plus, Search, Sparkles, TrendingUp } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { sourceById } from "../knowledge/sources";
import { openSettings } from "../navigationEvents";
import { ArtifactCard } from "./Artifacts";
import type { Artifact } from "./artifactData";
import { Carousel } from "./Carousel";
import { SourceStack } from "./Composer";
import { RiceScore } from "./RiceScore";
import { SendToJpdButton, ShareActions } from "./ShareMenu";
import { shareInitiative } from "./sharing";
import { Tip } from "./Tip";
import {
  AGENTS,
  CONNECTED_SOURCES,
  KNOWLEDGE_TOTALS,
  STAGES,
  TEMPLATES,
  TRENDING_TOPICS,
  type Agent,
  type Chat,
  type Initiative,
  type Template,
} from "./data";
import { AgentTimeline } from "./StartPage";

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * Search: what the knowledge base knows. Connected sources with a one-line
 * "what's in here now", totals, and trending topics as starting points.
 * Picking a source scopes the prompt box to it.
 */
export function SearchPage({
  scopedSourceIds,
  onToggleSource,
  onSearchTopic,
}: {
  scopedSourceIds: ReadonlySet<string>;
  onToggleSource: (id: string) => void;
  onSearchTopic: (topic: string) => void;
}) {
  // Two full rows: as many sources as fit, then "Connect a source" as the
  // last tile. The column count follows the window, so it's measured.
  const sourceGridRef = useRef<HTMLDivElement | null>(null);
  const columns = useGridColumns(sourceGridRef);
  const visibleSources = CONNECTED_SOURCES.slice(0, Math.max(1, columns * 2 - 1));

  return (
    <div className="kb2Search">
      <header className="kb2PageHeader">
        <div>
          <DsTypography as="h1" variant="heading-4" className="kb2PageHeader__title">
            Search your product knowledge
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small" className="kb2PageHeader__subtitle">
            Search one source or all of them at once. Pick sources to narrow the search.
          </DsTypography>
        </div>
        <dl className="kb2Totals">
          {KNOWLEDGE_TOTALS.map((total) => (
            <div key={total.label} className="kb2Totals__item">
              <dt className="kb2Muted kb2Small">{total.label}</dt>
              <dd>{total.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section aria-labelledby="kb2-sources-title" className="kb2Section">
        <div className="kb2Section__head">
          <span id="kb2-sources-title" className="kb2Eyebrow">
            Connected sources
          </span>
          <span className="kb2Muted kb2Small">
            {scopedSourceIds.size > 0 ? `Searching ${scopedSourceIds.size} of ${CONNECTED_SOURCES.length}` : "Searching all sources"}
          </span>
        </div>
        <div className="kb2SourceGrid" ref={sourceGridRef}>
          {visibleSources.map((connected) => {
            const source = sourceById(connected.id);
            const selected = scopedSourceIds.has(connected.id);
            return (
              <button
                key={connected.id}
                type="button"
                className="kb2SourceCard"
                aria-pressed={selected}
                onClick={() => onToggleSource(connected.id)}
              >
                <span className="kb2SourceCard__top">
                  <span className="kb2SourceCard__logo">
                    <SourceMark source={source} size={18} />
                  </span>
                  <DsTypography as="span" variant="paragraph-small-bold">
                    {source.label}
                  </DsTypography>
                  {selected ? <Check size={15} className="kb2SourceCard__check" aria-hidden /> : null}
                </span>
                <DsTypography as="span" variant="paragraph-small" className="kb2Muted">
                  {connected.highlight}
                </DsTypography>
                <span className="kb2Muted kb2Small">
                  {connected.items} · synced {connected.synced}
                </span>
              </button>
            );
          })}
          <button type="button" className="kb2SourceCard kb2SourceCard--add" onClick={() => openSettings("workspace")}>
            <Plus size={18} aria-hidden />
            <DsTypography as="span" variant="paragraph-small-bold">
              Connect a source
            </DsTypography>
            <span className="kb2Muted kb2Small">40+ tools available</span>
          </button>
        </div>
      </section>

      <section aria-labelledby="kb2-trending-title" className="kb2Section">
        <div className="kb2Section__head">
          <span id="kb2-trending-title" className="kb2Eyebrow">
            Trending this week
          </span>
        </div>
        <div className="kb2ChipRow">
          {TRENDING_TOPICS.map((topic) => (
            <button key={topic} type="button" className="kb2Chip" onClick={() => onSearchTopic(topic)}>
              <TrendingUp size={14} aria-hidden />
              <DsTypography as="span" variant="paragraph-small-medium">
                {topic}
              </DsTypography>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** How many columns a CSS grid currently lays out (it's auto-fill, so it changes with width). */
function useGridColumns(ref: React.RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(4);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const measure = () => setColumns(getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Create: the initiative pipeline — agent proposals and your own ideas moving
 * from Proposed to Validating, each with its next step one click away — and
 * templates to start something new from.
 */
export function CreatePage({
  initiatives,
  onAdvance,
  onExplore,
  onPickTemplate,
}: {
  initiatives: Initiative[];
  onAdvance: (id: string) => void;
  onExplore: (initiative: Initiative) => void;
  onPickTemplate: (template: Template) => void;
}) {
  // Highlights the card that just moved so it can be found in its new column.
  const [justMoved, setJustMoved] = useState<string | null>(null);

  return (
    <div className="kb2Create">
      <header className="kb2PageHeader">
        <div>
          <DsTypography as="h1" variant="heading-4" className="kb2PageHeader__title">
            Create
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small" className="kb2PageHeader__subtitle">
            Take initiatives from an idea to something stakeholders can validate — or start a new one from a template.
          </DsTypography>
        </div>
      </header>

      <section aria-labelledby="kb2-pipeline-title" className="kb2Section">
        <div className="kb2Section__head">
          <span id="kb2-pipeline-title" className="kb2Eyebrow">
            Initiative pipeline
          </span>
        </div>
        <div className="kb2Pipeline">
          {STAGES.map((stage) => {
            const items = initiatives.filter((i) => i.stage === stage.id);
            return (
              <section key={stage.id} className="kb2Pipeline__column" aria-label={stage.label}>
                <div className="kb2Pipeline__columnHead">
                  <DsTypography as="h2" variant="paragraph-small-bold">
                    {stage.label}
                  </DsTypography>
                  <span className="kb2Count">{items.length}</span>
                </div>
                {items.map((initiative) => (
                  <article
                    key={initiative.id}
                    className={`kb2PipelineCard${justMoved === initiative.id ? " kb2PipelineCard--moved" : ""}`}
                  >
                    <button type="button" className="kb2PipelineCard__main" onClick={() => onExplore(initiative)}>
                      <DsTypography as="h3" variant="paragraph-small-bold">
                        {initiative.title}
                      </DsTypography>
                      <span className="kb2Meta">
                        <span className="kb2Tag">{initiative.theme}</span>
                        <SourceStack ids={initiative.evidence.map((e) => e.source)} size={13} />
                      </span>
                      <span className="kb2Muted kb2Small">
                        {initiative.origin === "You" ? "Added by you" : <><Sparkles size={11} aria-hidden /> {initiative.origin}</>} ·{" "}
                        {initiative.updated}
                      </span>
                    </button>
                    <div className="kb2PipelineCard__score">
                      <RiceScore initiative={initiative} size="sm" />
                      <ShareActions item={shareInitiative(initiative)} variant="compact" />
                    </div>
                    <SendToJpdButton item={shareInitiative(initiative)} sentKey={initiative.jpdKey} size="sm" />
                    {stage.action ? (
                      <button
                        type="button"
                        className="kb2Button kb2Button--small"
                        onClick={() => {
                          onAdvance(initiative.id);
                          setJustMoved(initiative.id);
                        }}
                      >
                        {stage.action} <ArrowRight size={13} aria-hidden />
                      </button>
                    ) : null}
                  </article>
                ))}
                {items.length === 0 ? <p className="kb2Pipeline__empty">Nothing here yet</p> : null}
              </section>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="kb2-templates-title" className="kb2Section">
        <Carousel
          label="Templates"
          header={
            <span id="kb2-templates-title" className="kb2Eyebrow">
              Start from a template
            </span>
          }
        >
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button key={template.id} type="button" className="kb2TemplateCard" onClick={() => onPickTemplate(template)}>
                <span className="kb2TemplateCard__icon">
                  <Icon size={17} strokeWidth={1.8} aria-hidden />
                </span>
                <DsTypography as="span" variant="paragraph-small-bold">
                  {template.label}
                </DsTypography>
                <DsTypography as="span" variant="paragraph-mini" className="kb2Muted">
                  {template.description}
                </DsTypography>
              </button>
            );
          })}
        </Carousel>
      </section>
    </div>
  );
}

// ── Agents ──────────────────────────────────────────────────────────────────

/** Every background agent: what it watches, how often, and what it last found. */
export function AgentsPage({ onBack, onOpenCreate }: { onBack: () => void; onOpenCreate: () => void }) {
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const toggle = (id: string) =>
    setAgents((current) =>
      current.map((a) => (a.id === id ? { ...a, status: a.status === "paused" ? "idle" : "paused" } : a)),
    );

  return (
    <div className="kb2Agents">
      <button type="button" className="kb2TextButton kb2Back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden /> Start
      </button>
      <header className="kb2PageHeader">
        <div>
          <DsTypography as="h1" variant="heading-4" className="kb2PageHeader__title">
            Agents
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small" className="kb2PageHeader__subtitle">
            Agents run in the background, read your connected sources and bring what they find to Start.
          </DsTypography>
        </div>
        <button type="button" className="kb2Button" disabled title="Coming soon">
          <Plus size={14} aria-hidden /> New agent
        </button>
      </header>

      <div className="kb2AgentsLayout">
        <section aria-label="Your agents" className="kb2AgentList">
          {agents.map((agent) => (
            <article key={agent.id} className="kb2AgentCard">
              <div className="kb2AgentCard__head">
                <span className={`kb2Status kb2Status--${agent.status}`}>
                  {agent.status === "running" ? "Running" : agent.status === "paused" ? "Paused" : "Idle"}
                </span>
                <DsTypography as="h2" variant="paragraph-bold">
                  {agent.name}
                </DsTypography>
                <Tip label={agent.status === "paused" ? "Resume agent" : "Pause agent"} className="kb2AgentCard__toggle">
                  <button
                    type="button"
                    className="kb2IconButton"
                    aria-label={agent.status === "paused" ? `Resume ${agent.name}` : `Pause ${agent.name}`}
                    onClick={() => toggle(agent.id)}
                  >
                    {agent.status === "paused" ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
                  </button>
                </Tip>
              </div>
              <DsTypography as="p" variant="paragraph-small" className="kb2Muted">
                {agent.job}
              </DsTypography>
              <div className="kb2Meta">
                <SourceStack ids={agent.sources} size={14} />
                <span className="kb2Muted kb2Small">{agent.schedule}</span>
              </div>
              <p className="kb2AgentCard__finding">
                <Sparkles size={13} aria-hidden />
                <span>{agent.lastFinding}</span>
              </p>
            </article>
          ))}
        </section>
        <section aria-labelledby="kb2-activity-title" className="kb2Card kb2Card--activity">
          <div className="kb2Card__header">
            <span id="kb2-activity-title" className="kb2Eyebrow">
              Activity
            </span>
          </div>
          <AgentTimeline onOpenInitiative={onOpenCreate} />
        </section>
      </div>
    </div>
  );
}

// ── Chat ────────────────────────────────────────────────────────────────────

export function ChatPage({
  chat,
  pending,
  artifacts,
  onOpenArtifact,
}: {
  chat: Chat;
  pending: boolean;
  artifacts: Artifact[];
  onOpenArtifact: (id: string) => void;
}) {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  return (
    <div className="kb2Chat">
      <header className="kb2PageHeader">
        <DsTypography as="h1" variant="heading-4" className="kb2PageHeader__title">
          {chat.title}
        </DsTypography>
      </header>
      <ol className="kb2Messages" aria-label="Conversation">
        {chat.messages.map((message) => (
          <li key={message.id} className={`kb2Message kb2Message--${message.role}`}>
            {message.role === "assistant" && message.demo ? <span className="kb2Tag kb2Tag--demo">Demo response</span> : null}
            <DsTypography as="p" variant="paragraph-small" className="kb2Message__text">
              {message.text}
            </DsTypography>
            {message.artifacts?.length ? (
              <div className="kb2Message__artifacts">
                {message.artifacts.map((id) => {
                  const artifact = byId.get(id);
                  return artifact ? <ArtifactCard key={id} artifact={artifact} onOpen={() => onOpenArtifact(id)} /> : null;
                })}
              </div>
            ) : null}
            {(message.context?.length ?? 0) + (message.sources?.length ?? 0) > 0 ? (
              <div className="kb2Message__refs">
                {message.context?.map((ref) => (
                  <span key={ref.id} className="kb2Tag">
                    {ref.label}
                  </span>
                ))}
                {message.sources?.map((id) => (
                  <span key={id} className="kb2Tag kb2Tag--source">
                    <SourceMark source={sourceById(id)} size={12} />
                    {sourceById(id).label}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        {pending ? (
          <li className="kb2Message kb2Message--assistant kb2Message--pending" aria-live="polite">
            <Search size={14} aria-hidden /> Looking through your sources…
          </li>
        ) : null}
      </ol>
    </div>
  );
}
