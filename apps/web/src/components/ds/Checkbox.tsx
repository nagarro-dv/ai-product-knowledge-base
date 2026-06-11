import { Check, Minus } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import "./Checkbox.css";

export type DsCheckboxChecked = boolean | "indeterminate";
export type DsCheckboxState = "default" | "focus" | "error" | "error-focus" | "disabled";

export type DsCheckboxProps = {
  checked?: DsCheckboxChecked;
  state?: DsCheckboxState;
  interactive?: boolean;
  className?: string;
  onCheckedChange?: (next: DsCheckboxChecked) => void;
  "aria-label"?: string;
};

function classNames(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

function getNextChecked(current: DsCheckboxChecked): DsCheckboxChecked {
  if (current === "indeterminate") return true;
  return !current;
}

/**
 * Figma: Checkbox component set — file 8Ry9Oa2niLBGvoWPo9rLQT, node 261:14234.
 * Axes: Checked? (False | True | Indeterminate) × State (Default | Focus | Error | Error Focus | Disabled).
 */
export function DsCheckbox({
  checked = false,
  state = "default",
  interactive = true,
  className,
  onCheckedChange,
  "aria-label": ariaLabel = "Checkbox",
}: DsCheckboxProps) {
  const checkedValue = checked === "indeterminate" ? "indeterminate" : checked ? "true" : "false";
  const isDisabled = state === "disabled";

  const handleToggle = () => {
    if (!interactive || isDisabled || onCheckedChange == null) return;
    onCheckedChange(getNextChecked(checked));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    handleToggle();
  };

  if (!interactive) {
    return (
      <span
        className={classNames("ds-checkbox", className)}
        data-component="checkbox"
        data-figma-node="261:14234"
        data-checked={checkedValue}
        data-state={state}
        aria-hidden
      >
        <span className="ds-checkbox__box" aria-hidden />
        <span className="ds-checkbox__icon" aria-hidden>
          {checked === "indeterminate" ? <Minus /> : <Check />}
        </span>
      </span>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleToggle();
  };

  return (
    <button
      type="button"
      className={classNames("ds-checkbox", className)}
      data-component="checkbox"
      data-figma-node="261:14234"
      data-checked={checkedValue}
      data-state={state}
      role="checkbox"
      aria-label={ariaLabel}
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      aria-invalid={state === "error" || state === "error-focus" || undefined}
      disabled={isDisabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="ds-checkbox__box" aria-hidden />
      <span className="ds-checkbox__icon" aria-hidden>
        {checked === "indeterminate" ? <Minus /> : <Check />}
      </span>
    </button>
  );
}
