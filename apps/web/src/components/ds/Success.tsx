/**
 * DS Success
 * Figma: XLKRFXYtGQPPHD9cq4JNn8, node 1272:15339 ("Sucess")
 *
 * Centered outcome module: circle check icon, heading-3 title, paragraph description.
 * Boolean axes (Figma): title · description (both default on).
 */

import { Check } from "lucide-react";
import { DsTypography } from "./DsTypography";
import "./Success.css";

export type DsSuccessProps = {
  /** Figma boolean: show/hide the title line. Default: true. */
  title?: boolean;
  /** Figma boolean: show/hide the description paragraph. Default: true. */
  description?: boolean;
  /** Title text. Default matches Figma default content. */
  titleText?: string;
  /** Description text. Default matches Figma default content. */
  descriptionText?: string;
  className?: string;
};

export function DsSuccess({
  title = true,
  description = true,
  titleText = "Cash gap covered",
  descriptionText = "Your €2,900 bridge credit has been activated. Nbank intelligence will monitor repayment and alert you when Client A pays.",
  className = "",
}: DsSuccessProps) {
  return (
    <div
      className={["ds-success", className].filter(Boolean).join(" ")}
      data-figma-file="XLKRFXYtGQPPHD9cq4JNn8"
      data-figma-node="1272:15339"
    >
      {/* Icon circle — Figma 4091:26539: 58×58, 1.5px border, radius-full */}
      <div className="ds-success__icon-wrap" aria-hidden>
        <Check className="ds-success__icon" size={24} strokeWidth={1.5} aria-hidden />
      </div>

      {title && (
        <DsTypography as="p" variant="heading-3" className="ds-success__title" data-figma-node="1272:15325">
          {titleText}
        </DsTypography>
      )}

      {description && (
        <DsTypography as="p" variant="paragraph-regular" className="ds-success__description" data-figma-node="1272:15326">
          {descriptionText}
        </DsTypography>
      )}
    </div>
  );
}
