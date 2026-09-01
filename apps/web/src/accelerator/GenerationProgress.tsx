import { Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import type { StreamItem } from "./types";
import "./GenerationProgress.css";

export type GenerationProgressMode = "analysis" | "directions" | "qa";

/**
 * Step labels per phase. Progress is derived from real run signals the parent
 * observes (stream activity, write-tool events) — never a fabricated timer or
 * fake percentage.
 */
const PHASES: Record<GenerationProgressMode, { id: string; label: string }[]> = {
  analysis: [
    { id: "reading", label: "Reading your sources" },
    { id: "analyzing", label: "Analyzing the request" },
  ],
  directions: [
    { id: "preparing", label: "Reviewing your decisions" },
    { id: "writing", label: "Writing direction code" },
    { id: "describing", label: "Describing the directions" },
  ],
  qa: [
    { id: "mounting", label: "Mounting the component" },
    { id: "checking", label: "Running checks" },
  ],
};

const REASSURANCE_DELAY_MS = 12000;

export function GenerationProgress({
  mode,
  activeIndex,
  thinkingItem,
  processLine,
}: {
  mode: GenerationProgressMode;
  activeIndex: number;
  /** The model's latest real reasoning (thinking or assistant text) — the actual content, not a status pill. */
  thinkingItem?: StreamItem | null;
  /** The latest process tick (a tool call, a status update) — one quiet line, independent of thinkingItem so the two don't fight for the same slot. */
  processLine?: string;
}) {
  const steps = PHASES[mode];
  const clampedIndex = Math.max(0, Math.min(activeIndex, steps.length - 1));
  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    setShowReassurance(false);
    const timer = window.setTimeout(() => setShowReassurance(true), REASSURANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [clampedIndex, mode]);

  return (
    <div className="generationProgress" aria-live="polite">
      <ol className="generationProgress__list">
        {steps.map((step, index) => {
          const isDone = index < clampedIndex;
          const isCurrent = index === clampedIndex;
          return (
            <li
              key={step.id}
              className={[
                "generationProgress__step",
                isDone ? "generationProgress__step--done" : "",
                isCurrent ? "generationProgress__step--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="generationProgress__marker" aria-hidden>
                {isDone ? (
                  <Check size={11} strokeWidth={2.5} aria-hidden />
                ) : isCurrent ? (
                  <DsSpinner size={11} aria-hidden />
                ) : null}
              </span>
              <DsTypography as="span" variant="paragraph-small">
                {step.label}
              </DsTypography>
            </li>
          );
        })}
      </ol>

      {thinkingItem?.text.trim() ? (
        <div className="generationProgress__thinking">
          <span className="generationProgress__thinkingEyebrow">
            <Sparkles size={11} aria-hidden />
            Reasoning
          </span>
          <DsTypography as="p" variant="paragraph-small" className="generationProgress__thinkingText">
            {thinkingItem.text}
          </DsTypography>
        </div>
      ) : null}

      {processLine?.trim() ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="generationProgress__activity">
          {processLine}
        </DsTypography>
      ) : null}

      {showReassurance ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="generationProgress__reassurance">
          Still working — larger requests can take a bit longer.
        </DsTypography>
      ) : null}
    </div>
  );
}
