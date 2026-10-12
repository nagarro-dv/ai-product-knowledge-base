import { ArrowLeft, ArrowRight, Lightbulb, Plus, Sparkles, TrendingDown, TrendingUp, Radar } from "lucide-react";
import { useState } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { sourceById } from "../knowledge/sources";
import { SourceStack, Sparkline } from "./Composer";
import { SIGNALS, SIGNAL_TONES, STAGES, agentById, type ContextRef, type Initiative, type Signal } from "./data";
import { RiceScore } from "./RiceScore";
import { JpdStatus, ShareActions } from "./ShareMenu";
import { shareSignal } from "./sharing";

export type InsightActions = {
  addContext: (ref: ContextRef) => void;
  explore: (prompt: string, ref: ContextRef) => void;
  startInitiative: (id: string) => void;
  openCreate: () => void;
  /** Open an initiative's full details in the right-hand drawer. */
  openInitiative: (id: string) => void;
};

function ToneIcon({ tone }: { tone: Signal["tone"] }) {
  if (tone === "warning") return <TrendingDown size={15} aria-hidden />;
  if (tone === "positive") return <TrendingUp size={15} aria-hidden />;
  return <Radar size={15} aria-hidden />;
}

const toneLabel = (tone: Signal["tone"]) => SIGNAL_TONES.find((t) => t.id === tone)!.label;

/**
 * Every insight the agents have reported, not just the newest two on Start.
 * A filterable list on the left; the selected insight's full story on the
 * right — what was found, the evidence by source, the metric it moves, and
 * the initiative it led to.
 */
