import { ArrowLeft, ArrowRight, Check, ChevronRight, Goal, Info, Lightbulb, MessageSquareText, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { sourceById } from "../knowledge/sources";
import { drawerEscape, useDrawerSlide } from "./Artifacts";
import {
  CURRENT_QUARTER,
  OKRS,
  SIGNALS,
  STAGES,
  alignedKeyResults,
  type Initiative,
  type KeyResult,
  type KeyResultStatus,
} from "./data";
import { IMPACT_LABELS, RICE_MIDPOINT, riceEquation, riceFor } from "./rice";
import { ImpactBadge } from "./RiceScore";
import { JpdStatus, ShareActions, useShare } from "./ShareMenu";
import { shareInitiative } from "./sharing";
import { Tip } from "./Tip";
import "./InitiativeDrawer.css";

const fmt = (n: number) => n.toLocaleString("en-GB");

export type InitiativeDrawerActions = {
  /** Move it to the next pipeline stage. */
  advance: (id: string) => void;
  /** Continue in a chat: the prompt box pre-filled, with the initiative attached. */
  refine: (initiative: Initiative) => void;
  /** Put one source behind it into the prompt box, with a question about it. */
  askSource: (initiative: Initiative, sourceId: string) => void;
  openInsight: (id: string) => void;
  addNote: (id: string, text: string) => void;
};

/**
 * Everything about one initiative, in the wide right-hand drawer, read top
 * to bottom from what matters most: what it is and where it stands (title,
 * stage, impact score), then the goal and the OKRs it moves, why it's worth
 * doing, how the score breaks down, and the sources, insights and notes
 * behind it. "View all OKRs" swaps the drawer to the company's OKRs, this
 * quarter's and earlier ones. The footer moves it along the pipeline, into a
 * chat, or to Jira Product Discovery.
 */
export function InitiativeDrawer({
  initiativeId,
  initiatives,
  onClose,
  actions,
}: {
  initiativeId: string | null;
  initiatives: Initiative[];
  onClose: () => void;
  actions: InitiativeDrawerActions;
}) {
  const { shown, open } = useDrawerSlide(initiativeId);
  const [view, setView] = useState<"initiative" | "okrs">("initiative");
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const { openDialog } = useShare();

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Another initiative opens on its own details, at the top.
  useEffect(() => setView("initiative"), [shown]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [shown, view]);

  useEffect(() => {
    if (!initiativeId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (drawerEscape(event)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [initiativeId, onClose]);

  const initiative = shown ? initiatives.find((i) => i.id === shown) : undefined;
  if (!initiative) return null;

  const stage = STAGES.find((s) => s.id === initiative.stage)!;
  const share = shareInitiative(initiative);
  const okrs = view === "okrs";

  return (
    <>
      <div className="kb2DrawerScrim" data-open={open} onClick={onClose} aria-hidden />
      <aside
        className="kb2Drawer kb2Drawer--view kb2InitiativeDrawer"
        data-open={open}
        aria-label={okrs ? "Company OKRs" : initiative.title}
      >
        <header className="kb2Drawer__header">
          {okrs ? (
            <Tip label="Back to initiative">
              <button type="button" className="kb2IconButton" aria-label="Back to initiative" onClick={() => setView("initiative")}>
                <ArrowLeft size={16} aria-hidden />
              </button>
            </Tip>
          ) : null}
          <div className="kb2Drawer__heading">
            <span className="kb2Drawer__kind">
              {okrs ? <Goal size={13} aria-hidden /> : <Lightbulb size={13} aria-hidden />}
              {okrs ? "Company goals" : "Initiative"}
            </span>
            {okrs ? (
              <DsTypography as="h2" variant="paragraph-bold">
                OKRs
              </DsTypography>
            ) : null}
          </div>
          {okrs ? null : <ShareActions item={share} variant="icons" />}
          <Tip label="Close">
            <button ref={closeRef} type="button" className="kb2IconButton" aria-label="Close" onClick={onClose}>
              <X size={16} aria-hidden />
            </button>
          </Tip>
        </header>

        <div ref={bodyRef} className="kb2Drawer__body">
          {okrs ? (
            <div key="okrs" className="kb2Drawer__content kb2Initiative">
              <OkrsView initiative={initiative} initiatives={initiatives} />
            </div>
          ) : (
            <div key={initiative.id} className="kb2Drawer__content kb2Initiative">
              <Hero initiative={initiative} />
              <KeyFacts initiative={initiative} />
              <Alignment initiative={initiative} onViewAll={() => setView("okrs")} />
              <Value initiative={initiative} />
              <Breakdown initiative={initiative} />
              <Sources initiative={initiative} onAsk={(sourceId) => actions.askSource(initiative, sourceId)} />
              <RelatedInsights initiative={initiative} onOpen={actions.openInsight} />
              <Notes initiative={initiative} onAdd={(text) => actions.addNote(initiative.id, text)} />
            </div>
          )}
        </div>

        {okrs ? null : (
          <footer className="kb2InitiativeDrawer__footer">
            {stage.action ? (
              <button type="button" className="kb2Button kb2Button--primary" onClick={() => actions.advance(initiative.id)}>
                {stage.action} <ArrowRight size={14} aria-hidden />
              </button>
            ) : null}
            <button type="button" className="kb2Button" onClick={() => actions.refine(initiative)}>
              <MessageSquareText size={14} aria-hidden />
              Refine in chat
            </button>
            <span className="kb2InitiativeDrawer__footerEnd">
              {initiative.jpdKey ? (
                <JpdStatus sentKey={initiative.jpdKey} />
              ) : (
                <button type="button" className="kb2Button" onClick={() => openDialog(share, "jpd")}>
                  <SourceMark source={sourceById("jira")} size={14} />
                  Send to Product Discovery
                </button>
              )}
            </span>
          </footer>
        )}
      </aside>
    </>
  );
}

/** Title first, with its stage and area above it and the summary below. */
function Hero({ initiative }: { initiative: Initiative }) {
  const stage = STAGES.find((s) => s.id === initiative.stage)!;
  return (
    <section className="kb2Initiative__hero" aria-label="Overview">
      <div className="kb2Initiative__chips">
        <span className="kb2StageBadge" data-stage={initiative.stage}>
          <span className="kb2StageBadge__dot" aria-hidden />
          {stage.label}
        </span>
        <span className="kb2Tag">{initiative.theme}</span>
      </div>
      <h1 className="kb2Initiative__title">{initiative.title}</h1>
      <p className="kb2Initiative__summary">{initiative.summary}</p>
      <p className="kb2Initiative__byline">
        {initiative.origin === "You" ? null : <Sparkles size={13} aria-hidden />}
        Proposed by {initiative.origin}
        <span aria-hidden>·</span>
        Updated {initiative.updated.charAt(0).toLowerCase() + initiative.updated.slice(1)}
      </p>
    </section>
  );
}

/** The two things to know at a glance: how much it's worth, and how far along it is. */
function KeyFacts({ initiative }: { initiative: Initiative }) {
  const rice = riceFor(initiative);
  const current = STAGES.findIndex((s) => s.id === initiative.stage);
  const next = STAGES[current].action;
  return (
    <section className="kb2Initiative__keyFacts" aria-label="At a glance">
      <div className="kb2Initiative__fact">
        <span className="kb2Initiative__factLabel">
          Impact score
          <Tip
            side="right"
            rich
            label={
              <>
                <span>RICE = Reach × Impact × Confidence ÷ Effort</span>
                <strong>{riceEquation(initiative)}</strong>
                <span className="kb2Tooltip__muted">
                  Impact score = RICE ÷ (RICE + {RICE_MIDPOINT}) × 100 = {rice.impactScore}
                </span>
              </>
            }
          >
            <button type="button" className="kb2Initiative__info" aria-label="How the impact score is worked out">
              <Info size={14} aria-hidden />
            </button>
          </Tip>
        </span>
        <span className="kb2Initiative__score">
          <ImpactBadge score={rice.impactScore} />
          <span className="kb2Muted">/ 100</span>
        </span>
        <span className="kb2Muted kb2Small">{rice.confidence.label} confidence</span>
      </div>
      <div className="kb2Initiative__fact">
        <span className="kb2Initiative__factLabel">Stage</span>
        <span className="kb2Initiative__stageValue">
          {STAGES[current].label}
          <span className="kb2Muted">
            {" "}
            · {current + 1} of {STAGES.length}
          </span>
        </span>
        <ol className="kb2Initiative__stages" aria-label="Pipeline stages">
          {STAGES.map((s, index) => (
            <li
              key={s.id}
              title={s.label}
              data-state={index < current ? "done" : index === current ? "current" : "next"}
              aria-current={index === current ? "step" : undefined}
            >
              <span className="kb2VisuallyHidden">{s.label}</span>
            </li>
          ))}
        </ol>
        <span className="kb2Muted kb2Small">{next ? `Next: ${next.toLowerCase()}` : "Last stage"}</span>
      </div>
    </section>
  );
}

function Section({ id, title, children, aside }: { id: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="kb2Initiative__section" aria-labelledby={`kb2-initiative-${id}`}>
      <div className="kb2Initiative__sectionHead">
        <h3 id={`kb2-initiative-${id}`} className="kb2Initiative__sectionTitle">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const STATUS_LABELS: Record<KeyResultStatus, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
  met: "Met",
  missed: "Missed",
};

function StatusChip({ status }: { status: KeyResultStatus }) {
  return (
    <span className="kb2OkrStatus" data-status={status}>
      {status === "met" ? <Check size={12} aria-hidden /> : null}
      {STATUS_LABELS[status]}
    </span>
  );
}

/** One key result: what it is, where it stands against its target, and how that's going. */
function KeyResultRow({ kr, tag }: { kr: KeyResult; tag?: ReactNode }) {
  const pct = (n: number) => Math.min(100, Math.max(0, (n / kr.max) * 100));
  return (
    <div className="kb2KeyResult">
      <div className="kb2KeyResult__top">
        <span className="kb2KeyResult__id">{kr.id}</span>
        <span className="kb2KeyResult__text">{kr.text}</span>
        <StatusChip status={kr.status} />
      </div>
      <div className="kb2KeyResult__progress">
        {/* Fill = where it is now; the marker = the target, named on hover. */}
        <span className="kb2KeyResult__bar" data-status={kr.status}>
          <span className="kb2KeyResult__fill" style={{ width: `${pct(kr.value)}%` }} />
          <span className="kb2KeyResult__target" style={{ left: `${pct(kr.targetValue)}%` }}>
            <Tip label={`Target: ${kr.target}`}>
              <span className="kb2KeyResult__marker" tabIndex={0} role="img" aria-label={`Target: ${kr.target}`} />
            </Tip>
          </span>
        </span>
        <span className="kb2KeyResult__numbers" aria-label={`Now ${kr.current}`}>
          {kr.current}
        </span>
      </div>
      {tag ? <div className="kb2KeyResult__tags">{tag}</div> : null}
    </div>
  );
}

function Alignment({ initiative, onViewAll }: { initiative: Initiative; onViewAll: () => void }) {
  const krs = alignedKeyResults(initiative);
  return (
    <Section
      id="goal"
      title="Goal and OKRs"
      aside={
        <button type="button" className="kb2TextButton" onClick={onViewAll}>
          View all OKRs <ArrowRight size={14} aria-hidden />
        </button>
      }
    >
      <p className="kb2Initiative__goal">
        <span className="kb2Initiative__goalIcon">
          <Goal size={18} aria-hidden />
        </span>
        {initiative.goal}
      </p>
      <div className="kb2Initiative__krs">
        <span className="kb2Muted kb2Small">
          Moves {krs.length} key result{krs.length === 1 ? "" : "s"} this quarter ({CURRENT_QUARTER})
        </span>
        {krs.map((kr) => (
          <div key={kr.id} className="kb2Initiative__kr">
            <span className="kb2Muted kb2Small">{kr.objective}</span>
            <KeyResultRow kr={kr} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Value({ initiative }: { initiative: Initiative }) {
  return (
    <Section id="value" title="Why it's valuable">
      <ol className="kb2Initiative__value">
        {initiative.value.map((point, index) => (
          <li key={point}>
            <span className="kb2Initiative__valueNumber" aria-hidden>
              {index + 1}
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** How the impact score is made up, factor by factor, with the reasoning behind each. */
function Breakdown({ initiative }: { initiative: Initiative }) {
  const rice = riceFor(initiative);
  const factors = [
    { label: "Reach", value: fmt(rice.reach), unit: initiative.rice.reachUnit, note: initiative.rice.reachNote },
    { label: "Impact", value: String(rice.impact), unit: IMPACT_LABELS[initiative.rice.impact], note: initiative.rice.impactNote },
    { label: "Confidence", value: `${rice.confidence.percent}%`, unit: rice.confidence.label, note: rice.confidence.reason },
    { label: "Effort", value: String(rice.effort), unit: "person-weeks", note: initiative.rice.effortNote },
  ];
  return (
    <Section id="breakdown" title="How it scores">
      <dl className="kb2Initiative__factors">
        {factors.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>
              <span className="kb2Initiative__factorValue">
                <strong>{f.value}</strong> <span className="kb2Muted">{f.unit}</span>
              </span>
              <span className="kb2Initiative__factorNote">{f.note}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Sources({ initiative, onAsk }: { initiative: Initiative; onAsk: (sourceId: string) => void }) {
  return (
    <Section id="sources" title={`Sources (${initiative.evidence.length})`}>
      <ul className="kb2EvidenceList">
        {initiative.evidence.map((item, index) => {
          const source = sourceById(item.source);
          return (
            <li key={index} className="kb2Initiative__source">
              <span className="kb2EvidenceList__logo">
                <SourceMark source={source} size={14} />
              </span>
              <span className="kb2Initiative__sourceText">
                <span className="kb2EvidenceList__source">{source.label}</span>
                {item.summary}
              </span>
              <button
                type="button"
                className="kb2Button kb2Button--small kb2Button--ghost"
                aria-label={`Add ${source.label} to prompt`}
                onClick={() => onAsk(item.source)}
              >
                <Plus size={13} aria-hidden />
                Add to prompt
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** The company's OKRs: this quarter's with progress, earlier quarters' with how they ended. */
function OkrsView({ initiative, initiatives }: { initiative: Initiative; initiatives: Initiative[] }) {
  const quarters = [...new Set(OKRS.map((kr) => kr.quarter))];
  const mine = new Set(alignedKeyResults(initiative).map((kr) => kr.id));
  const supporting = (kr: KeyResult) => initiatives.filter((i) => alignedKeyResults(i).some((k) => k.id === kr.id)).length;

  return (
    <>
      <section className="kb2Initiative__hero" aria-label="About OKRs">
        <h1 className="kb2Initiative__title">Objectives and key results</h1>
        <p className="kb2Initiative__summary">
          What the company is working towards each quarter. Initiatives are scored against this quarter's key results.
        </p>
      </section>
      {quarters.map((quarter) => {
        const krs = OKRS.filter((kr) => kr.quarter === quarter);
        const current = quarter === CURRENT_QUARTER;
        const counts = krs.reduce<Partial<Record<KeyResultStatus, number>>>((acc, kr) => ({ ...acc, [kr.status]: (acc[kr.status] ?? 0) + 1 }), {});
        const objectives = [...new Set(krs.map((kr) => kr.objective))];
        return (
          <section key={quarter} className="kb2Initiative__section" aria-label={quarter}>
            <div className="kb2Initiative__sectionHead">
              <h3 className="kb2Initiative__sectionTitle">
                {quarter}
                <span className="kb2OkrQuarter" data-current={current}>
                  {current ? "Current quarter" : "Ended"}
                </span>
              </h3>
              <span className="kb2Muted kb2Small">
                {(Object.keys(STATUS_LABELS) as KeyResultStatus[])
                  .filter((status) => counts[status])
                  .map((status) => `${counts[status]} ${STATUS_LABELS[status].toLowerCase()}`)
                  .join(" · ")}
              </span>
            </div>
            {objectives.map((objective) => (
              <div key={objective} className="kb2Okr">
                <h4 className="kb2Okr__objective">{objective}</h4>
                {krs
                  .filter((kr) => kr.objective === objective)
                  .map((kr) => (
                    <KeyResultRow
                        key={kr.id}
                        kr={kr}
                        tag={
                          current ? (
                            <>
                              {mine.has(kr.id) ? <span className="kb2KeyResult__tag kb2KeyResult__tag--accent">This initiative</span> : null}
                              <span className="kb2Muted kb2Small">
                                {supporting(kr)} initiative{supporting(kr) === 1 ? "" : "s"} aligned
                              </span>
                            </>
                          ) : undefined
                        }
                      />
                  ))}
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}

function RelatedInsights({ initiative, onOpen }: { initiative: Initiative; onOpen: (id: string) => void }) {
  const related = SIGNALS.filter((s) => s.initiativeId === initiative.id);
  if (related.length === 0) return null;
  return (
    <Section id="insights" title="Insights behind it">
      <ul className="kb2Initiative__insights">
        {related.map((signal) => (
          <li key={signal.id}>
            <button type="button" className="kb2Initiative__insight" onClick={() => onOpen(signal.id)}>
              <span>
                <DsTypography as="span" variant="paragraph-small-bold">
                  {signal.title}
                </DsTypography>
                <span className="kb2Muted kb2Small">
                  {signal.category} · {signal.found}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Notes({ initiative, onAdd }: { initiative: Initiative; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const notes = initiative.notes ?? [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <Section id="notes" title={notes.length > 0 ? `Notes (${notes.length})` : "Notes"}>
      {notes.length > 0 ? (
        <ul className="kb2Initiative__notes">
          {notes.map((note) => (
            <li key={note.id}>
              <span>{note.text}</span>
              <span className="kb2Muted kb2Small">You · {note.added}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="kb2Initiative__noteForm" onSubmit={submit}>
        <textarea
          className="kb2Initiative__noteInput"
          rows={2}
          value={text}
          placeholder="Add context, open questions or decisions…"
          aria-label="Add a note"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit(event);
          }}
        />
        <button type="submit" className="kb2Button kb2Button--small" disabled={!text.trim()}>
          Add note
        </button>
      </form>
    </Section>
  );
}
