import { DsProgressArc, type DsProgressArcVariant } from "./ProgressArc";

import "./ProgressArcShowcase.css";

const VARIANTS: DsProgressArcVariant[] = ["default", "success", "warning", "error", "accent"];

/** Playground for **Progress Arc** (Figma **XLKRFXYtGQPPHD9cq4JNn8 / 3851:47112**). */
export function ProgressArcShowcase() {
  return (
    <div className="progress-arc-showcase" aria-label="Progress Arc playground">
      <p className="progress-arc-showcase__lead">
        Figma <strong>Progress Arc</strong> (<span className="progress-arc-showcase__mono">3851:47112</span>) —{" "}
        <span className="progress-arc-showcase__mono">DsProgressArc</span> uses a SVG semicircular gauge.{" "}
        <span className="progress-arc-showcase__mono">value</span> is 0–100 (percent).
        Labels at each end default to <span className="progress-arc-showcase__mono">"0"</span> /{" "}
        <span className="progress-arc-showcase__mono">"999"</span>.
      </p>

      <section className="progress-arc-showcase__section" aria-labelledby="pa-variants-heading">
        <h3 id="pa-variants-heading" className="progress-arc-showcase__title">
          All variants (75%)
        </h3>
        <ul className="progress-arc-showcase__list">
          {VARIANTS.map((v) => (
            <li key={v} className="progress-arc-showcase__item">
              <div className="progress-arc-showcase__panel">
                <DsProgressArc variant={v} value={75} aria-label={`${v} progress`} />
              </div>
              <p className="progress-arc-showcase__variant-name">{v}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="progress-arc-showcase__section" aria-labelledby="pa-values-heading">
        <h3 id="pa-values-heading" className="progress-arc-showcase__title">
          Different fill levels (default)
        </h3>
        <ul className="progress-arc-showcase__list progress-arc-showcase__list--row">
          {[0, 25, 50, 75, 100].map((v) => (
            <li key={v} className="progress-arc-showcase__item">
              <div className="progress-arc-showcase__panel progress-arc-showcase__panel--sm">
                <DsProgressArc variant="default" value={v} aria-label={`${v}% progress`} />
              </div>
              <p className="progress-arc-showcase__variant-name">{v}%</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
