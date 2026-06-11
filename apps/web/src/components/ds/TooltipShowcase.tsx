import { Info } from "lucide-react";

import { DsIconButton } from "./IconButton";
import { DsTooltip, type DsTooltipSide } from "./Tooltip";

import "./TooltipShowcase.css";

const SIDES: DsTooltipSide[] = ["top", "bottom", "left", "right"];

export function TooltipShowcase() {
  return (
    <div className="tooltip-showcase" aria-label="Tooltip playground">
      <p className="tooltip-showcase__lead">
        Figma <strong>Tooltip</strong> (<span className="tooltip-showcase__mono">2640:407</span>) with side variants. Click each
        Ghost icon button (Lucide <span className="tooltip-showcase__mono">Info</span>) to toggle the tooltip.
      </p>

      <section className="tooltip-showcase__section" aria-labelledby="tooltip-click-heading">
        <h3 id="tooltip-click-heading" className="tooltip-showcase__title">
          Click trigger examples
        </h3>
        <div className="tooltip-showcase__panel">
          <div className="tooltip-showcase__grid">
            {SIDES.map((side) => (
              <div key={side} className="tooltip-showcase__item">
                <p className="tooltip-showcase__item-label">Side: {side}</p>
                <DsTooltip side={side} trigger="click" content="Tooltip Text">
                  <DsIconButton variant="ghost" size="regular" aria-label={`Show ${side} tooltip`}>
                    <Info aria-hidden />
                  </DsIconButton>
                </DsTooltip>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
