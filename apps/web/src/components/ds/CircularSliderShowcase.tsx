import { useState } from "react";
import { DsCircularSlider } from "./CircularSlider";
import "./CircularSliderShowcase.css";

/**
 * CircularSliderShowcase — DS Playground panel for CircularSlider.
 * Covers the primary use case (AI-suggestion confidence threshold), the
 * disabled state, the optional title/helperText field wrapper, and a
 * keyboard-focus reference — matching the layout SliderShowcase uses.
 */
export function CircularSliderShowcase() {
  const [confidence, setConfidence] = useState(75);
  const [compact, setCompact] = useState(40);
  const [withField, setWithField] = useState(60);

  return (
    <div className="circular-slider-showcase">
      <p className="circular-slider-showcase-hint">
        Drag the ring, or Tab to the handle and use Arrow / Home / End keys ·{" "}
        Whole-percent steps · Stops at 0/100 (no wrap) ·{" "}
        Tokens: <span className="circular-slider-showcase-mono">--ds-slider-*</span>,{" "}
        <span className="circular-slider-showcase-mono">--ds-progress-linear-*</span>
      </p>

      <div className="circular-slider-showcase-grid">
        {/* ── Primary use case ── */}
        <section className="circular-slider-showcase-section">
          <h3 className="circular-slider-showcase-section-title">AI suggestion confidence threshold</h3>

          <div className="circular-slider-showcase-row">
            <div className="circular-slider-showcase-cell">
              <span className="circular-slider-showcase-label">State=Regular</span>
              <DsCircularSlider
                value={confidence}
                onChange={setConfidence}
                aria-label="Minimum confidence to show AI suggestions"
              />
              <span className="circular-slider-showcase-value">
                Only show suggestions above {confidence}% confidence
              </span>
            </div>
          </div>
        </section>

        {/* ── Smaller size ── */}
        <section className="circular-slider-showcase-section">
          <h3 className="circular-slider-showcase-section-title">Compact size</h3>

          <div className="circular-slider-showcase-row">
            <div className="circular-slider-showcase-cell">
              <span className="circular-slider-showcase-label">size=96</span>
              <DsCircularSlider
                value={compact}
                onChange={setCompact}
                size={96}
                strokeWidth={10}
                aria-label="Compact confidence threshold"
              />
              <span className="circular-slider-showcase-value">{compact}%</span>
            </div>
          </div>
        </section>

        {/* ── Field wrapper (title + helperText) ── */}
        <section className="circular-slider-showcase-section">
          <h3 className="circular-slider-showcase-section-title">Field wrapper (title + helperText)</h3>

          <div className="circular-slider-showcase-row">
            <div className="circular-slider-showcase-cell">
              <DsCircularSlider
                title="Confidence threshold"
                helperText="Suggestions below this score are hidden"
                value={withField}
                onChange={setWithField}
                aria-label="Confidence threshold"
              />
            </div>
          </div>
        </section>

        {/* ── Disabled ── */}
        <section className="circular-slider-showcase-section">
          <h3 className="circular-slider-showcase-section-title">State=Disabled</h3>

          <div className="circular-slider-showcase-row">
            <div className="circular-slider-showcase-cell">
              <DsCircularSlider
                value={50}
                onChange={() => {}}
                disabled
                aria-label="Disabled confidence threshold"
              />
            </div>
          </div>
        </section>

        {/* ── Focus reference ── */}
        <section className="circular-slider-showcase-section">
          <h3 className="circular-slider-showcase-section-title">State=Focus (Tab to reach the handle)</h3>
          <p className="circular-slider-showcase-label" style={{ margin: 0 }}>
            Use Tab to focus the handle, then Arrow/Home/End keys to move it.
            Focus ring: 3px <span className="circular-slider-showcase-mono">--ds-general-shadows-focus-ring</span>.
          </p>

          <div className="circular-slider-showcase-row">
            <div className="circular-slider-showcase-cell">
              <DsCircularSlider value={50} onChange={() => {}} aria-label="Focus demo" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
