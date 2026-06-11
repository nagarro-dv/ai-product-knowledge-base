import { DsProgressLinear, type DsProgressLinearVariant } from "./ProgressLinear";

import "./ProgressLinearShowcase.css";

const VARIANTS: DsProgressLinearVariant[] = [
  "primary",
  "warning",
  "error",
  "success",
  "accent",
  "neutral",
];

/** Playground for **Progress Linear** (Figma **2053:3292**). */
export function ProgressLinearShowcase() {
  return (
    <div className="progress-linear-showcase" aria-label="Progress Linear playground">
      <p className="progress-linear-showcase__lead">
        Figma <strong>Progress Linear</strong> (<span className="progress-linear-showcase__mono">2053:3292</span>) —{" "}
        <span className="progress-linear-showcase__mono">DsProgressLinear</span> uses a normal <strong>value</strong>{" "}
        (0–100) for the fill width (no padding trick). Set <span className="progress-linear-showcase__mono">
          showLabel=false
        </span>{" "}
        for track-only; default matches Figma with label + numeric value.
      </p>

      <section className="progress-linear-showcase__section" aria-labelledby="pl-variants-heading">
        <h3 id="pl-variants-heading" className="progress-linear-showcase__title">
          All variants (labels on, 89%)
        </h3>
        <div className="progress-linear-showcase__panel">
          <ul className="progress-linear-showcase__list">
            {VARIANTS.map((v) => (
              <li key={v} className="progress-linear-showcase__item">
                <p className="progress-linear-showcase__variant-name">{v}</p>
                <DsProgressLinear id={`pl-showcase-${v}`} variant={v} value={89} label="Label" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="progress-linear-showcase__section" aria-labelledby="pl-nolabel-heading">
        <h3 id="pl-nolabel-heading" className="progress-linear-showcase__title">
          Without label row
        </h3>
        <p className="progress-linear-showcase__caption">
          Same tokens; pass an explicit <span className="progress-linear-showcase__mono">aria-label</span> on{" "}
          <span className="progress-linear-showcase__mono">DsProgressLinear</span> for the progressbar when the label
          row is hidden.
        </p>
        <div className="progress-linear-showcase__panel">
          <div className="progress-linear-showcase__row">
            <DsProgressLinear
              variant="accent"
              value={42}
              showLabel={false}
              aria-label="Upload progress"
              className="progress-linear-showcase__bar-wide"
            />
          </div>
        </div>
      </section>

      <section className="progress-linear-showcase__section" aria-labelledby="pl-custom-heading">
        <h3 id="pl-custom-heading" className="progress-linear-showcase__title">
          Custom value text
        </h3>
        <div className="progress-linear-showcase__panel">
          <DsProgressLinear variant="primary" value={33.333} valueLabel="33%" label="Completion" />
        </div>
      </section>
    </div>
  );
}
