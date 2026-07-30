import { useState } from "react";
import { DsConfidenceSelector } from "./CircularConfidenceSelector";
import "./CircularConfidenceSelectorShowcase.css";

/**
 * CircularConfidenceSelectorShowcase — DS Playground panel for
 * DsConfidenceSelector (Centered Stat Dial direction). Mirrors
 * CircularSliderShowcase's layout so both live in the same visual grid.
 */
export function CircularConfidenceSelectorShowcase() {
  const [score, setScore] = useState(75);
  const [compact, setCompact] = useState(55);
  const [withField, setWithField] = useState(60);

  return (
    <div className="confidence-selector-showcase">
      <p className="confidence-selector-showcase-hint">
        Drag the ring, or Tab to the handle and use Arrow / Home / End keys ·{" "}
        Whole-percent steps · Stops at 0/100 (no wrap) ·{" "}
        Tokens: <span className="confidence-selector-showcase-mono">--ds-progress-linear-color-*</span>,{" "}
        <span className="confidence-selector-showcase-mono">--ds-slider-color-*</span>
      </p>

      <div className="confidence-selector-showcase-grid">
        {/* ── Primary use case ── */}
        <section className="confidence-selector-showcase-section">
          <h3 className="confidence-selector-showcase-section-title">AI answer confidence score</h3>

          <div className="confidence-selector-showcase-row">
            <div className="confidence-selector-showcase-cell">
              <DsConfidenceSelector
                value={score}
                onChange={setScore}
                title="Confidence score"
                helperText="How sure the model is about this answer"
                aria-label="Model confidence score"
              />
            </div>
          </div>
        </section>

        {/* ── Confidence bands ── */}
        <section className="confidence-selector-showcase-section">
          <h3 className="confidence-selector-showcase-section-title">Confidence bands</h3>

          <div className="confidence-selector-showcase-row confidence-selector-showcase-row--inline">
            <div className="confidence-selector-showcase-cell">
              <span className="confidence-selector-showcase-label">value=25 (Low)</span>
              <DsConfidenceSelector value={25} onChange={() => {}} size={120} aria-label="Low confidence example" />
            </div>
            <div className="confidence-selector-showcase-cell">
              <span className="confidence-selector-showcase-label">value=55 (Medium)</span>
              <DsConfidenceSelector
                value={compact}
                onChange={setCompact}
                size={120}
                aria-label="Medium confidence example"
              />
            </div>
            <div className="confidence-selector-showcase-cell">
              <span className="confidence-selector-showcase-label">value=85 (High)</span>
              <DsConfidenceSelector value={85} onChange={() => {}} size={120} aria-label="High confidence example" />
            </div>
          </div>
        </section>

        {/* ── Field wrapper (title + helperText) ── */}
        <section className="confidence-selector-showcase-section">
          <h3 className="confidence-selector-showcase-section-title">Field wrapper (title + helperText)</h3>

          <div className="confidence-selector-showcase-row">
            <div className="confidence-selector-showcase-cell">
              <DsConfidenceSelector
                title="Minimum confidence to auto-apply"
                helperText="Suggestions below this score need manual review"
                value={withField}
                onChange={setWithField}
                aria-label="Minimum confidence to auto-apply"
              />
            </div>
          </div>
        </section>

        {/* ── Disabled ── */}
        <section className="confidence-selector-showcase-section">
          <h3 className="confidence-selector-showcase-section-title">State=Disabled</h3>

          <div className="confidence-selector-showcase-row">
            <div className="confidence-selector-showcase-cell">
              <DsConfidenceSelector value={50} onChange={() => {}} disabled aria-label="Disabled confidence score" />
            </div>
          </div>
        </section>

        {/* ── Focus reference ── */}
        <section className="confidence-selector-showcase-section">
          <h3 className="confidence-selector-showcase-section-title">State=Focus (Tab to reach the handle)</h3>
          <p className="confidence-selector-showcase-label" style={{ margin: 0 }}>
            Use Tab to focus the handle, then Arrow/Home/End keys to move it.
            Focus ring: 3px <span className="confidence-selector-showcase-mono">--ds-general-shadows-focus-ring</span>.
          </p>

          <div className="confidence-selector-showcase-row">
            <div className="confidence-selector-showcase-cell">
              <DsConfidenceSelector value={50} onChange={() => {}} aria-label="Focus demo" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
