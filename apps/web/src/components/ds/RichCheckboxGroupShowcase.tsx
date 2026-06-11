import { useState } from "react";

import { DsRichCheckboxGroup } from "./RichCheckboxGroup";
import "./CheckboxShowcase.css";

export function RichCheckboxGroupShowcase() {
  const [checkedA, setCheckedA] = useState(false);
  const [checkedB, setCheckedB] = useState(true);

  return (
    <div className="checkbox-showcase" aria-label="Rich Checkbox Group variants">
      <p className="checkbox-showcase__hint">
        Figma component set <span className="checkbox-showcase__mono">261:14340</span> —
        <span className="checkbox-showcase__mono"> Checked? × Flipped</span> with hidden booleans
        <span className="checkbox-showcase__mono"> icon</span> and
        <span className="checkbox-showcase__mono"> showLine2</span>.
      </p>
      <div className="checkbox-showcase__stack">
        <div className="checkbox-showcase__sample checkbox-showcase__sample--column">
          <span className="checkbox-showcase__label">Flipped=false</span>
          <DsRichCheckboxGroup checked={checkedA} label="Label" onCheckedChange={setCheckedA} />
          <DsRichCheckboxGroup checked={!checkedA} label="Label" showLine2 line2="Secondary text" />
        </div>
        <div className="checkbox-showcase__sample checkbox-showcase__sample--column">
          <span className="checkbox-showcase__label">Flipped=true</span>
          <DsRichCheckboxGroup checked={checkedB} flipped label="Label" onCheckedChange={setCheckedB} />
          <DsRichCheckboxGroup checked={!checkedB} flipped label="Label" icon showLine2 line2="Secondary text" />
        </div>
      </div>
    </div>
  );
}
