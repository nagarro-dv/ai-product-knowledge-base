import { useState } from "react";
import { DsSlider } from "./Slider";
import "./SliderShowcase.css";

/**
 * SliderShowcase — DS Playground panel for Slider (Figma 322:9793).
 * Covers all three Type variants, both Marker shapes, all States,
 * and the optional title/helperText field wrapper.
 */
export function SliderShowcase() {
  const [single, setSingle]         = useState(60);
  const [singleStep, setSingleStep] = useState(25);
  const [duoRange, setDuoRange]     = useState<[number, number]>([20, 75]);
  const [tripleRange, setTripleRange] = useState<[number, number, number]>([15, 50, 85]);
  const [withLabel, setWithLabel]   = useState(40);

  return (
    <div className="slider-showcase">
      <p className="slider-showcase-hint">
        Figma component set <span className="slider-showcase-mono">322:9793</span> (DS Starter Kit) ·{" "}
        Variants: <span className="slider-showcase-mono">Type=Default</span> ·{" "}
        <span className="slider-showcase-mono">Type=Duo Range</span> ·{" "}
        <span className="slider-showcase-mono">Type=Triple Range</span> ·{" "}
        Markers: <span className="slider-showcase-mono">Shape=Round</span> ·{" "}
        <span className="slider-showcase-mono">Shape=Diamond</span> ·{" "}
        States: Regular · Focus (Tab/arrows) · Disabled ·{" "}
        Tokens: <span className="slider-showcase-mono">--ds-slider-*</span>
      </p>

      <div className="slider-showcase-grid">

        {/* ── Type=Default ── */}
        <section className="slider-showcase-section">
          <h3 className="slider-showcase-section-title">Type=Default</h3>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">State=Regular</span>
              <DsSlider value={single} onChange={setSingle} aria-label="Default slider" />
              <span className="slider-showcase-value">{single}</span>
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">step=25</span>
              <DsSlider value={singleStep} onChange={setSingleStep} step={25} aria-label="Step 25 slider" />
              <span className="slider-showcase-value">{singleStep}</span>
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">State=Disabled</span>
              <DsSlider value={40} onChange={() => {}} disabled aria-label="Disabled slider" />
            </div>
          </div>
        </section>

        {/* ── Type=Duo Range ── */}
        <section className="slider-showcase-section">
          <h3 className="slider-showcase-section-title">Type=Duo Range</h3>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">State=Regular</span>
              <DsSlider
                type="duo-range"
                value={duoRange}
                onChange={setDuoRange}
                aria-label="Duo range slider"
              />
              <span className="slider-showcase-value">{duoRange[0]}–{duoRange[1]}</span>
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">State=Disabled</span>
              <DsSlider
                type="duo-range"
                value={[30, 70]}
                onChange={() => {}}
                disabled
                aria-label="Disabled duo range slider"
              />
            </div>
          </div>
        </section>

        {/* ── Type=Triple Range ── */}
        <section className="slider-showcase-section">
          <h3 className="slider-showcase-section-title">Type=Triple Range</h3>
          <p className="slider-showcase-label" style={{ margin: 0 }}>
            Start + End = <span className="slider-showcase-mono">Shape=Round</span> ·{" "}
            Mid = <span className="slider-showcase-mono">Shape=Diamond</span> (dark, rotated 45°)
          </p>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">State=Regular</span>
              <DsSlider
                type="triple-range"
                value={tripleRange}
                onChange={setTripleRange}
                aria-label="Triple range slider"
              />
              <span className="slider-showcase-value">
                {tripleRange[0]} / {tripleRange[1]} / {tripleRange[2]}
              </span>
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">State=Disabled</span>
              <DsSlider
                type="triple-range"
                value={[20, 50, 80]}
                onChange={() => {}}
                disabled
                aria-label="Disabled triple range slider"
              />
            </div>
          </div>
        </section>

        {/* ── Field wrapper (title + helperText) ── */}
        <section className="slider-showcase-section">
          <h3 className="slider-showcase-section-title">Field wrapper (title + helperText)</h3>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <DsSlider
                title="Risk tolerance"
                helperText="Drag to set your preferred exposure level"
                value={withLabel}
                onChange={setWithLabel}
                aria-label="Risk tolerance slider"
              />
              <span className="slider-showcase-value">{withLabel}</span>
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <DsSlider
                title="Allocation range"
                helperText="Set minimum and maximum fund allocation"
                type="duo-range"
                value={[25, 65]}
                onChange={() => {}}
                aria-label="Allocation range slider"
              />
            </div>
          </div>
        </section>

        {/* ── .Marker shapes reference ── */}
        <section className="slider-showcase-section">
          <h3 className="slider-showcase-section-title">.Marker — Shape reference</h3>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">Shape=Round (Default, Duo Range endpoints)</span>
              <DsSlider value={50} onChange={() => {}} aria-label="Round marker demo" />
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">Shape=Diamond (Triple Range mid thumb)</span>
              <DsSlider
                type="triple-range"
                value={[0, 50, 100]}
                onChange={() => {}}
                aria-label="Diamond marker demo"
              />
            </div>
          </div>
        </section>

        {/* ── Focus state reference ── */}
        <section className="slider-showcase-section">
          <h3 className="slider-showcase-section-title">State=Focus (Tab to reach thumbs)</h3>
          <p className="slider-showcase-label" style={{ margin: 0 }}>
            Use Tab to focus a thumb, then Arrow keys to move it.
            Focus ring: 3px <span className="slider-showcase-mono">--ds-general-shadows-focus-ring</span>.
          </p>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">Shape=Round, State=Focus</span>
              <DsSlider value={50} onChange={() => {}} aria-label="Focus demo single" />
            </div>
          </div>

          <div className="slider-showcase-row">
            <div className="slider-showcase-cell">
              <span className="slider-showcase-label">Shape=Diamond, State=Focus (mid thumb)</span>
              <DsSlider
                type="triple-range"
                value={[15, 50, 85]}
                onChange={() => {}}
                aria-label="Focus demo triple"
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
