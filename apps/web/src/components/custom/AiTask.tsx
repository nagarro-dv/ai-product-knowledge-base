import { useState, type ChangeEvent } from "react";
import { DsBadge } from "../ds/Badge";
import { DsCheckbox } from "../ds/Checkbox";
import "./AiTask.css";

export type AiTaskContext = "analysis" | "implementation";
export type AiTaskStatus = "default" | "to-do" | "doing" | "done";

export type AiTaskProps = {
  context?: AiTaskContext;
  status?: AiTaskStatus;
  title?: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (next: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
};

const IMPL_BADGE: Record<Exclude<AiTaskStatus, "default">, { label: string; variant: "neutral" | "warning" | "success" }> = {
  "to-do": { label: "TO DO", variant: "neutral" },
  doing: { label: "Implementing…", variant: "warning" },
  done: { label: "Done", variant: "success" },
};

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function AiTask({
  context = "analysis",
  status = "default",
  title = "Solution title",
  description = "Solution description from analysis.",
  checked,
  defaultChecked = true,
  onCheckedChange,
  className,
}: AiTaskProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const isChecked = isControlled ? checked : internalChecked;
  const inImplementation = context === "implementation";
  const implStatus = status === "default" ? "to-do" : status;
  const implBadge = IMPL_BADGE[implStatus];
  const cleanTitle = stripInlineMarkdown(title);
  const cleanDescription = stripInlineMarkdown(description);

  const rootClass = [
    "aiTask",
    `aiTask--context-${context}`,
    inImplementation ? `aiTask--status-${implStatus}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleCheckedChange = (next: boolean | "indeterminate") => {
    if (typeof next !== "boolean") return;
    if (!isControlled) setInternalChecked(next);
    onCheckedChange?.(next, {} as ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={rootClass}>
      <article className="aiTask__tile" aria-label={cleanTitle}>
        <header className="aiTask__header">
          {inImplementation ? (
            <DsBadge variant={implBadge.variant}>{implBadge.label}</DsBadge>
          ) : (
            <DsBadge variant="secondary">Generated</DsBadge>
          )}
          {!inImplementation ? (
            <div className="aiTask__checkboxSlot" aria-label="Select solution">
              <div className="aiTask__checkboxClip">
                <DsCheckbox
                  checked={isChecked}
                  interactive
                  onCheckedChange={handleCheckedChange}
                  aria-label={`Select ${cleanTitle}`}
                />
              </div>
            </div>
          ) : null}
        </header>
        <div className="aiTask__copy">
          <p className="aiTask__title">{cleanTitle}</p>
          {!inImplementation ? <p className="aiTask__description">{cleanDescription}</p> : null}
        </div>
      </article>
    </div>
  );
}
