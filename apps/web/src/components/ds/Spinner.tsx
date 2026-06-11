import type { CSSProperties, HTMLAttributes } from "react";

import "./Spinner.css";

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export type DsSpinnerProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /**
   * Width and height in CSS pixels. Ring stroke scales with size (~12.5% of diameter, minimum 1.5px).
   * Default **24** (Figma component frame). Use **16–20** when substituting for small icons (e.g. Lucide 20px slot).
   */
  size?: number;
};

/**
 * Figma **Spinner** — **2747:12962** (prototype uses 24 `State` variants for rotation; code uses a single animated ring).
 * Uses **spinner** tokens so colour tracks theme/appearance. Resize with **`size`** or override **`style.width` / `style.height`**.
 */
export function DsSpinner({
  className,
  size = 24,
  style,
  role = "status",
  "aria-label": ariaLabel = "Loading",
  "aria-hidden": ariaHidden,
  ...rest
}: DsSpinnerProps) {
  const decorative = ariaHidden === true || ariaHidden === "true";
  const strokePx = Math.max(1.5, size * 0.125);
  const tokenStyle: CSSProperties & Record<"--ds-spinner-stroke", string> = {
    "--ds-spinner-stroke": `${strokePx}px`,
  };

  return (
    <div
      className={cx("ds-spinner", className)}
      style={{ width: size, height: size, ...tokenStyle, ...style }}
      data-component="spinner"
      data-figma-node="2747:12962"
      role={decorative ? undefined : role}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
      {...rest}
    >
      <div className="ds-spinner__track" aria-hidden />
    </div>
  );
}
