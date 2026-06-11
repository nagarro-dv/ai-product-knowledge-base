import { Plus } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { DsCheckbox } from "./Checkbox";
import { DsTypography } from "./DsTypography";
import "./Checkbox.css";

export type DsRichCheckboxGroupProps = {
  checked?: boolean;
  flipped?: boolean;
  icon?: boolean;
  showLine2?: boolean;
  label?: string;
  line2?: string;
  iconSlot?: ReactNode;
  disabled?: boolean;
  className?: string;
  onCheckedChange?: (next: boolean) => void;
};

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Figma: Rich Checkbox Group component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 261:14340.
 * Axes: Checked? (False | True) × Flipped (False | True).
 * Hidden booleans: icon, showLine2.
 */
export function DsRichCheckboxGroup({
  checked = false,
  flipped = false,
  icon = false,
  showLine2 = false,
  label = "Label",
  line2 = "Secondary text",
  iconSlot,
  disabled = false,
  className,
  onCheckedChange,
}: DsRichCheckboxGroupProps) {
  const handleToggle = () => {
    if (disabled || onCheckedChange == null) return;
    onCheckedChange(!checked);
  };

  const handleContainerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleToggle();
  };

  const checkbox = <DsCheckbox checked={checked} state={disabled ? "disabled" : "default"} interactive={false} />;

  return (
    <button
      type="button"
      className={classNames("ds-rich-checkbox-group", checked && "ds-rich-checkbox-group--checked", className)}
      data-component="rich-checkbox-group"
      data-figma-node="261:14340"
      data-checked={checked ? "true" : "false"}
      data-flipped={flipped ? "true" : "false"}
      data-icon={icon ? "true" : "false"}
      data-show-line-2={showLine2 ? "true" : "false"}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handleContainerClick}
    >
      {icon ? <span className="ds-rich-checkbox-group__icon-slot">{iconSlot ?? <Plus aria-hidden />}</span> : null}
      {!flipped ? <span className="ds-rich-checkbox-group__control">{checkbox}</span> : null}
      <span className="ds-rich-checkbox-group__text">
        <DsTypography as="span" variant="paragraph-small-regular" className="ds-rich-checkbox-group__label">
          {label}
        </DsTypography>
        {showLine2 ? (
          <DsTypography as="span" variant="paragraph-mini-regular" className="ds-rich-checkbox-group__line2">
            {line2}
          </DsTypography>
        ) : null}
      </span>
      {flipped ? <span className="ds-rich-checkbox-group__control">{checkbox}</span> : null}
    </button>
  );
}
