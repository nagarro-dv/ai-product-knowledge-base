import { DsButton, DsButtonIconPlaceholder, type DsButtonSize, type DsButtonVariant } from "./Button";
import "./ButtonShowcase.css";

const VARIANTS: DsButtonVariant[] = ["primary", "secondary", "raised", "ghost", "destructive", "inverse"];
const SIZES: DsButtonSize[] = ["large", "regular", "small", "mini"];

export function ButtonShowcase() {
  return (
    <div className="button-showcase" aria-label="Button variants and sizes">
      <p className="button-showcase-hint">
        Hover, focus (keyboard), and active states follow Figma. Node{" "}
        <span className="button-showcase-mono">33:476</span>.
      </p>

      <div className="button-showcase-matrix" role="table" aria-label="Style by size">
        <div className="button-showcase-row button-showcase-row--head" role="row">
          <div className="button-showcase-corner" role="columnheader" />
          {VARIANTS.map((v) => (
            <div key={v} className="button-showcase-head" role="columnheader">
              {v}
            </div>
          ))}
        </div>
        {SIZES.map((size) => (
          <div key={size} className="button-showcase-row" role="row">
            <div className="button-showcase-rail" role="rowheader">
              {size}
            </div>
            {VARIANTS.map((variant) => (
              <div key={`${size}-${variant}`} className="button-showcase-cell" role="cell">
                <DsButton variant={variant} size={size}>
                  Label
                </DsButton>
              </div>
            ))}
          </div>
        ))}
      </div>

      <section className="button-showcase-section" aria-labelledby="button-showcase-icons-heading">
        <h3 id="button-showcase-icons-heading" className="button-showcase-section-title">
          Icon slots
        </h3>
        <p className="button-showcase-section-lead">
          Figma booleans <span className="button-showcase-mono">showLeftIcon</span> /{" "}
          <span className="button-showcase-mono">showRightIcon</span> — pass{" "}
          <span className="button-showcase-mono">leftIcon</span> /{" "}
          <span className="button-showcase-mono">rightIcon</span>.
        </p>
        <div className="button-showcase-row-icons">
          <DsButton variant="primary" size="regular" leftIcon={<DsButtonIconPlaceholder />}>
            Label
          </DsButton>
          <DsButton variant="secondary" size="regular" rightIcon={<DsButtonIconPlaceholder />}>
            Label
          </DsButton>
          <DsButton
            variant="ghost"
            size="regular"
            leftIcon={<DsButtonIconPlaceholder />}
            rightIcon={<DsButtonIconPlaceholder />}
          >
            Label
          </DsButton>
        </div>
      </section>
    </div>
  );
}
