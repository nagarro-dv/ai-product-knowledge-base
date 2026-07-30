import { Check, Maximize2, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DsAccordion } from "../components/ds/Accordion";
import { DsButton } from "../components/ds/Button";
import { DsIconButton } from "../components/ds/IconButton";
import { DsTypography } from "../components/ds/DsTypography";
import { DirectionPreviewFrame } from "./DirectionPreviewFrame";
import { ResponsivePreviewStage } from "./ResponsivePreviewStage";
import type { ResponsiveViewport } from "./responsiveViewport";
import type { Direction } from "./types";
import "./DirectionCard.css";

const COMPLEXITY_LABEL: Record<Direction["complexity"], string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

/**
 * A direction rendered as a product proposal, not a report: identity chips
 * up top, the live preview dominating, one meta line, and every paragraph of
 * prose behind a single Details disclosure. Comparison should happen with the
 * eyes, not by reading.
 */
export function DirectionCard({
  direction,
  index,
  soloDirection = false,
  chosen,
  onChoose,
  viewport,
  onResizeWidth,
  onPreviewStatusChange,
}: {
  direction: Direction;
  /** Position in the comparison grid — drives the "Direction A/B/C" eyebrow. */
  index: number;
  /** True when this is the only direction in the run — nothing to compare, so the "Direction A" label is dropped and the star badge shows regardless of the model's own `recommended` flag (by definition, the sole option is the recommended one). */
  soloDirection?: boolean;
  chosen: boolean;
  onChoose: () => void;
  viewport: ResponsiveViewport;
  onResizeWidth: (width: number) => void;
  /** Reports the preview iframe's real ready/failed state back up so app state stops permanently reading "pending". */
  onPreviewStatusChange?: (directionId: string, status: "ready" | "failed", message?: string) => void;
}) {
  // Old runs restored from history/sessionStorage predate the highlights field.
  const highlights = direction.highlights ?? [];
  const hasDetails =
    direction.reasoning.trim().length > 0 ||
    direction.tradeoffs.length > 0 ||
    direction.responsiveNotes.trim().length > 0 ||
    direction.affectedFiles.length > 0;
  const letter = String.fromCharCode(65 + index);

  // A card-sized preview can't make a convincing case either way — testing a
  // direction at something closer to real size, decoupled from having to
  // commit to it right there, is what actually lets someone judge it.
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // The inline card and the "Try it larger" modal each mount their own
  // DirectionPreviewFrame/iframe, so each needs its own measured content
  // size — the stage uses this to size itself exactly to content instead of
  // a fixed height, which either stranded empty space or forced an internal
  // scrollbar depending on how tall the generated preview actually was.
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(null);
  const [expandMeasuredSize, setExpandMeasuredSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!previewExpanded) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewExpanded]);

  return (
    <article className={`directionCard${chosen ? " directionCard--chosen" : ""}`}>
      <header className="directionCard__header">
        <div className="directionCard__eyebrowRow">
          {soloDirection ? null : <span className="directionCard__eyebrow">Direction {letter}</span>}
          {direction.recommended || soloDirection ? (
            <span className="directionCard__star">
              <Star size={12} aria-hidden />
              Recommended
            </span>
          ) : null}
        </div>
        <DsTypography as="h3" variant="heading-4" className="directionCard__title">
          {direction.title}
        </DsTypography>
        {highlights.length > 0 ? (
          <ul className="directionCard__highlights" aria-label="Highlights">
            {highlights.map((chip) => (
              <li key={chip} className="directionCard__highlight">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="directionCard__preview">
        {direction.previewModulePath ? (
          <>
            <ResponsivePreviewStage
              viewport={viewport}
              onResizeWidth={onResizeWidth}
              label={`Resize "${direction.title}" preview width`}
              contentSize={measuredSize}
            >
              <DirectionPreviewFrame
                modulePath={direction.previewModulePath}
                onStatusChange={(status, message) => onPreviewStatusChange?.(direction.id, status, message)}
                onMeasured={setMeasuredSize}
              />
            </ResponsivePreviewStage>
            <button
              type="button"
              className="directionCard__expandButton"
              onClick={() => setPreviewExpanded(true)}
            >
              <Maximize2 size={12} aria-hidden />
              Try it larger
            </button>
          </>
        ) : (
          <div className="directionCard__noPreview">
            <DsTypography as="p" variant="paragraph-small">
              {direction.previewStatus === "unavailable"
                ? "No live preview for this direction — this engine proposes text only, not real code."
                : "Preview unavailable."}
            </DsTypography>
          </div>
        )}
      </div>

      <div className="directionCard__meta">
        <span className={`directionCard__complexity directionCard__complexity--${direction.complexity}`}>
          {COMPLEXITY_LABEL[direction.complexity]}
        </span>
        {direction.confidence > 0 ? (
          <span className="directionCard__metaItem">{Math.round(direction.confidence * 100)}% confidence</span>
        ) : null}
        {direction.affectedFiles.length > 0 ? (
          <span className="directionCard__metaItem">
            {direction.affectedFiles.length} {direction.affectedFiles.length === 1 ? "file" : "files"}
          </span>
        ) : null}
      </div>

      {direction.summary.trim() ? (
        <DsTypography as="p" variant="paragraph-small" className="directionCard__summary" title={direction.summary}>
          {direction.summary}
        </DsTypography>
      ) : null}

      {hasDetails ? (
        <DsAccordion variant="ghost" size="small" title="Details" defaultOpen={false}>
          <div className="directionCard__details">
            {direction.reasoning.trim() ? (
              <div>
                <DsTypography as="p" variant="paragraph-mini-bold" className="directionCard__detailLabel">
                  Why this direction
                </DsTypography>
                <DsTypography as="p" variant="paragraph-small">
                  {direction.reasoning}
                </DsTypography>
              </div>
            ) : null}
            {direction.tradeoffs.length > 0 ? (
              <div>
                <DsTypography as="p" variant="paragraph-mini-bold" className="directionCard__detailLabel">
                  Trade-offs
                </DsTypography>
                <ul className="directionCard__list">
                  {direction.tradeoffs.map((tradeoff) => (
                    <li key={tradeoff}>
                      <DsTypography as="span" variant="paragraph-small">
                        {tradeoff}
                      </DsTypography>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {direction.responsiveNotes.trim() ? (
              <div>
                <DsTypography as="p" variant="paragraph-mini-bold" className="directionCard__detailLabel">
                  Responsive behaviour
                </DsTypography>
                <DsTypography as="p" variant="paragraph-small">
                  {direction.responsiveNotes}
                </DsTypography>
              </div>
            ) : null}
            {direction.affectedFiles.length > 0 ? (
              <div>
                <DsTypography as="p" variant="paragraph-mini-bold" className="directionCard__detailLabel">
                  Files this would change
                </DsTypography>
                <ul className="directionCard__list">
                  {direction.affectedFiles.map((file) => (
                    <li key={file}>
                      <code className="accelerator__markdownInlineCode">{file}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </DsAccordion>
      ) : null}

      <DsButton
        variant={chosen ? "primary" : "secondary"}
        size="small"
        className="directionCard__choose"
        aria-pressed={chosen}
        leftIcon={chosen ? <Check size={14} aria-hidden /> : undefined}
        onClick={onChoose}
      >
        {chosen ? "Chosen" : "Choose this direction"}
      </DsButton>

      {previewExpanded && direction.previewModulePath ? (
        <div
          className="directionCard__expandBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${direction.title} preview`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setPreviewExpanded(false);
          }}
        >
          <div className="directionCard__expandModal">
            <header className="directionCard__expandHeader">
              <div>
                {soloDirection ? null : <span className="directionCard__eyebrow">Direction {letter}</span>}
                <DsTypography as="h3" variant="heading-4">
                  {direction.title}
                </DsTypography>
              </div>
              <DsIconButton
                ref={closeButtonRef}
                variant="ghost"
                size="small"
                aria-label="Close preview"
                onClick={() => setPreviewExpanded(false)}
              >
                <X size={16} aria-hidden />
              </DsIconButton>
            </header>
            <div className="directionCard__expandStage">
              <ResponsivePreviewStage
                viewport={viewport}
                onResizeWidth={onResizeWidth}
                label={`Resize "${direction.title}" preview width`}
                contentSize={expandMeasuredSize}
              >
                <DirectionPreviewFrame
                  modulePath={direction.previewModulePath}
                  onStatusChange={(status, message) => onPreviewStatusChange?.(direction.id, status, message)}
                  onMeasured={setExpandMeasuredSize}
                />
              </ResponsivePreviewStage>
            </div>
            <footer className="directionCard__expandFooter">
              <DsButton
                variant={chosen ? "primary" : "secondary"}
                leftIcon={chosen ? <Check size={14} aria-hidden /> : undefined}
                onClick={() => {
                  onChoose();
                  setPreviewExpanded(false);
                }}
              >
                {chosen ? "Chosen" : "Choose this direction"}
              </DsButton>
            </footer>
          </div>
        </div>
      ) : null}
    </article>
  );
}