export function InsightsPage({
  initiatives,
  selectedId,
  onSelect,
  onBack,
  actions,
}: {
  initiatives: Initiative[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  actions: InsightActions;
}) {
  const [filter, setFilter] = useState<Signal["tone"] | "all">("all");
  const visible = filter === "all" ? SIGNALS : SIGNALS.filter((s) => s.tone === filter);
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0];

  return (
    <div className="kb2Insights">
      <button type="button" className="kb2TextButton kb2Back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden /> Start
      </button>
      <header className="kb2PageHeader">
        <div>
          <DsTypography as="h1" variant="heading-4" className="kb2PageHeader__title">
            Insights
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small" className="kb2PageHeader__subtitle">
            What your agents have noticed across your connected sources. Pick one to see the evidence behind it.
          </DsTypography>
        </div>
      </header>

      <div className="kb2ChipRow" role="group" aria-label="Filter insights">
        {[{ id: "all" as const, label: "All" }, ...SIGNAL_TONES].map((option) => {
          const count = option.id === "all" ? SIGNALS.length : SIGNALS.filter((s) => s.tone === option.id).length;
          return (
            <button
              key={option.id}
              type="button"
              className="kb2Chip kb2FilterChip"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              <DsTypography as="span" variant="paragraph-small-medium">
                {option.label}
              </DsTypography>
              <span className="kb2Count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="kb2InsightsLayout">
        <ul className="kb2InsightList" aria-label="Insights">
          {visible.map((signal) => (
            <li key={signal.id}>
              <button
                type="button"
                className={`kb2InsightRow kb2Signal--${signal.tone}`}
                aria-pressed={signal.id === selected?.id}
                onClick={() => onSelect(signal.id)}
              >
                <span className="kb2Signal__head">
                  <ToneIcon tone={signal.tone} />
                  <DsTypography as="span" variant="paragraph-small-bold">
                    {signal.title}
                  </DsTypography>
                  {signal.isNew ? <span className="kb2Tag kb2Tag--new">New</span> : null}
                </span>
                <DsTypography as="span" variant="paragraph-small" className="kb2Muted kb2Clamp2">
                  {signal.body}
                </DsTypography>
                <span className="kb2Meta">
                  <SourceStack ids={signal.sources} size={13} />
                  <span className="kb2Muted kb2Small">
                    {signal.category} · {signal.found.replace(/^Found /, "")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <InsightDetail key={selected.id} signal={selected} initiatives={initiatives} actions={actions} />
        ) : null}
      </div>
    </div>
  );
}

function InsightDetail({ signal, initiatives, actions }: { signal: Signal; initiatives: Initiative[]; actions: InsightActions }) {
  const ref: ContextRef = { id: `signal:${signal.id}`, label: signal.title, kind: "signal" };
  const agent = agentById(signal.agentId);
  const linked = initiatives.find((i) => i.id === signal.initiativeId);
  const stage = linked ? STAGES.find((s) => s.id === linked.stage) : undefined;

  return (
    <article className="kb2Card kb2InsightDetail" aria-labelledby="kb2-insight-title">
      <div className="kb2InsightDetail__top">
        <span className={`kb2ToneBadge kb2ToneBadge--${signal.tone}`}>
          <ToneIcon tone={signal.tone} />
          {toneLabel(signal.tone)}
        </span>
        <span className="kb2Muted kb2Small">{signal.category}</span>
      </div>
      <DsTypography as="h2" id="kb2-insight-title" variant="heading-5" className="kb2InsightDetail__title">
        {signal.title}
      </DsTypography>
      <p className="kb2InsightDetail__by">
        <Sparkles size={13} aria-hidden />
        {agent.name} agent · {signal.found}
      </p>
      <DsTypography as="p" variant="paragraph-small" className="kb2InsightDetail__text">
        {signal.detail}
      </DsTypography>

      {signal.impact ? (
        <section className="kb2InsightImpact" aria-label="Metric affected">
          <div>
            <span className="kb2Muted kb2Small">{signal.impact.label}</span>
            <span className="kb2InsightImpact__value">{signal.impact.value}</span>
            <span className={`kb2TrendBadge kb2Trend--${signal.impact.trend}`}>
              {signal.impact.trend === "up" ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
              {signal.impact.delta}
            </span>
          </div>
          <span className={`kb2Trend--${signal.impact.trend}`}>
            <Sparkline series={signal.impact.series} width={160} height={52} />
          </span>
        </section>
      ) : null}

      <section aria-labelledby="kb2-evidence-title" className="kb2InsightSection">
        <span id="kb2-evidence-title" className="kb2Eyebrow">
          Evidence
        </span>
        <ul className="kb2EvidenceList">
          {signal.evidence.map((item, index) => (
            <li key={index}>
              <span className="kb2EvidenceList__logo">
                <SourceMark source={sourceById(item.source)} size={14} />
              </span>
              <span>
                <span className="kb2EvidenceList__source">{sourceById(item.source).label}</span>
                {item.summary}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {linked ? (
        <section aria-labelledby="kb2-linked-title" className="kb2InsightSection">
          <span id="kb2-linked-title" className="kb2Eyebrow">
            Initiative
          </span>
          <div className="kb2LinkedInitiative">
            <span className="kb2LinkedInitiative__icon">
              <Lightbulb size={16} aria-hidden />
            </span>
            <span className="kb2LinkedInitiative__text">
              <DsTypography as="span" variant="paragraph-small-bold">
                {linked.title}
              </DsTypography>
              <span className="kb2Muted kb2Small">
                {stage?.label} · {linked.theme}
              </span>
              <span className="kb2Meta kb2LinkedInitiative__score">
                <RiceScore initiative={linked} />
                <JpdStatus sentKey={linked.jpdKey} />
              </span>
            </span>
            <button type="button" className="kb2Button kb2Button--small" onClick={() => actions.openInitiative(linked.id)}>
              View initiative <ArrowRight size={13} aria-hidden />
            </button>
          </div>
        </section>
      ) : null}

      <div className="kb2Card__actions">
        <button
          type="button"
          className="kb2Button kb2Button--primary"
          onClick={() => actions.explore(`Dig deeper into “${signal.title}”: what's driving it, who is affected most, and what should we do next?`, ref)}
        >
          Learn more
        </button>
        <button type="button" className="kb2Button kb2Button--ghost" onClick={() => actions.addContext(ref)}>
          <Plus size={14} aria-hidden />
          Add to prompt
        </button>
        <span className="kb2Card__actionsEnd">
          <ShareActions item={shareSignal(signal)} />
        </span>
      </div>
    </article>
  );
}
