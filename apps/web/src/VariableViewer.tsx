import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Mode } from "./mode";
import { buildInspectorRows, type InspectorRow } from "./tokenInspector";
import "./VariableViewer.css";

const PREFIX_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All prefixes" },
  { value: "--ds-general", label: "General" },
  { value: "--ds-button", label: "Button" },
  { value: "--ds-badge", label: "Badge" },
  { value: "--ds-checkbox", label: "Checkbox" },
  { value: "--ds-tooltip", label: "Tooltip" },
];

const SPACING_DISPLAY_MAX_PX = 120;

function rowKey(row: InspectorRow): string {
  return row.rowId ?? row.cssVar;
}

function compactTileLogicalPath(path: string): string {
  return path;
}

function tokenGroupFromPath(path: string): string {
  const first = path.split(".")[0]?.trim();
  return first && first.length > 0 ? first : "Other";
}

function rowSort(a: InspectorRow, b: InspectorRow): number {
  const pa = a.logicalPath;
  const pb = b.logicalPath;
  if (pa.startsWith("general.") && !pb.startsWith("general.")) return -1;
  if (!pa.startsWith("general.") && pb.startsWith("general.")) return 1;
  return pa.localeCompare(pb);
}

function resolvedForMode(row: InspectorRow, appearance: Mode["appearance"]): string {
  return appearance === "Dark" ? row.resolvedDark : row.resolvedLight;
}

function parsePx(s: string): number | null {
  const m = String(s).trim().match(/^([\d.]+)px$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

type VisualKind = "color" | "text" | "spacing" | "radius" | "size" | "number";

function visualKindForRow(row: InspectorRow): VisualKind {
  if (row.type === "color") return "color";
  if (row.type === "text") return "text";
  if (row.type !== "number") return "number";
  const path = row.logicalPath.toLowerCase();
  const cv = row.cssVar.toLowerCase();
  if (path.includes("gap") || path.includes("padding") || path.includes("spacing")) return "spacing";
  if (cv.includes("gap") || cv.includes("padding")) return "spacing";
  if (path.includes("radius") || cv.includes("radius")) return "radius";
  if (path.includes("height") || path.includes("width") || path.includes("size")) return "size";
  return "number";
}

function stripCssStringToken(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t.slice(1, -1);
    }
  }
  return t;
}

