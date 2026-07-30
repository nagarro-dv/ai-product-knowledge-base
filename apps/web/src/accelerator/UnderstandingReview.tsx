import { AlertTriangle, Check, Target } from "lucide-react";
import { forwardRef, useState } from "react";
import { DsAccordion } from "../components/ds/Accordion";
import { DsTypography } from "../components/ds/DsTypography";
import type { ChangeIntentType, UnderstandingBrief } from "./types";
import "./UnderstandingReview.css";

const CHANGE_TYPE_LABEL: Record<ChangeIntentType, string> = {
  "style-rule": "Style rule",
  "behavior-rule": "Behavior rule",
  "layout-rule": "Layout rule",
  "content-rule": "Content rule",
  unknown: "Change",
};

/** Strip markdown emphasis/code markers the model sneaks in — the dashboard renders captions, not markdown. */
function cleanInline(text: string): string {
  return text.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

/**
 * The one-sentence "what will happen" line. Always the plain-language
 * Summary field, never changeIntent.proposedRule — proposedRule is a
 * technical rule meant to feed code generation (it's shown separately,
 * verbatim, in the full-analysis disclosure below), not the first thing a
 * reader sees.
 */
function plannedOutcome(brief: UnderstandingBrief): string {
  const firstLine = brief.summary
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .find((line) => line.length > 0);
  return cleanInline(firstLine ?? "");
}

/**
 * Models love returning "DsBadge (apps/web/src/components/ds/Badge.tsx)" as
 * one string — a file path does not belong in a headline. Split it: the
 * component name is the title, the path is quiet monospace metadata.
 */
function splitTarget(target: string): { name: string; detail: string | null } {
  const parenMatch = target.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (parenMatch && parenMatch[1]!.trim()) return { name: parenMatch[1]!.trim(), detail: parenMatch[2]!.trim() };
  if (target.includes("/")) {
    const base = target.split("/").pop()!.replace(/\.\w+$/, "");
    return { name: base || target, detail: target };
  }
  return { name: target, detail: null };
}

/**
 * A component name is a handful of words (the prompt allows a short "New: X"
 * form, hence the colon stays fine). Despite the prompt's explicit
 * constraint, a model can still return a full explanatory sentence (e.g.
 * "None — new component; closest precedents: ProgressCircle.tsx, Slider.tsx")
 * — rendering that verbatim as a giant heading is a worse failure than just
 * falling back to the plain label the product already knows. A semicolon or
 * an em dash never belongs in a real component name; length is the backstop.
 */
function looksLikeSentence(target: string): boolean {
  return target.length > 60 || /;| — /.test(target);
}

/** Five-segment confidence meter with a plain-language label — visual first, never a bare number. */
function ConfidenceMeter({ value }: { value: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  const pct = Math.round(value * 100);
  const level = value >= 0.75 ? "High" : value >= 0.45 ? "Medium" : "Low";
  return (
    <span className="analysisDash__confidence" title={`Confidence ${pct}%`}>
      <span className="analysisDash__meter" role="img" aria-label={`Confidence ${pct}%`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`analysisDash__meterSeg${i < filled ? " analysisDash__meterSeg--on" : ""}`} />
        ))}
      </span>
      <span className="analysisDash__confidenceLabel">{level} confidence</span>
    </span>
  );
}

/**
 * Open questions resolve in place — a short inline answer, not a trip to a
 * chat composer. Each question tracks its own resolved/open state locally;
 * resolutions are reported up by question text so the parent can fold them
 * into the next "Generate directions" call without triggering a re-analysis.
 * Deliberately plain typography — a hairline divider between rows, no card,
 * no border, no count badge.
 */
