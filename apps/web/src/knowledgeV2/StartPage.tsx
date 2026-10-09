import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock,
  Frame,
  MessageSquare,
  NotebookText,
  Plus,
  Settings2,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { sourceById } from "../knowledge/sources";
import { SourceStack, Sparkline } from "./Composer";
import { Tip } from "./Tip";
import {
  AGENT_RUNS,
  METRICS,
  RECENT_WORK,
  SIGNALS,
  agentById,
  type ContextRef,
  type Initiative,
  type Metric,
  type WorkItem,
} from "./data";

export type StartActions = {
  /** Put something from a card into the prompt box as context. */
  addContext: (ref: ContextRef) => void;
  /** Pre-fill the prompt box with a question about something, with it attached. */
  explore: (prompt: string, ref: ContextRef) => void;
  startInitiative: (id: string) => void;
  openChat: (id: string) => void;
  openAgents: () => void;
  openCreate: () => void;
  /** The Insights page, optionally with one insight selected. */
  openInsights: (id?: string) => void;
};

/**
 * Start: what the agents found since you last looked. Proposals, the metrics
 * you track, insights and your unfinished work on the left; the agents' own
 * activity in the tall column on the right — the layout from the Figma sketch.
 */
export function StartPage({
  initiatives,
  trackedMetricIds,
  onTrackedMetricsChange,
  actions,
}: {
  initiatives: Initiative[];
  trackedMetricIds: string[];
  onTrackedMetricsChange: (ids: string[]) => void;
  actions: StartActions;
}) {
  const proposed = initiatives.filter((i) => i.stage === "proposed");
  return (
    <div className="kb2Start">
      <header className="kb2PageHeader">
        <div>
          <DsTypography as="h1" variant="heading-4" className="kb2PageHeader__title">
            Good morning — here's what's new
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small" className="kb2PageHeader__subtitle">
            Your agents checked 7 sources overnight: {proposed.length} initiative{proposed.length === 1 ? "" : "s"} to review,{" "}
            {NEW_SIGNALS.length} new insights.
          </DsTypography>
        </div>
      </header>

      <div className="kb2StartGrid">
        <ProposalCard proposals={proposed} actions={actions} />
        <MetricsCard trackedIds={trackedMetricIds} onChange={onTrackedMetricsChange} actions={actions} />
        <SignalsCard initiatives={initiatives} actions={actions} />
        <RecentWorkCard actions={actions} />
        <AgentsCard actions={actions} />
      </div>
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

function CardHeader({ eyebrow, children }: { eyebrow: string; children?: React.ReactNode }) {
  return (
    <div className="kb2Card__header">
      <span className="kb2Eyebrow">{eyebrow}</span>
      {children}
    </div>
  );
}

function ProposalCard({ proposals, actions }: { proposals: Initiative[]; actions: StartActions }) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(proposals.length - 1, 0));
  const initiative = proposals[safeIndex];

  if (!initiative) {
    return (
      <article className="kb2Card kb2Card--proposal">
        <CardHeader eyebrow="Suggested initiatives" />
        <DsTypography as="p" variant="paragraph-small" className="kb2Muted">
          You've reviewed every proposal. Agents will add new ones as they find them.
        </DsTypography>
        <button type="button" className="kb2TextButton" onClick={actions.openCreate}>
          See your pipeline <ArrowRight size={14} aria-hidden />
        </button>
      </article>
    );
  }

  const ref: ContextRef = { id: `initiative:${initiative.id}`, label: initiative.title, kind: "initiative" };
  return (
    <article className="kb2Card kb2Card--proposal">
      <CardHeader eyebrow="Suggested initiative">
        {proposals.length > 1 ? (
          <div className="kb2Pager">
            <Tip label="Previous suggestion">
              <button
                type="button"
                className="kb2IconButton"
                aria-label="Previous suggestion"
                disabled={safeIndex === 0}
                onClick={() => setIndex(safeIndex - 1)}
              >
                <ChevronLeft size={15} aria-hidden />
              </button>
            </Tip>
            <span className="kb2Pager__count">
              {safeIndex + 1} of {proposals.length}
            </span>
            <Tip label="Next suggestion">
              <button
                type="button"
                className="kb2IconButton"
                aria-label="Next suggestion"
                disabled={safeIndex === proposals.length - 1}
                onClick={() => setIndex(safeIndex + 1)}
              >
                <ChevronRight size={15} aria-hidden />
              </button>
            </Tip>
          </div>
        ) : null}
      </CardHeader>

      <div className="kb2Card__body">
        <DsTypography as="h3" variant="paragraph-bold" className="kb2Card__title">
          {initiative.title}
        </DsTypography>
        <DsTypography as="p" variant="paragraph-small" className="kb2Muted kb2Clamp3">
          {initiative.summary}
        </DsTypography>
        <div className="kb2Meta">
          <span className="kb2Tag">{initiative.theme}</span>
          <ConfidenceMeter value={initiative.confidence} />
        </div>
        <div className="kb2Meta">
          <SourceStack ids={initiative.evidence.map((e) => e.source)} />
          <span className="kb2Muted kb2Small">
            {initiative.evidence.length} sources · by {initiative.origin}
          </span>
        </div>
      </div>

      <div className="kb2Card__actions">
        <button type="button" className="kb2Button kb2Button--primary" onClick={() => actions.startInitiative(initiative.id)}>
          Start initiative
        </button>
        <button
          type="button"
          className="kb2Button"
          onClick={() => actions.explore(`What's the full evidence behind “${initiative.title}”, and what would we need to validate first?`, ref)}
        >
          Learn more
        </button>
      </div>
    </article>
  );
}

