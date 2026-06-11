import { Check } from "lucide-react";
import { DsBadge, type DsBadgeState, type DsBadgeVariant } from "./Badge";
import "./BadgeShowcase.css";

const VARIANTS: DsBadgeVariant[] = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "neutral",
  "success",
  "warning",
];

const STATES: DsBadgeState[] = ["default", "hover", "focus"];

export function BadgeShowcase() {
  return (
    <div className="badge-showcase" aria-label="Badge variants and states">
      <p className="badge-showcase__hint">
        Badge variants and state matrix from Figma node <span className="badge-showcase__mono">488:1944</span>.
      </p>
      <div className="badge-showcase__matrix" role="table" aria-label="Variant by state">
        <div className="badge-showcase__row badge-showcase__row--head" role="row">
          <div className="badge-showcase__corner" role="columnheader" />
          {VARIANTS.map((variant) => (
            <div key={variant} className="badge-showcase__head" role="columnheader">
              {variant}
            </div>
          ))}
        </div>
        {STATES.map((state) => (
          <div key={state} className="badge-showcase__row" role="row">
            <div className="badge-showcase__rail" role="rowheader">
              {state}
            </div>
            {VARIANTS.map((variant) => (
              <div key={`${state}-${variant}`} className="badge-showcase__cell" role="cell">
                <DsBadge variant={variant} state={state}>
                  Label
                </DsBadge>
              </div>
            ))}
          </div>
        ))}
      </div>
      <section className="badge-showcase__icons" aria-label="Badge icon slot combinations">
        <DsBadge variant="primary" showIconLeft>
          Label
        </DsBadge>
        <DsBadge variant="secondary" showIconRight>
          Label
        </DsBadge>
        <DsBadge variant="success" showIconLeft showIconRight leftIcon={<Check aria-hidden />} rightIcon={<Check aria-hidden />}>
          Label
        </DsBadge>
      </section>
    </div>
  );
}