function QuestionsSection({
  items,
  resolvedAnswers,
  onResolveQuestion,
}: {
  items: string[];
  resolvedAnswers: Record<string, string>;
  onResolveQuestion: (question: string, answer: string) => void;
}) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState("");

  if (items.length === 0) return null;

  const submit = (question: string) => {
    const trimmed = draftAnswer.trim();
    if (!trimmed) return;
    onResolveQuestion(question, trimmed);
    setOpenQuestion(null);
    setDraftAnswer("");
  };

  return (
    <section className="analysisDash__section" aria-label="Questions for you">
      <DsTypography as="h4" variant="paragraph-small-bold" className="analysisDash__sectionTitle">
        Questions for you
      </DsTypography>
      <ul className="analysisDash__questionList">
        {items.map((question) => {
          const answer = resolvedAnswers[question];
          const isOpen = openQuestion === question;
          return (
            <li key={question} className="analysisDash__questionItem">
              <div className="analysisDash__questionRow">
                <DsTypography as="span" variant="paragraph-small" className="analysisDash__questionText">
                  {cleanInline(question)}
                </DsTypography>
                {!answer ? (
                  <button
                    type="button"
                    className="analysisDash__itemAction"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpenQuestion(isOpen ? null : question);
                      setDraftAnswer("");
                    }}
                  >
                    {isOpen ? "Cancel" : "Answer"}
                  </button>
                ) : null}
              </div>
              {answer ? (
                <p className="analysisDash__resolved">
                  <Check size={12} aria-hidden />
                  <span>
                    Resolved: <span className="analysisDash__resolvedAnswer">{answer}</span>
                  </span>
                </p>
              ) : isOpen ? (
                <div className="analysisDash__resolver">
                  <input
                    type="text"
                    className="analysisDash__resolverInput"
                    value={draftAnswer}
                    onChange={(event) => setDraftAnswer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submit(question);
                    }}
                    placeholder="Type your answer…"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="analysisDash__resolverSubmit"
                    onClick={() => submit(question)}
                    disabled={!draftAnswer.trim()}
                  >
                    Resolve
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The analysis checkpoint as a decision brief, not a dashboard: understand
 * in 3 seconds, verify scope in 10, answer only what actually needs an
 * answer. Everything else — interpretation, assumptions, risks, sources,
 * raw text — lives one disclosure away. Hierarchy comes from typography and
 * spacing; nothing here is a coloured box.
 */
export const UnderstandingReview = forwardRef<
  HTMLHeadingElement,
  {
    brief: UnderstandingBrief;
    targetLabel: string;
    resolvedAnswers?: Record<string, string>;
    onResolveQuestion?: (question: string, answer: string) => void;
  }
>(function UnderstandingReview({ brief, targetLabel, resolvedAnswers = {}, onResolveQuestion }, headingRef) {
  const cleanedTarget = cleanInline(brief.changeIntent.targetComponent);
  const target =
    cleanedTarget && cleanedTarget !== "unknown" && !looksLikeSentence(cleanedTarget) ? cleanedTarget : targetLabel;
  const { name: targetName, detail: targetDetail } = splitTarget(target);
  const outcome = plannedOutcome(brief);
  const hasStructuredContent =
    brief.summary.trim().length > 0 || brief.inScope.length > 0 || brief.sourcesReviewed.length > 0;
  const inScope = brief.inScope.map(cleanInline).filter(Boolean);
  const outOfScope = brief.outOfScope.map(cleanInline).filter(Boolean);

  return (
    <section className="analysisDash" aria-label="What the AI understood">
      {!hasStructuredContent ? (
        <div className="analysisDash__unstructured" role="note">
          <AlertTriangle size={16} aria-hidden />
          <DsTypography as="p" variant="paragraph-small">
            The analysis didn't return a structured brief — read the full text below before continuing, or clarify the
            request and re-analyze.
          </DsTypography>
        </div>
      ) : null}

      <header className="analysisDash__verdict">
        <span className="analysisDash__targetIcon" aria-hidden>
          <Target size={18} />
        </span>
        <div className="analysisDash__verdictText">
          <div className="analysisDash__titleRow">
            <DsTypography as="h3" variant="heading-3" tabIndex={-1} ref={headingRef} className="analysisDash__target">
              {targetName}
            </DsTypography>
            {brief.changeIntent.changeType !== "unknown" ? (
              <span className="analysisDash__typeLabel">{CHANGE_TYPE_LABEL[brief.changeIntent.changeType]}</span>
            ) : null}
          </div>
          {targetDetail ? <code className="analysisDash__targetPath">{targetDetail}</code> : null}
          {brief.changeIntent.confidence > 0 ? <ConfidenceMeter value={brief.changeIntent.confidence} /> : null}
          {outcome ? (
            <DsTypography as="p" variant="paragraph-regular" className="analysisDash__outcome">
              {outcome}
            </DsTypography>
          ) : null}
        </div>
      </header>

      {inScope.length > 0 ? (
        <section className="analysisDash__section" aria-label="What will change">
          <DsTypography as="h4" variant="paragraph-small-bold" className="analysisDash__sectionTitle">
            What will change
          </DsTypography>
          <ul className="analysisDash__scopeList">
            {inScope.map((item) => (
              <li key={item} className="analysisDash__scopeItem">
                <Check size={13} aria-hidden />
                <DsTypography as="span" variant="paragraph-small">
                  {item}
                </DsTypography>
              </li>
            ))}
          </ul>
          {outOfScope.length > 0 ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="analysisDash__scopeOut">
              Won't touch: {outOfScope.join(" · ")}
            </DsTypography>
          ) : null}
        </section>
      ) : null}

      {onResolveQuestion ? (
        <QuestionsSection
          items={brief.openQuestions}
          resolvedAnswers={resolvedAnswers}
          onResolveQuestion={onResolveQuestion}
        />
      ) : null}

      <DsAccordion variant="ghost" size="small" title="View full analysis" defaultOpen={false}>
        <div className="analysisDash__full">
          {brief.interpretation.trim() ? (
            <div className="analysisDash__fullBlock">
              <DsTypography as="p" variant="paragraph-mini-bold" className="analysisDash__fullLabel">
                Why it read the request this way
              </DsTypography>
              <DsTypography as="p" variant="paragraph-small" className="analysisDash__fullProse">
                {brief.interpretation}
              </DsTypography>
            </div>
          ) : null}
          {brief.changeIntent.proposedRule.trim() && !/^describe the change/i.test(brief.changeIntent.proposedRule) ? (
            <div className="analysisDash__fullBlock">
              <DsTypography as="p" variant="paragraph-mini-bold" className="analysisDash__fullLabel">
                The exact rule it will follow
              </DsTypography>
              <DsTypography as="p" variant="paragraph-small" className="analysisDash__fullProse">
                {cleanInline(brief.changeIntent.proposedRule)}
              </DsTypography>
            </div>
          ) : null}
          {brief.risks.length > 0 ? (
            <div className="analysisDash__fullBlock">
              <DsTypography as="p" variant="paragraph-mini-bold" className="analysisDash__fullLabel">
                Worth noting
              </DsTypography>
              <ul className="analysisDash__fullList">
                {brief.risks.map((item) => (
                  <li key={item}>
                    <DsTypography as="span" variant="paragraph-small">
                      {cleanInline(item)}
                    </DsTypography>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {brief.assumptions.length > 0 ? (
            <div className="analysisDash__fullBlock">
              <DsTypography as="p" variant="paragraph-mini-bold" className="analysisDash__fullLabel">
                Assumptions it made
              </DsTypography>
              <ul className="analysisDash__fullList">
                {brief.assumptions.map((item) => (
                  <li key={item}>
                    <DsTypography as="span" variant="paragraph-small">
                      {cleanInline(item)}
                    </DsTypography>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {brief.sourcesReviewed.length > 0 ? (
            <div className="analysisDash__fullBlock">
              <DsTypography as="p" variant="paragraph-mini-bold" className="analysisDash__fullLabel">
                Sources it analysed
              </DsTypography>
              <ul className="analysisDash__fullList">
                {brief.sourcesReviewed.map((item) => (
                  <li key={item}>
                    <DsTypography as="span" variant="paragraph-small">
                      {cleanInline(item)}
                    </DsTypography>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="analysisDash__fullBlock">
            <DsTypography as="p" variant="paragraph-mini-bold" className="analysisDash__fullLabel">
              Full analysis text
            </DsTypography>
            <DsTypography as="p" variant="paragraph-small" className="analysisDash__raw">
              {brief.raw}
            </DsTypography>
          </div>
        </div>
      </DsAccordion>
    </section>
  );
});
