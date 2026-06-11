import type { Mode } from "./mode";
import "./ModeControls.css";

type Props = {
  mode: Mode;
  setTheme: (t: Mode["theme"]) => void;
  setAppearance: (a: Mode["appearance"]) => void;
  setDensity: (d: Mode["density"]) => void;
};

export function ModeControls({ mode, setTheme, setAppearance, setDensity }: Props) {
  return (
    <div className="mode-controls" role="group" aria-label="Design token modes">
      <div className="mode-controls__field playground-control-field">
        <label className="playground-control-label" htmlFor="mode-theme">
          Theme
        </label>
        <select
          className="playground-control playground-control--select"
          id="mode-theme"
          value={mode.theme}
          onChange={(e) => setTheme(e.target.value as Mode["theme"])}
        >
          <option value="default">Default</option>
          <option value="nagarro">Nagarro</option>
        </select>
      </div>
      <div className="mode-controls__field playground-control-field">
        <label className="playground-control-label" htmlFor="mode-appearance">
          Appearance
        </label>
        <select
          className="playground-control playground-control--select"
          id="mode-appearance"
          value={mode.appearance}
          onChange={(e) => setAppearance(e.target.value as Mode["appearance"])}
        >
          <option value="Light">Light</option>
          <option value="Dark">Dark</option>
        </select>
      </div>
      <div className="mode-controls__field playground-control-field">
        <label className="playground-control-label" htmlFor="mode-density">
          Density
        </label>
        <select
          className="playground-control playground-control--select"
          id="mode-density"
          value={mode.density}
          onChange={(e) => setDensity(e.target.value as Mode["density"])}
        >
          <option value="Compact">Compact</option>
          <option value="Standard">Standard</option>
          <option value="Comfortable">Comfortable</option>
        </select>
      </div>
    </div>
  );
}
