import { Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import { DsTypography } from "../components/ds/DsTypography";
import { DEFAULT_VIEWPORT, viewportForPreset, withFlippedOrientation, type ResponsiveViewport } from "./responsiveViewport";
import "./ResponsiveToolbar.css";

const PRESETS = [
  { id: "desktop" as const, label: "Desktop", icon: Monitor },
  { id: "tablet" as const, label: "Tablet", icon: Tablet },
  { id: "mobile" as const, label: "Mobile", icon: Smartphone },
];

/**
 * One shared control governing every preview in the Compare-directions
 * screen — the Original component and every direction resize together, so
 * comparisons always happen at the same width. Presets are a fast entry
 * point into a continuous resize (see ResponsivePreviewStage's drag handle),
 * not the whole feature — this is why there's no "Custom" button here: you
 * reach it by dragging, and the width readout confirms exactly where you are.
 */
export function ResponsiveToolbar({
  viewport,
  onChange,
}: {
  viewport: ResponsiveViewport;
  onChange: (next: ResponsiveViewport) => void;
}) {
  const canRotate = viewport.preset === "tablet" || viewport.preset === "mobile";

  return (
    <div className="responsiveToolbar" role="group" aria-label="Preview viewport">
      <div className="responsiveToolbar__presets">
        {PRESETS.map(({ id, label, icon: Icon }) => {
          const active = viewport.preset === id;
          return (
            <button
              key={id}
              type="button"
              className={`responsiveToolbar__preset${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(id === "desktop" ? DEFAULT_VIEWPORT : viewportForPreset(id, "portrait"))}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      {canRotate ? (
        <button
          type="button"
          className="responsiveToolbar__rotate"
          onClick={() => onChange(withFlippedOrientation(viewport))}
          aria-label={`Rotate to ${viewport.orientation === "portrait" ? "landscape" : "portrait"}`}
          title="Rotate"
        >
          <RotateCw size={13} aria-hidden />
        </button>
      ) : null}
      <DsTypography as="span" variant="paragraph-mini-regular" className="responsiveToolbar__width" aria-live="polite">
        {viewport.preset === "desktop" ? "Fluid width" : `${Math.round(viewport.width)} × ${Math.round(viewport.height)} px`}
      </DsTypography>
    </div>
  );
}
