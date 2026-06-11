import { DsCheckbox, type DsCheckboxChecked, type DsCheckboxState } from "./Checkbox";
import "./CheckboxShowcase.css";

const CHECKED_VALUES: DsCheckboxChecked[] = [false, true, "indeterminate"];
const STATES: DsCheckboxState[] = ["default", "focus", "error", "error-focus", "disabled"];

function checkedLabel(value: DsCheckboxChecked): string {
  if (value === "indeterminate") return "indeterminate";
  return value ? "true" : "false";
}

export function CheckboxShowcase() {
  return (
    <div className="checkbox-showcase" aria-label="Checkbox state matrix">
      <p className="checkbox-showcase__hint">
        Figma component set <span className="checkbox-showcase__mono">261:14234</span> —
        <span className="checkbox-showcase__mono"> Checked? × State</span>.
      </p>
      <div className="checkbox-showcase__matrix" role="table" aria-label="Checkbox checked and state matrix">
        <div className="checkbox-showcase__row checkbox-showcase__row--head" role="row">
          <div className="checkbox-showcase__corner" role="columnheader" />
          {STATES.map((state) => (
            <div key={state} className="checkbox-showcase__head" role="columnheader">
              {state}
            </div>
          ))}
        </div>
        {CHECKED_VALUES.map((checked) => (
          <div key={checkedLabel(checked)} className="checkbox-showcase__row" role="row">
            <div className="checkbox-showcase__rail" role="rowheader">
              {checkedLabel(checked)}
            </div>
            {STATES.map((state) => (
              <div key={`${checkedLabel(checked)}-${state}`} className="checkbox-showcase__cell" role="cell">
                <DsCheckbox checked={checked} state={state} interactive={false} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
