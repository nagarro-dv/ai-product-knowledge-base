import type { ReactNode } from "react";

import "./Widget.css";

/**
 * Figma: Widget component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 2771:6507.
 * Variant axes: Style (Flat | Raised | Floating), Background (Default | Background UI | Muted).
 */
export type WidgetSurfaceStyle = "flat" | "raised" | "floating";

/** Maps Figma property `Background=Background UI` */
export type WidgetBackground = "default" | "background" | "muted";

export type WidgetProps = {
  /** Slot for card body (Figma instance: WidgetContent frame). */
  children?: ReactNode;
  /** Figma default: Flat */
  surfaceStyle?: WidgetSurfaceStyle;
  /** Figma default: Default */
  background?: WidgetBackground;
  className?: string;
};

const bgClass: Record<WidgetBackground, string> = {
  default: "ds-widget--bg-default",
  background: "ds-widget--bg-background",
  muted: "ds-widget--bg-muted",
};

const underlayClass: Record<WidgetBackground, string> = {
  default: "ds-widget__underlay--default",
  background: "ds-widget__underlay--background",
  muted: "ds-widget__underlay--muted",
};

export function Widget({
  children = null,
  surfaceStyle = "flat",
  background = "default",
  className = "",
}: WidgetProps) {
  const surface =
    surfaceStyle === "flat" ? "ds-widget--flat" : surfaceStyle === "raised" ? "ds-widget--raised" : "ds-widget--floating";

  const rootClass = ["ds-widget", surface, bgClass[background], className].filter(Boolean).join(" ");

  if (surfaceStyle === "raised") {
    return (
      <div
        className={rootClass}
        data-component="widget"
        data-widget-style={surfaceStyle}
        data-widget-background={background}
        data-figma-node="2771:6507"
      >
        <div className={`ds-widget__underlay ${underlayClass[background]}`} aria-hidden />
        <div className="ds-widget__slot" data-part="widget-content">
          {children}
        </div>
        <div className="ds-widget__inner-glow" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={rootClass}
      data-component="widget"
      data-widget-style={surfaceStyle}
      data-widget-background={background}
      data-figma-node="2771:6507"
    >
      <div className="ds-widget__slot" data-part="widget-content">
        {children}
      </div>
    </div>
  );
}
