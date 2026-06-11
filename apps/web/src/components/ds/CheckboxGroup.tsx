import type { MouseEvent } from "react";

import { DsCheckbox } from "./Checkbox";
import { DsTypography } from "./DsTypography";
import "./Checkbox.css";

export type DsCheckboxGroupLayout = "inline" | "block";

export type DsCheckboxGroupProps = {
  checked?: boolean;
  layout?: DsCheckboxGroupLayout;
  label?: string;
  disabled?: boolean;
  className?: string;
  onCheckedChange?: (next: boolean) => void;
};

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Figma: Checkbox Group component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 261:14288.
 * Axes: Layout (Inline | Block) × Checked? (False | True).
 */
export function DsCheckboxGroup({
  checked = false,
  layout = "inline",
  label = "Label",
  disabled = false,
  className,
  onCheckedChange,
}: DsCheckboxGroupProps) {
  const handleToggle = () => {
    if (disabled || onCheckedChange == null) return;
    onCheckedChange(!checked);
  };

  const handleContainerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleToggle();
  };

  return (
    <button
      type="button"
      className={classNames("ds-checkbox-group", layout === "block" && "ds-checkbox-group--block", className)}
      data-component="checkbox-group"
      data-figma-node="261:14288"
      data-layout={layout}
      data-checked={checked ? "true" : "false"}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handleContainerClick}
    >
      <DsCheckbox checked={checked} state={disabled ? "disabled" : "default"} interactive={false} className="ds-checkbox-group__control" />
      <DsTypography as="span" variant="paragraph-small-regular" className="ds-checkbox-group__label">
        {label}
      </DsTypography>
    </button>
  );
}
