import { useState } from "react";
import { Info } from "lucide-react";

import { DsAccordion } from "./Accordion";
import "./AccordionShowcase.css";

const SAMPLE_CONTENT = (
  <p className="accordion-showcase-body">
    Our flagship product combines cutting-edge technology with sleek design. Built with premium
    materials, it offers unparalleled performance and reliability. Key features include advanced
    processing capabilities and an intuitive user interface designed for both beginners and experts.
  </p>
);

export function AccordionShowcase() {
  const [openIdx, setOpenIdx] = useState<number | null>(1);

  return (
    <div className="accordion-showcase" aria-label="Accordion variants">
      <p className="accordion-showcase-hint">
        Figma file <span className="accordion-showcase-mono">8Ry9Oa2niLBGvoWPo9rLQT</span>, node{" "}
        <span className="accordion-showcase-mono">3143:15292</span>. Axes: variant × size.
        Focus ring via <span className="accordion-showcase-mono">:focus-visible</span>.
      </p>

      {/* ── Contained · Regular ── */}
      <section className="accordion-showcase-section" aria-labelledby="acc-contained-regular">
        <h3 className="accordion-showcase-section-title" id="acc-contained-regular">
          Contained · Regular
        </h3>
        <div className="accordion-showcase-stack">
          <DsAccordion
            title="Accordion Item Title"
            subtitle="Line 2"
            icon={<Info size={16} />}
            variant="contained"
            size="regular"
            open={openIdx === 0}
            onOpenChange={() => setOpenIdx(openIdx === 0 ? null : 0)}
          >
            {SAMPLE_CONTENT}
          </DsAccordion>
          <DsAccordion
            title="Accordion Item Title"
            subtitle="Line 2"
            icon={<Info size={16} />}
            variant="contained"
            size="regular"
            open={openIdx === 1}
            onOpenChange={() => setOpenIdx(openIdx === 1 ? null : 1)}
          >
            {SAMPLE_CONTENT}
          </DsAccordion>
          <DsAccordion
            title="Accordion Item Title"
            subtitle="Line 2"
            icon={<Info size={16} />}
            variant="contained"
            size="regular"
            open={openIdx === 2}
            onOpenChange={() => setOpenIdx(openIdx === 2 ? null : 2)}
          >
            {SAMPLE_CONTENT}
          </DsAccordion>
        </div>
      </section>

      {/* ── Contained · Small ── */}
      <section className="accordion-showcase-section" aria-labelledby="acc-contained-small">
        <h3 className="accordion-showcase-section-title" id="acc-contained-small">
          Contained · Small
        </h3>
        <div className="accordion-showcase-stack">
          <DsAccordion
            title="Accordion Item Title"
            subtitle="Line 2"
            variant="contained"
            size="small"
            defaultOpen
          >
            {SAMPLE_CONTENT}
          </DsAccordion>
          <DsAccordion title="Accordion Item Title" subtitle="Line 2" variant="contained" size="small">
            {SAMPLE_CONTENT}
          </DsAccordion>
        </div>
      </section>

      {/* ── Ghost · Regular ── */}
      <section className="accordion-showcase-section" aria-labelledby="acc-ghost-regular">
        <h3 className="accordion-showcase-section-title" id="acc-ghost-regular">
          Ghost · Regular
        </h3>
        <div className="accordion-showcase-stack accordion-showcase-stack--ghost">
          <DsAccordion
            title="Accordion Item Title"
            subtitle="Line 2"
            icon={<Info size={16} />}
            variant="ghost"
            size="regular"
            defaultOpen
          >
            {SAMPLE_CONTENT}
          </DsAccordion>
          <DsAccordion
            title="Accordion Item Title"
            subtitle="Line 2"
            icon={<Info size={16} />}
            variant="ghost"
            size="regular"
          >
            {SAMPLE_CONTENT}
          </DsAccordion>
        </div>
      </section>

      {/* ── Ghost · Small ── */}
      <section className="accordion-showcase-section" aria-labelledby="acc-ghost-small">
        <h3 className="accordion-showcase-section-title" id="acc-ghost-small">
          Ghost · Small
        </h3>
        <div className="accordion-showcase-stack accordion-showcase-stack--ghost">
          <DsAccordion title="Accordion Item Title" subtitle="Line 2" variant="ghost" size="small" defaultOpen>
            {SAMPLE_CONTENT}
          </DsAccordion>
          <DsAccordion title="Accordion Item Title" subtitle="Line 2" variant="ghost" size="small">
            {SAMPLE_CONTENT}
          </DsAccordion>
        </div>
      </section>

      {/* ── No icon / no subtitle ── */}
      <section className="accordion-showcase-section" aria-labelledby="acc-minimal">
        <h3 className="accordion-showcase-section-title" id="acc-minimal">
          No icon · No subtitle
        </h3>
        <div className="accordion-showcase-stack">
          <DsAccordion title="Accordion Item Title" variant="contained" size="regular" defaultOpen>
            {SAMPLE_CONTENT}
          </DsAccordion>
          <DsAccordion title="Accordion Item Title" variant="contained" size="regular">
            {SAMPLE_CONTENT}
          </DsAccordion>
        </div>
      </section>
    </div>
  );
}
