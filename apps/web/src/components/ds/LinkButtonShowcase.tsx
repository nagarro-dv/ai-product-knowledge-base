import {
  DsLinkButton,
  DsLinkButtonIconPlaceholder,
  type DsLinkButtonSize,
  type DsLinkButtonVariant,
} from "./LinkButton";
import "./LinkButtonShowcase.css";

const VARIANTS: DsLinkButtonVariant[] = ["accent", "primary"];
const SIZES: DsLinkButtonSize[] = ["default", "large", "small", "mini"];

export function LinkButtonShowcase() {
  return (
    <div className="link-button-showcase" aria-label="Link Button types and sizes">
      <p className="link-button-showcase-hint">
        Types <strong>Accent</strong> and <strong>Primary</strong>; sizes match Figma. Accent focus uses{" "}
        <span className="link-button-showcase-mono">general.shadows.focus</span>; Primary uses{" "}
        <span className="link-button-showcase-mono">link-button.effects</span>. Pass{" "}
        <span className="link-button-showcase-mono">href</span> for an anchor, or omit it for a{" "}
        <span className="link-button-showcase-mono">button</span>. Component set{" "}
        <span className="link-button-showcase-mono">2500:8380</span> (doc{" "}
        <span className="link-button-showcase-mono">2688:15957</span>).
      </p>

      <div className="link-button-showcase-matrix" role="table" aria-label="Type by size">
        <div className="link-button-showcase-row link-button-showcase-row--head" role="row">
          <div className="link-button-showcase-corner" role="columnheader" />
          {VARIANTS.map((v) => (
            <div key={v} className="link-button-showcase-head" role="columnheader">
              {v}
            </div>
          ))}
        </div>
        {SIZES.map((size) => (
          <div key={size} className="link-button-showcase-row" role="row">
            <div className="link-button-showcase-rail" role="rowheader">
              {size}
            </div>
            {VARIANTS.map((variant) => (
              <div key={`${size}-${variant}`} className="link-button-showcase-cell" role="cell">
                <DsLinkButton
                  variant={variant}
                  size={size}
                  href="#link-button-demo"
                  onClick={(e) => e.preventDefault()}
                  leftIcon={<DsLinkButtonIconPlaceholder />}
                  rightIcon={<DsLinkButtonIconPlaceholder />}
                >
                  Label
                </DsLinkButton>
              </div>
            ))}
          </div>
        ))}
      </div>

      <section className="link-button-showcase-section" aria-labelledby="link-button-icons-heading">
        <h3 id="link-button-icons-heading" className="link-button-showcase-section-title">
          Icon slots
        </h3>
        <p className="link-button-showcase-section-lead">
          Figma booleans <span className="link-button-showcase-mono">showLeftIcon</span> /{" "}
          <span className="link-button-showcase-mono">showRightIcon</span> — pass{" "}
          <span className="link-button-showcase-mono">leftIcon</span> /{" "}
          <span className="link-button-showcase-mono">rightIcon</span> (omit for text-only).
        </p>
        <div className="link-button-showcase-row-icons">
          <DsLinkButton variant="accent" size="default" href="#demo" onClick={(e) => e.preventDefault()}>
            Text only
          </DsLinkButton>
          <DsLinkButton
            variant="accent"
            size="default"
            href="#demo"
            onClick={(e) => e.preventDefault()}
            leftIcon={<DsLinkButtonIconPlaceholder />}
          >
            Leading icon
          </DsLinkButton>
          <DsLinkButton
            variant="primary"
            size="default"
            type="button"
            rightIcon={<DsLinkButtonIconPlaceholder />}
          >
            As button
          </DsLinkButton>
        </div>
      </section>
    </div>
  );
}