function TokenTileVisual({
  row,
  resolved,
  liveCss,
}: {
  row: InspectorRow;
  resolved: string;
  liveCss: string;
}) {
  const kind = visualKindForRow(row);
  const colorFill = stripCssStringToken(liveCss || resolved);

  if (kind === "text") {
    const text = stripCssStringToken(liveCss || resolved);
    return (
      <div className="token-tile__text-visual" aria-label={`Text ${text}`}>
        <span className="token-tile__text-sample">{text || "—"}</span>
      </div>
    );
  }

  if (kind === "color") {
    return (
      <div
        className="token-tile__color-block"
        style={{ backgroundColor: colorFill || "transparent" }}
        role="img"
        aria-label={`Color ${resolved}`}
      />
    );
  }

  if (kind === "spacing") {
    const px = parsePx(liveCss || resolved) ?? 0;
    const shown = Math.min(px, SPACING_DISPLAY_MAX_PX);
    const scaled = px > SPACING_DISPLAY_MAX_PX;
    return (
      <div className="token-tile__spacing" aria-label={`Spacing ${resolved}`}>
        <div className="token-tile__spacing-track">
          {px === 0 ? (
            <span className="token-tile__spacing-zero">0</span>
          ) : (
            <div className="token-tile__spacing-line" style={{ width: `${shown}px` }} />
          )}
        </div>
        {scaled ? (
          <span className="token-tile__spacing-note">
            Bar capped at {SPACING_DISPLAY_MAX_PX}px — value {px}px
          </span>
        ) : null}
      </div>
    );
  }

  if (kind === "radius") {
    const r = (liveCss || resolved).trim() || "0px";
    return (
      <div className="token-tile__radius-wrap" aria-label={`Radius ${resolved}`}>
        <div className="token-tile__radius-square" style={{ borderRadius: r }} />
      </div>
    );
  }

  if (kind === "size") {
    const px = parsePx(liveCss || resolved) ?? 0;
    const d = Math.min(Math.max(px, 0), 72);
    return (
      <div className="token-tile__size-wrap" aria-label={`Size ${resolved}`}>
        <div className="token-tile__size-box" style={{ width: `${d}px`, height: `${d}px` }} />
        {px > 72 ? (
          <span className="token-tile__size-note">Preview max 72px — value {px}px</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="token-tile__fallback" aria-hidden>
      <code>{resolved}</code>
    </div>
  );
}

function VariableListView({ filtered, mode }: { filtered: InspectorRow[]; mode: Mode }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  return (
    <div className="variable-viewer__scroll" ref={parentRef}>
      <div className="variable-viewer__header-row" role="row">
        <div role="columnheader">Logical path</div>
        <div role="columnheader">CSS variable</div>
        <div role="columnheader">Alias</div>
        <div role="columnheader">Resolved ({mode.appearance})</div>
        <div role="columnheader">Live CSS</div>
      </div>
      <div className="variable-viewer__virtual" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((vi) => {
          const row = filtered[vi.index];
          const live = getComputedStyle(document.documentElement).getPropertyValue(row.cssVar).trim();
          const staticResolved = resolvedForMode(row, mode.appearance);
          return (
            <div
              key={rowKey(row)}
              className="variable-viewer__row"
              role="row"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <div className="variable-viewer__cell variable-viewer__cell--path" title={row.logicalPath}>
                {row.logicalPath}
              </div>
              <div className="variable-viewer__cell">
                <code>{row.cssVar}</code>
              </div>
              <div className="variable-viewer__cell variable-viewer__cell--alias">
                {row.alias ? <code>{row.alias}</code> : "—"}
              </div>
              <div className="variable-viewer__cell">
                <code>{staticResolved}</code>
              </div>
              <div className="variable-viewer__cell variable-viewer__cell--live">
                {row.type === "color" && live ? (
                  <span className="variable-viewer__swatch-wrap">
                    <span
                      className="variable-viewer__swatch"
                      style={{ background: live || staticResolved }}
                      aria-hidden
                    />
                    <code>{live}</code>
                  </span>
                ) : (
                  <code>{live || "—"}</code>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  mode: Mode;
};

export function VariableViewer({ mode }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [prefix, setPrefix] = useState("--ds-general");
  const [layout, setLayout] = useState<"tiles" | "list">("tiles");

  const allRows = useMemo(
    () => buildInspectorRows(mode),
    [mode.theme, mode.density],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return allRows
      .filter((r) => (prefix ? r.cssVar.startsWith(prefix) : true))
      .filter((r) => {
        if (!q) return true;
        return (
          r.logicalPath.toLowerCase().includes(q) ||
          r.cssVar.toLowerCase().includes(q) ||
          (r.alias && r.alias.toLowerCase().includes(q))
        );
      })
      .sort(rowSort);
  }, [allRows, deferredQuery, prefix]);

  const groupedTiles = useMemo(() => {
    const buckets = new Map<string, Array<{ row: InspectorRow; compactPath: string }>>();
    for (const row of filtered) {
      const compactPath = compactTileLogicalPath(row.logicalPath);
      const group = tokenGroupFromPath(compactPath);
      if (!buckets.has(group)) buckets.set(group, []);
      buckets.get(group)!.push({ row, compactPath });
    }
    return [...buckets.entries()].map(([group, entries]) => ({ group, entries }));
  }, [filtered]);

  return (
    <div className="variable-viewer">
      <div className="variable-viewer__toolbar">
        <label className="playground-control-label" htmlFor="var-search">
          Search
        </label>
        <input
          id="var-search"
          className="variable-viewer__search playground-control playground-control--search"
          type="search"
          placeholder="Path, CSS variable, or alias…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <label className="playground-control-label" htmlFor="var-prefix">
          Prefix
        </label>
        <select
          id="var-prefix"
          className="variable-viewer__prefix playground-control playground-control--select"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        >
          {PREFIX_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="variable-viewer__layout-toggle" role="group" aria-label="Variable layout">
          <button
            type="button"
            className={layout === "tiles" ? "variable-viewer__layout-btn is-active" : "variable-viewer__layout-btn"}
            onClick={() => setLayout("tiles")}
            aria-pressed={layout === "tiles"}
          >
            Tiles
          </button>
          <button
            type="button"
            className={layout === "list" ? "variable-viewer__layout-btn is-active" : "variable-viewer__layout-btn"}
            onClick={() => setLayout("list")}
            aria-pressed={layout === "list"}
          >
            List
          </button>
        </div>

        <span className="variable-viewer__count">{filtered.length} variables</span>
      </div>

      {layout === "tiles" ? (
        <div className="variable-viewer__tiles-scroll">
          <div className="variable-viewer__tile-groups">
            {groupedTiles.map(({ group, entries }) => (
              <section key={group} className="variable-viewer__tile-group" aria-label={group}>
                <h3 className="variable-viewer__tile-groupTitle">{group}</h3>
                <ul className="variable-viewer__tiles" aria-label={`${group} token tiles`}>
                  {entries.map(({ row, compactPath }) => {
                    const live = getComputedStyle(document.documentElement).getPropertyValue(row.cssVar).trim();
                    const staticResolved = resolvedForMode(row, mode.appearance);
                    return (
                      <li key={rowKey(row)} className="token-tile">
                        <TokenTileVisual row={row} resolved={staticResolved} liveCss={live} />
                        <div className="token-tile__meta">
                          <div className="token-tile__path" title={row.logicalPath}>
                            {compactPath}
                          </div>
                          <code className="token-tile__var">{row.cssVar}</code>
                          <div className="token-tile__values">
                            <code>{staticResolved}</code>
                            {live && live !== staticResolved ? (
                              <span className="token-tile__live">
                                live: <code>{live}</code>
                              </span>
                            ) : null}
                          </div>
                          {row.alias ? (
                            <div className="token-tile__alias">
                              → <code>{row.alias}</code>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <VariableListView filtered={filtered} mode={mode} />
      )}
    </div>
  );
}
