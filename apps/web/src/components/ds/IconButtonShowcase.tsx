import { DsIconButton, DsIconButtonIconPlaceholder, type DsIconButtonSize, type DsIconButtonVariant } from "./IconButton";
import "./IconButtonShowcase.css";

const VARIANTS: DsIconButtonVariant[] = ["primary", "secondary", "raised", "ghost", "destructive", "inverse"];
const SIZES: DsIconButtonSize[] = ["large", "regular", "small", "mini"];

export function IconButtonShowcase() {
  return (
    <div className="icon-button-showcase" aria-label="Icon Button variants and sizes">
      <p className="icon-button-showcase-hint">
        Icon-only control — each button has an <span className="icon-button-showcase-mono">aria-label</span>. Hover, focus
        (keyboard), and active states follow Figma. Component set{" "}
        <span className="icon-button-showcase-mono">220:64625</span> (doc{" "}
        <span className="icon-button-showcase-mono">2688:14717</span>).
      </p>

      <div className="icon-button-showcase-matrix" role="table" aria-label="Style by size">
        <div className="icon-button-showcase-row icon-button-showcase-row--head" role="row">
          <div className="icon-button-showcase-corner" role="columnheader" />
          {VARIANTS.map((v) => (
            <div key={v} className="icon-button-showcase-head" role="columnheader">
              {v}
            </div>
          ))}
        </div>
        {SIZES.map((size) => (
          <div key={size} className="icon-button-showcase-row" role="row">
            <div className="icon-button-showcase-rail" role="rowheader">
              {size}
            </div>
            {VARIANTS.map((variant) => (
              <div key={`${size}-${variant}`} className="icon-button-showcase-cell" role="cell">
                <DsIconButton variant={variant} size={size} aria-label={`${variant} ${size} sample`}>
                  <DsIconButtonIconPlaceholder />
                </DsIconButton>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
