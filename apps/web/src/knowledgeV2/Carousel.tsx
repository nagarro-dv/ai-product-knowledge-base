import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tip } from "./Tip";

/**
 * A horizontally scrolling row that bleeds past the content column to the
 * edges of the main area (never under the sidebar). At rest the first item
 * lines up with the content above it. Edges that hide items fade out, and the
 * ← → buttons page through for mice without horizontal scrolling.
 */
export function Carousel({ label, header, children }: { label: string; header: ReactNode; children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({ start: track.scrollLeft > 1, end: track.scrollLeft < max - 1 });
  }, []);

  // How far the track reaches past the content column on each side: out to
  // the scrolling main area's edges. Measured rather than done with container
  // query units, which would need container-type on .kb2Main — and that
  // breaks every position: fixed popover inside it.
  const measureBleed = useCallback(() => {
    const track = trackRef.current;
    const column = track?.parentElement;
    const main = track?.closest<HTMLElement>(".kb2Main");
    if (!track || !column || !main) return;
    const bleed = Math.max(0, (main.clientWidth - column.clientWidth) / 2);
    track.style.setProperty("--kb2-bleed", `${bleed}px`);
  }, []);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const column = track?.parentElement;
    const main = track?.closest<HTMLElement>(".kb2Main");
    if (!track) return;
    measureBleed();
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(() => {
      measureBleed();
      update();
    });
    observer.observe(track);
    if (column) observer.observe(column);
    if (main) observer.observe(main);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [measureBleed, update]);

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.6, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <div className="kb2Carousel">
      <div className="kb2Section__head">
        {header}
        <div className="kb2Carousel__controls">
          <Tip label="Scroll left">
            <button type="button" className="kb2IconButton" aria-label="Scroll left" disabled={!edges.start} onClick={() => page(-1)}>
              <ChevronLeft size={15} aria-hidden />
            </button>
          </Tip>
          <Tip label="Scroll right">
            <button type="button" className="kb2IconButton" aria-label="Scroll right" disabled={!edges.end} onClick={() => page(1)}>
              <ChevronRight size={15} aria-hidden />
            </button>
          </Tip>
        </div>
      </div>
      <div
        ref={trackRef}
        className="kb2Carousel__track"
        role="region"
        aria-label={label}
        tabIndex={0}
        data-fade-start={edges.start}
        data-fade-end={edges.end}
      >
        {children}
      </div>
    </div>
  );
}
