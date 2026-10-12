import { Info } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeAnchoredPosition, type PopoverPosition } from "../accelerator/popoverPosition";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceStack } from "./Composer";
import { keyResult, type Initiative } from "./data";
import { RollAlways, RollingNumber } from "./RollingNumber";
import { IMPACT_LABELS, RICE_MIDPOINT, impactBand, riceEquation, riceFor } from "./rice";

const fmt = (n: number) => n.toLocaleString("en-GB");

/**
 * "Impact score 82 ⓘ" — a 0–100 score anyone can read, tinted with its band,
 * worked out from RICE (rice.ts). The ⓘ opens exactly how it was reached: the
 * RICE equation with the real values, and the reasoning and evidence behind
 * each factor, so anyone can check it and argue for it.
 */
export function RiceScore({ initiative, size = "md" }: { initiative: Initiative; size?: "md" | "sm" }) {
  const rice = riceFor(initiative);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className={`kb2Rice kb2Rice--${size} kb2Rice--${impactBand(rice.impactScore)}`}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-label={`Impact score ${rice.impactScore} out of 100, ${rice.confidence.label.toLowerCase()} confidence. How this is scored`}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        <span className="kb2Rice__label">{size === "md" ? "Impact score" : "Impact"}</span>
        <ImpactBadge score={rice.impactScore} />
        <Info size={13} aria-hidden className="kb2Rice__info" />
      </button>
      {anchor ? <RiceBreakdown initiative={initiative} anchor={anchor} onClose={() => setAnchor(null)} /> : null}
    </>
  );
}

/**
 * The 0–100 impact score in Jira Product Discovery's colours (green 80+,
 * yellow 50–79, grey below 50). Its digits roll into place when it appears or
 * changes, to show it's a live number (RollingNumber).
 */
export function ImpactBadge({ score }: { score: number }) {
  return (
    <span className={`kb2ImpactBadge kb2ImpactBadge--${impactBand(score)}`}>
      <RollingNumber value={score} />
    </span>
  );
}

function RiceBreakdown({ initiative, anchor, onClose }: { initiative: Initiative; anchor: HTMLElement; onClose: () => void }) {
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const rice = riceFor(initiative);
  const kr = keyResult(initiative.rice.okr);

  useLayoutEffect(() => setPosition(computeAnchoredPosition(anchor, 520)), [anchor]);
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  if (!position) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`How ${initiative.title} is scored`}
      className="kb2RiceBreakdown"
      data-placement={position.placement}
      style={{ top: position.top, bottom: position.bottom, left: position.left, maxHeight: position.maxHeight }}
    >
      <header className="kb2RiceBreakdown__head">
        <DsTypography as="h3" variant="paragraph-small-bold">
          How this is scored
        </DsTypography>
        <p className="kb2RiceBreakdown__impact">
          <span>
            {/* Rolls every time the popover opens, even on a page whose scores have already rolled. */}
            Impact score{" "}
            <RollAlways>
              <ImpactBadge score={rice.impactScore} />
            </RollAlways>{" "}
            / 100
          </span>
          <span className="kb2Muted">
            RICE {fmt(rice.score)} ÷ ({fmt(rice.score)} + {RICE_MIDPOINT}) × 100
          </span>
        </p>
        <span className="kb2RiceBreakdown__formula">RICE = Reach × Impact × Confidence ÷ Effort</span>
        <span className="kb2RiceBreakdown__equation">{riceEquation(initiative)}</span>
      </header>

      <dl className="kb2RiceBreakdown__factors">
        <div>
          <dt>
            Reach <strong>{fmt(rice.reach)}</strong>
          </dt>
          <dd>
            {initiative.rice.reachUnit} — {initiative.rice.reachNote}
          </dd>
        </div>
        <div>
          <dt>
            Impact <strong>{rice.impact}</strong> <span className="kb2Muted">· {IMPACT_LABELS[initiative.rice.impact]}</span>
          </dt>
          <dd>
            {kr ? (
              <span className="kb2RiceBreakdown__okr">
                {kr.id} · {kr.text}
              </span>
            ) : null}
            {initiative.rice.impactNote}
          </dd>
        </div>
        <div>
          <dt>
            Confidence <strong>{rice.confidence.percent}%</strong> <span className="kb2Muted">· {rice.confidence.label}</span>
          </dt>
          <dd>
            <span className="kb2RiceBreakdown__evidence">
              <SourceStack ids={[...new Set(initiative.evidence.map((e) => e.source))]} size={12} />
              {rice.confidence.reason}
            </span>
            <span className="kb2RiceBreakdown__rule">
              <Info size={12} aria-hidden />
              High = 4+ sources with data and research · Medium = 2+ sources · Low = 1
            </span>
          </dd>
        </div>
        <div>
          <dt>
            Effort <strong>{rice.effort}</strong> <span className="kb2Muted">person-weeks</span>
          </dt>
          <dd>{initiative.rice.effortNote}</dd>
        </div>
      </dl>

    </div>,
    document.body,
  );
}