function MetricsCard({
  trackedIds,
  onChange,
  actions,
}: {
  trackedIds: string[];
  onChange: (ids: string[]) => void;
  actions: StartActions;
}) {
  const metrics = trackedIds.map((id) => METRICS.find((m) => m.id === id)).filter((m): m is Metric => Boolean(m));
  const [focusId, setFocusId] = useState(metrics[0]?.id);
  const focus = metrics.find((m) => m.id === focusId) ?? metrics[0];

  return (
    <article className="kb2Card kb2Card--metrics">
      <CardHeader eyebrow="Tracked metrics">
        <CustomizeMetrics trackedIds={trackedIds} onChange={onChange} />
      </CardHeader>

      {focus ? (
        <>
          <div className="kb2Card__body">
            <div className="kb2MetricHero">
              <div>
                <DsTypography as="p" variant="paragraph-small" className="kb2Muted">
                  {focus.label}
                </DsTypography>
                <DsTypography as="p" variant="heading-3" className="kb2MetricHero__value">
                  {focus.value}
                </DsTypography>
                <TrendBadge metric={focus} />
              </div>
              <span className={`kb2MetricHero__chart kb2Trend--${focus.trend}`}>
                <Sparkline series={focus.series} width={128} height={48} />
              </span>
            </div>
            {focus.goal ? (
              <DsTypography as="p" variant="paragraph-mini" className="kb2Muted">
                {focus.goal}
              </DsTypography>
            ) : null}
            <ul className="kb2MetricList" aria-label="Other tracked metrics">
              {metrics.map((metric) => (
                <li key={metric.id}>
                  <button
                    type="button"
                    className="kb2MetricRow"
                    aria-pressed={metric.id === focus.id}
                    onClick={() => setFocusId(metric.id)}
                  >
                    <SourceMark source={sourceById(metric.source)} size={14} />
                    <span className="kb2MetricRow__label">{metric.label}</span>
                    <span className={`kb2MetricRow__delta kb2Trend--${metric.trend}`}>{metric.delta}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="kb2Card__actions">
            <button
              type="button"
              className="kb2Button"
              onClick={() =>
                actions.explore(`Why did ${focus.label.toLowerCase()} change ${focus.delta} ${focus.period}? What's driving it?`, {
                  id: `metric:${focus.id}`,
                  label: focus.label,
                  kind: "metric",
                })
              }
            >
              Learn more
            </button>
            <AddToPromptButton onClick={() => actions.addContext({ id: `metric:${focus.id}`, label: focus.label, kind: "metric" })} />
          </div>
        </>
      ) : (
        <DsTypography as="p" variant="paragraph-small" className="kb2Muted">
          Pick the metrics you want agents to watch with Customize.
        </DsTypography>
      )}
    </article>
  );
}

function CustomizeMetrics({ trackedIds, onChange }: { trackedIds: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useDismiss(open, rootRef, () => setOpen(false));

  return (
    <div className="kb2Menu" ref={rootRef}>
      <button
        type="button"
        className="kb2TextButton"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 size={14} aria-hidden />
        Customize
      </button>
      {open ? (
        <div className="kb2Menu__panel" role="group" aria-label="Metrics to track">
          <span className="kb2Eyebrow">Track up to 3</span>
          {METRICS.map((metric) => {
            const checked = trackedIds.includes(metric.id);
            const full = !checked && trackedIds.length >= 3;
            return (
              <button
                key={metric.id}
                type="button"
                className="kb2Menu__row"
                aria-pressed={checked}
                disabled={full}
                onClick={() => onChange(checked ? trackedIds.filter((id) => id !== metric.id) : [...trackedIds, metric.id])}
              >
                <SourceMark source={sourceById(metric.source)} size={14} />
                <span>{metric.label}</span>
                {checked ? <Check size={15} className="kb2Menu__check" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Unseen insights first; Start only has room for two. */
const NEW_SIGNALS = SIGNALS.filter((s) => s.isNew);
const START_SIGNALS = [...NEW_SIGNALS, ...SIGNALS.filter((s) => !s.isNew)].slice(0, 2);

function SignalsCard({ initiatives, actions }: { initiatives: Initiative[]; actions: StartActions }) {
  return (
    <article className="kb2Card kb2Card--signals">
      <CardHeader eyebrow="New insights">
        <button type="button" className="kb2TextButton" onClick={() => actions.openInsights()}>
          View all <ArrowRight size={14} aria-hidden />
        </button>
      </CardHeader>
      <ul className="kb2SignalList">
        {START_SIGNALS.map((signal) => {
          const ref: ContextRef = { id: `signal:${signal.id}`, label: signal.title, kind: "signal" };
          const linked = initiatives.find((i) => i.id === signal.initiativeId);
          return (
            <li key={signal.id} className={`kb2Signal kb2Signal--${signal.tone}`}>
              <div className="kb2Signal__head">
                {signal.tone === "warning" ? <TrendingDown size={15} aria-hidden /> : <TrendingUp size={15} aria-hidden />}
                <DsTypography as="h3" variant="paragraph-small-bold">
                  <button type="button" className="kb2Signal__title" onClick={() => actions.openInsights(signal.id)}>
                    {signal.title}
                  </button>
                </DsTypography>
              </div>
              <DsTypography as="p" variant="paragraph-small" className="kb2Muted kb2Clamp3">
                {signal.body}
              </DsTypography>
              <div className="kb2Meta">
                <SourceStack ids={signal.sources} size={14} />
                <span className="kb2Muted kb2Small">{signal.found}</span>
              </div>
              <div className="kb2Signal__actions">
                {linked ? (
                  <button
                    type="button"
                    className="kb2TextButton"
                    onClick={() =>
                      linked.stage === "proposed" ? actions.startInitiative(linked.id) : actions.openCreate()
                    }
                  >
                    {linked.stage === "proposed" ? "Plan an initiative" : "View initiative"} <ArrowRight size={14} aria-hidden />
                  </button>
                ) : null}
                <AddToPromptButton compact onClick={() => actions.addContext(ref)} />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const WORK_ICONS: Record<WorkItem["kind"], typeof FileText> = {
  Brief: FileText,
  Prototype: Frame,
  Chat: MessageSquare,
  Research: NotebookText,
};

function RecentWorkCard({ actions }: { actions: StartActions }) {
  return (
    <article className="kb2Card kb2Card--work">
      <CardHeader eyebrow="Pick up where you left off" />
      <ul className="kb2WorkList">
        {RECENT_WORK.map((item) => {
          const Icon = WORK_ICONS[item.kind];
          return (
            <li key={item.id}>
              <button
                type="button"
                className="kb2WorkRow"
                onClick={() => (item.chatId ? actions.openChat(item.chatId) : actions.openCreate())}
              >
                <span className="kb2WorkRow__icon">
                  <Icon size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="kb2WorkRow__text">
                  <DsTypography as="span" variant="paragraph-small-medium" className="kb2Ellipsis">
                    {item.title}
                  </DsTypography>
                  <DsTypography as="span" variant="paragraph-mini" className="kb2Muted">
                    {item.status} · {item.updated}
                  </DsTypography>
                </span>
                <ArrowRight size={14} className="kb2WorkRow__arrow" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function AgentsCard({ actions }: { actions: StartActions }) {
  return (
    <article className="kb2Card kb2Card--agents">
      <CardHeader eyebrow="Agents">
        <button type="button" className="kb2TextButton" onClick={actions.openAgents}>
          View all <ArrowRight size={14} aria-hidden />
        </button>
      </CardHeader>
      <AgentTimeline onOpenAgents={actions.openAgents} />
    </article>
  );
}

/** The agents' recent and upcoming runs, newest first. Shared with the Agents page. */
export function AgentTimeline({ onOpenAgents, onOpenInitiative }: { onOpenAgents?: () => void; onOpenInitiative?: () => void }) {
  return (
    <ol className="kb2Timeline">
      {AGENT_RUNS.map((run) => {
        const agent = agentById(run.agentId);
        const content = (
          <>
            <span className={`kb2Timeline__dot kb2Timeline__dot--${run.state}`} aria-hidden />
            <span className="kb2Timeline__body">
              <span className="kb2Timeline__top">
                <DsTypography as="span" variant="paragraph-small-bold">
                  {agent.name}
                </DsTypography>
                <span className="kb2Muted kb2Small">
                  {run.state === "scheduled" ? <Clock size={12} aria-hidden /> : null}
                  {run.when}
                </span>
              </span>
              <DsTypography as="span" variant="paragraph-small" className="kb2Muted">
                {run.summary}
              </DsTypography>
              {run.state === "running" && run.progress !== undefined ? (
                <span
                  className="kb2Progress"
                  role="progressbar"
                  aria-valuenow={run.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${agent.name} progress`}
                >
                  <span style={{ width: `${run.progress}%` }} />
                </span>
              ) : null}
            </span>
          </>
        );
        const onClick = run.initiativeId && onOpenInitiative ? onOpenInitiative : onOpenAgents;
        return (
          <li key={run.id}>
            {onClick ? (
              <button type="button" className="kb2Timeline__item" onClick={onClick}>
                {content}
              </button>
            ) : (
              <div className="kb2Timeline__item">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function AddToPromptButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <Tip label="Add to prompt">
        <button type="button" className="kb2IconButton" onClick={onClick} aria-label="Add to prompt">
          <CirclePlus size={15} aria-hidden />
        </button>
      </Tip>
    );
  }
  return (
    <button type="button" className="kb2Button kb2Button--ghost" onClick={onClick}>
      <Plus size={14} aria-hidden />
      Add to prompt
    </button>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  return (
    <span className="kb2Confidence" title="How strongly the evidence supports this">
      <span className="kb2Confidence__bar" aria-hidden>
        <span style={{ width: `${value}%` }} />
      </span>
      <span className="kb2Small">{value}% confidence</span>
    </span>
  );
}

function TrendBadge({ metric }: { metric: Metric }) {
  const Icon = metric.trend === "up" ? TrendingUp : TrendingDown;
  return (
    <span className={`kb2TrendBadge kb2Trend--${metric.trend}`}>
      <Icon size={13} aria-hidden />
      {metric.delta} {metric.period}
    </span>
  );
}

/** Close a popover on outside click or Escape. */
export function useDismiss(open: boolean, rootRef: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef, close]);
}
