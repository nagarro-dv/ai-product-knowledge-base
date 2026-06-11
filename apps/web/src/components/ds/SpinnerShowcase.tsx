import { CalendarDays } from "lucide-react";

import { DsIconButton } from "./IconButton";
import { DsSpinner } from "./Spinner";

import "./SpinnerShowcase.css";

const DEMO_SIZES = [16, 20, 24, 32, 40] as const;

export function SpinnerShowcase() {
  return (
    <div className="spinner-showcase" aria-label="Spinner playground">
      <p className="spinner-showcase__lead">
        Figma <strong>Spinner</strong> (<span className="spinner-showcase__mono">2747:12962</span>) — prototype frames cycle rotation;{" "}
        <span className="spinner-showcase__mono">DsSpinner</span> uses one conic-gradient ring and CSS animation. Colours come from{" "}
        <span className="spinner-showcase__mono">--ds-spinner-color-base</span> and{" "}
        <span className="spinner-showcase__mono">--ds-spinner-color-gradient-alpha-00</span> (token group <span className="spinner-showcase__mono">spinner/color</span>).
      </p>

      <section className="spinner-showcase__section" aria-labelledby="spinner-sizes-heading">
        <h3 id="spinner-sizes-heading" className="spinner-showcase__title">
          Sizes
        </h3>
        <div className="spinner-showcase__panel">
          <div className="spinner-showcase__sizes">
            {DEMO_SIZES.map((px) => (
              <div key={px} className="spinner-showcase__size-item">
                <DsSpinner size={px} aria-label={`Loading, ${px} pixels`} />
                <p className="spinner-showcase__size-label">{px}px</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="spinner-showcase__section" aria-labelledby="spinner-icon-slot-heading">
        <h3 id="spinner-icon-slot-heading" className="spinner-showcase__title">
          Icon slot replacement (loading)
        </h3>
        <div className="spinner-showcase__panel">
          <div className="spinner-showcase__icon-demo">
            <DsIconButton variant="secondary" size="regular" aria-label="Save (loading)">
              <DsSpinner size={20} aria-hidden />
            </DsIconButton>
            <p className="spinner-showcase__icon-demo-label">
              Pass <span className="spinner-showcase__mono">size=20</span> (or match your icon box) and <span className="spinner-showcase__mono">aria-hidden</span> on the spinner when the
              control already has an accessible name (e.g. “Save (loading)”).
            </p>
          </div>
          <div className="spinner-showcase__icon-demo" style={{ marginTop: "var(--ds-general-gap-lg)" }}>
            <DsIconButton variant="ghost" size="small" aria-label="Open calendar">
              <CalendarDays strokeWidth={2} aria-hidden />
            </DsIconButton>
            <p className="spinner-showcase__icon-demo-label">
              Same slot with a <span className="spinner-showcase__mono">20px</span> Lucide icon for scale reference.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
