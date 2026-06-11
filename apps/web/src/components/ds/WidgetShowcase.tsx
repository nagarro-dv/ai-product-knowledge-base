import { Widget, type WidgetBackground, type WidgetSurfaceStyle } from "./Widget";
import "./WidgetShowcase.css";

/** Figma matrix 2771:6507: each row = Background; columns L→R = Flat, Raised, Floating */
const ROW_BACKGROUNDS: WidgetBackground[] = ["default", "background", "muted"];
const COL_STYLES: WidgetSurfaceStyle[] = ["flat", "raised", "floating"];

const labelFor = (style: WidgetSurfaceStyle, bg: WidgetBackground) => {
  const s = style === "flat" ? "Flat" : style === "raised" ? "Raised" : "Floating";
  const b =
    bg === "default" ? "Default" : bg === "background" ? "Background UI" : "Muted";
  return `${s} · ${b}`;
};

/**
 * 3×3 matrix matching Figma frame 2771:6507 (Style × Background).
 */
export function WidgetShowcase() {
  return (
    <div className="widget-showcase" aria-label="Widget variants">
      <div className="widget-showcase-grid">
        {ROW_BACKGROUNDS.flatMap((background) =>
          COL_STYLES.map((surfaceStyle) => (
            <figure key={`${background}-${surfaceStyle}`} className="widget-showcase-cell">
              <figcaption className="widget-showcase-caption">{labelFor(surfaceStyle, background)}</figcaption>
              <Widget surfaceStyle={surfaceStyle} background={background}>
                <div className="widget-showcase-slot-inner" aria-hidden />
              </Widget>
            </figure>
          ))
        )}
      </div>
      <p className="widget-showcase-footnote">
        Figma: <span className="widget-showcase-mono">Style</span> × <span className="widget-showcase-mono">Background</span>
        . Empty slot matches component default; replace with real content via <span className="widget-showcase-mono">children</span>.
      </p>
    </div>
  );
}
