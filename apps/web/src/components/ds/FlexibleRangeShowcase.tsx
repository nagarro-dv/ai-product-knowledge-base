import { useState } from "react";
import { DsFlexibleRange, type DsFlexibleRangeValue } from "./FlexibleRange";
import "./FlexibleRangeShowcase.css";

/**
 * FlexibleRangeShowcase — DS Playground panel for FlexibleRange (Figma 4138:59185).
 * Demonstrates the default state, a custom-labelled variant, and the disabled state.
 */
export function FlexibleRangeShowcase() {
  const [applied1, setApplied1] = useState<DsFlexibleRangeValue>([200, 350, 400]);
  const [applied2, setApplied2] = useState<DsFlexibleRangeValue>([100, 300, 600]);

  return (
    <div className="flex-range-showcase">
      <p className="flex-range-showcase__hint">
        Figma node{" "}
        <span className="flex-range-showcase__mono">4138:59185</span> ·{" "}
        Features file{" "}
        <span className="flex-range-showcase__mono">XLKRFXYtGQPPHD9cq4JNn8</span>.{" "}
        Uses <span className="flex-range-showcase__mono">DsSlider type=triple-range</span>{" "}
        (Min · Default · Max). Values update live on drag.
      </p>

      <div className="flex-range-showcase__grid">

        {/* ── Default (matches Figma exactly) ── */}
        <section className="flex-range-showcase__section">
          <h3 className="flex-range-showcase__section-title">Default — Monthly saving range</h3>
          <DsFlexibleRange
            recommended={[200, 350, 400]}
            min={0}
            max={600}
            step={10}
            onApply={setApplied1}
          />
          {applied1 && (
            <p className="flex-range-showcase__applied">
              Applied: €{applied1[0]} / €{applied1[1]} / €{applied1[2]}
            </p>
          )}
        </section>

        {/* ── Custom labels + wider range ── */}
        <section className="flex-range-showcase__section">
          <h3 className="flex-range-showcase__section-title">Custom — Investment allocation</h3>
          <DsFlexibleRange
            title="Monthly investment range"
            instruction="Set your conservative, target, and aggressive allocation amounts"
            columnLabels={["Floor", "Target", "Ceiling"]}
            recommended={[100, 300, 600]}
            min={50}
            max={1000}
            step={25}
            currency="€"
            onApply={setApplied2}
          />
          {applied2 && (
            <p className="flex-range-showcase__applied">
              Applied: €{applied2[0]} / €{applied2[1]} / €{applied2[2]}
            </p>
          )}
        </section>

        {/* ── Disabled state ── */}
        <section className="flex-range-showcase__section">
          <h3 className="flex-range-showcase__section-title">State=Disabled</h3>
          <DsFlexibleRange
            recommended={[200, 350, 400]}
            min={0}
            max={600}
            step={10}
            disabled
          />
        </section>

      </div>
    </div>
  );
}
