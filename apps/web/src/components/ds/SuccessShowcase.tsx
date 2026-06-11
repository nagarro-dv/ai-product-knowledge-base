import { DsSuccess } from "./Success";
import "./SuccessShowcase.css";

/** Playground for **Success** (Figma **XLKRFXYtGQPPHD9cq4JNn8 / 1272:15339**). */
export function SuccessShowcase() {
  return (
    <div className="success-showcase" aria-label="Success component playground">
      <p className="success-showcase__lead">
        Figma <strong>Success</strong> (<span className="success-showcase__mono">1272:15339</span>) —{" "}
        <span className="success-showcase__mono">DsSuccess</span> is a centered outcome module with a
        foreground-bordered check circle, a heading-3 title, and a paragraph description.
        Boolean axes: <span className="success-showcase__mono">title</span> ·{" "}
        <span className="success-showcase__mono">description</span>.
      </p>

      <section className="success-showcase__section" aria-labelledby="ss-default-heading">
        <h3 id="ss-default-heading" className="success-showcase__title">
          Default (title + description)
        </h3>
        <div className="success-showcase__panel">
          <DsSuccess />
        </div>
      </section>

      <section className="success-showcase__section" aria-labelledby="ss-no-desc-heading">
        <h3 id="ss-no-desc-heading" className="success-showcase__title">
          Title only (<span className="success-showcase__mono">description=false</span>)
        </h3>
        <div className="success-showcase__panel">
          <DsSuccess description={false} />
        </div>
      </section>

      <section className="success-showcase__section" aria-labelledby="ss-no-title-heading">
        <h3 id="ss-no-title-heading" className="success-showcase__title">
          Description only (<span className="success-showcase__mono">title=false</span>)
        </h3>
        <div className="success-showcase__panel">
          <DsSuccess title={false} />
        </div>
      </section>

      <section className="success-showcase__section" aria-labelledby="ss-icon-only-heading">
        <h3 id="ss-icon-only-heading" className="success-showcase__title">
          Icon only (<span className="success-showcase__mono">title=false description=false</span>)
        </h3>
        <div className="success-showcase__panel">
          <DsSuccess title={false} description={false} />
        </div>
      </section>

      <section className="success-showcase__section" aria-labelledby="ss-custom-heading">
        <h3 id="ss-custom-heading" className="success-showcase__title">
          Custom text (e.g. onboarding completion)
        </h3>
        <div className="success-showcase__panel">
          <DsSuccess
            titleText="You're all set"
            descriptionText="Your business profile is ready. You can start using your account."
          />
        </div>
      </section>
    </div>
  );
}
