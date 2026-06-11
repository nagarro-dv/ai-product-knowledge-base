import { useState } from "react";

import { DsCheckboxGroup } from "./CheckboxGroup";
import "./CheckboxShowcase.css";

export function CheckboxGroupShowcase() {
  const [inlineChecked, setInlineChecked] = useState(false);
  const [blockChecked, setBlockChecked] = useState(true);

  return (
    <div className="checkbox-showcase" aria-label="Checkbox Group variants">
      <p className="checkbox-showcase__hint">
        Figma component set <span className="checkbox-showcase__mono">261:14288</span> —
        <span className="checkbox-showcase__mono"> Layout × Checked?</span>.
      </p>
      <div className="checkbox-showcase__stack">
        <div className="checkbox-showcase__sample">
          <span className="checkbox-showcase__label">Layout=inline</span>
          <DsCheckboxGroup layout="inline" checked={inlineChecked} label="Label" onCheckedChange={setInlineChecked} />
          <DsCheckboxGroup layout="inline" checked={!inlineChecked} label="Label" onCheckedChange={(next) => setInlineChecked(!next)} />
        </div>
        <div className="checkbox-showcase__sample">
          <span className="checkbox-showcase__label">Layout=block</span>
          <DsCheckboxGroup layout="block" checked={blockChecked} label="Label" onCheckedChange={setBlockChecked} />
          <DsCheckboxGroup layout="block" checked={!blockChecked} label="Label" onCheckedChange={(next) => setBlockChecked(!next)} />
        </div>
      </div>
    </div>
  );
}
