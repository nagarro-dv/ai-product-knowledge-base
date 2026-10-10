import { ChevronDown, Info } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeAnchoredPosition, type PopoverPosition } from "../accelerator/popoverPosition";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceStack } from "./Composer";
import { keyResult, type Initiative } from "./data";
import { IMPACT_LABELS, riceEquation, riceFor } from "./rice";

const fmt = (n: number) => n.toLocaleString("en-GB");

/**
 * "RICE 767 · High confidence" — and, on click, exactly how that number was
 * reached: the equation with the real values, and the reasoning and evidence
 * behind each factor, so anyone can check it and argue for it.
 */
export function RiceScore({ initiative, size = "md" }: { initiative: Initiative; size?: "md" | "sm" }) {
  const rice = riceFor(initiative);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className={`kb2Rice kb2Rice--${size}`}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        title="How this is scored"
      >
        <span className="kb2Rice__score">RICE {fmt(rice.score)}</span>
        {size === "md" ? <span className="kb2Rice__confidence">{rice.confidence.label} confidence</span> : null}
        <ChevronDown size={13} aria-hidden />
      </button>
      {anchor ? <RiceBreakdown initiative={initiative} anchor={anchor} onClose={() => setAnchor(null)} /> : null}
    </>
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
        <span className="kb2RiceBreakdown__formula">Reach × Impact × Confidence ÷ Effort</span>
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

      <footer className="kb2RiceBreakdown__foot">Same fields as Jira Product Discovery's RICE score.</footer>
    </div>,
    document.body,
  );
}
