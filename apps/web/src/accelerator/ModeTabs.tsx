import type { AcceleratorMode } from "@ds-starter/standards";
import { DsTypography } from "../components/ds/DsTypography";
import { MODE_CONFIGS } from "./modeSlots";
import "./ModeTabs.css";

const ORDER: AcceleratorMode[] = ["improve", "qa", "create"];

export type ModeTabsProps = {
  selected: AcceleratorMode;
  onSelect: (mode: AcceleratorMode) => void;
};

/**
 * The mode switcher, always on screen — there is no separate landing page.
 * A muted track with the active mode as a floating white pill, label only —
 * no icons, no second line of copy. The mode's own heading below carries
 * the detail; a tab is a control, not a pitch.
 */
export function ModeTabs({ selected, onSelect }: ModeTabsProps) {
  return (
    <div className="modeTabs" role="tablist" aria-label="Mode">
      {ORDER.map((mode) => {
        const config = MODE_CONFIGS[mode];
        const isSelected = mode === selected;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={config.disabled}
            className={`modeTabs__tab${isSelected ? " modeTabs__tab--selected" : ""}`}
            onClick={() => onSelect(mode)}
          >
            <DsTypography as="span" variant="paragraph-small-medium" className="modeTabs__title">
              {config.disabled ? `${config.title} · Soon` : config.title}
            </DsTypography>
          </button>
        );
      })}
    </div>
  );
}
