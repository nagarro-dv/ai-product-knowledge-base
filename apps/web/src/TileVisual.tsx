import type { TokenInspectorEntry } from "@ds-starter/tokens";

import "./TileVisual.css";

const SPACING_TRACK_PX = 128;
const RADIUS_BOX_PX = 88;
const COLOR_SWATCH_PX = 112;

function parseCssColor(s: string): string | null {
  const t = s.trim();
  if (/^#([0-9a-f]{3,8})$/i.test(t)) return t;
  if (/^rgba?\(/i.test(t)) return t;
  if (/^hsla?\(/i.test(t)) return t;
  return null;
}

function parsePxValue(resolved: string | number): number | null {
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  if (typeof resolved === "string") {
    const px = resolved.match(/^(\d+(?:\.\d+)?)px$/i);
    if (px) return parseFloat(px[1]);
    const n = Number.parseFloat(resolved);
    if (!Number.isNaN(n) && /^-?\d/.test(resolved.trim())) return n;
  }
  return null;
}

type VisualKind = "color" | "spacing" | "radius" | null;

function detectVisualKind(path: string, resolved: string | number): VisualKind {
  const p = path.toLowerCase();

  if (typeof resolved === "string" && resolved.startsWith("{") && resolved.endsWith("}")) {
    return null;
  }

  if (typeof resolved === "string" && parseCssColor(resolved)) {
    return "color";
  }

  if (
    p.includes(".color.") ||
    (p.includes("color") &&
      (p.includes("foreground") ||
        p.includes("background") ||
        p.includes("border") ||
        p.includes("accent") ||
        p.includes("muted") ||
        p.includes("canvas") ||
        p.includes("fill") ||
        p.includes("stroke")))
  ) {
    if (typeof resolved === "string" && parseCssColor(resolved)) return "color";
  }

  if (p.includes("letter-spacing")) return null;

  if (/radius/.test(p) && !/blur/.test(p) && !/spread/.test(p) && !/shadow/.test(p)) {
    const px = parsePxValue(resolved);
    if (px != null && px >= 0) return "radius";
  }

  const isSpacingPath =
    p.includes(".spacing.") ||
    p.startsWith("spacing.") ||
    p.includes(".padding.") ||
    p.includes(".gap.") ||
    p.includes(".offset") ||
    /\.scale\./.test(p) ||
    p.includes("paragraph-ident") ||
    p.includes("paragraph-indent") ||
    /\.height\./.test(p) ||
    /\.width\./.test(p) ||
    p.includes("general.height") ||
    p.includes("general.padding") ||
    p.includes("general.spacing");

  if (isSpacingPath) {
    const px = parsePxValue(resolved);
    if (px != null && px >= 0) return "spacing";
  }

  return null;
}

function formatPxLabel(px: number): string {
  return `${px}px`;
}

export function TileVisual({ row }: { row: TokenInspectorEntry }) {
  const kind = detectVisualKind(row.path, row.resolved);

  if (kind === "color") {
    const c = typeof row.resolved === "string" ? parseCssColor(row.resolved) : null;
    if (!c) return null;
    return (
      <div className="tv tv--color" aria-hidden>
        <div
          className="tv-color-swatch"
          style={{
            width: COLOR_SWATCH_PX,
            height: COLOR_SWATCH_PX,
            backgroundColor: c,
          }}
        />
        <span className="tv-color-label">{c}</span>
      </div>
    );
  }

  if (kind === "spacing") {
    const px = parsePxValue(row.resolved);
    if (px == null) return null;
    const fillPx = Math.min(px, SPACING_TRACK_PX);
    return (
      <div className="tv tv--spacing" aria-hidden>
        <div className="tv-spacing-label">{formatPxLabel(px)}</div>
        <div className="tv-spacing-track" style={{ width: SPACING_TRACK_PX }}>
          <div className="tv-spacing-fill" style={{ width: fillPx }} />
        </div>
        <p className="tv-spacing-hint">Bar length matches px (capped at track width). Switch appearance / density to compare.</p>
      </div>
    );
  }

  if (kind === "radius") {
    const px = parsePxValue(row.resolved);
    if (px == null) return null;
    const r = Math.min(px, RADIUS_BOX_PX / 2);
    return (
      <div className="tv tv--radius" aria-hidden>
        <div className="tv-radius-box" style={{ width: RADIUS_BOX_PX, height: RADIUS_BOX_PX }}>
          <div className="tv-radius-inner" style={{ borderRadius: `${r}px` }} />
        </div>
        <span className="tv-radius-label">{formatPxLabel(px)}</span>
      </div>
    );
  }

  return null;
}
