import { useMemo, type ReactNode } from "react";
import { FileText, Figma, Link2, Ticket, X } from "lucide-react";
import "./AiAttachment.css";

export type AiAttachmentSize = "tag" | "source";
export type AiAttachmentKind = "figma" | "ticket" | "component" | "comment";

export type AiAttachmentProps = {
  size?: AiAttachmentSize;
  kind?: AiAttachmentKind | "auto";
  href?: string | null;
  value?: string;
  subtitle?: string;
  description?: string | null;
  icon?: ReactNode;
  onRemove?: () => void;
  className?: string;
};

function detectKind(kind: AiAttachmentProps["kind"], href: string | null | undefined): AiAttachmentKind {
  if (kind && kind !== "auto") return kind;
  if (!href) return "comment";
  if (href.includes("figma.com")) return "figma";
  if (/[A-Z][A-Z0-9]+-\d+/i.test(href)) return "ticket";
  return "comment";
}

function renderIcon(kind: AiAttachmentKind, compact: boolean): ReactNode {
  const size = compact ? 16 : 20;
  if (kind === "figma") return <Figma size={size} aria-hidden />;
  if (kind === "ticket") return <Ticket size={size} aria-hidden />;
  if (kind === "component") return <Link2 size={size} aria-hidden />;
  return <FileText size={size} aria-hidden />;
}

export function AiAttachment({
  size = "tag",
  kind = "auto",
  href = null,
  value = "value",
  subtitle = "Source",
  description = null,
  icon,
  onRemove,
  className,
}: AiAttachmentProps) {
  const resolvedKind = detectKind(kind, href);
  const rootClassName = useMemo(() => {
    const classes = ["aiAttachment", `aiAttachment--${size}`, `aiAttachment--${resolvedKind}`];
    if (className) classes.push(className);
    return classes.join(" ");
  }, [className, resolvedKind, size]);

  if (size === "tag") {
    return (
      <div className={rootClassName}>
        <div className="aiAttachment__tag">
          <span className="aiAttachment__tagIcon">{icon ?? renderIcon(resolvedKind, true)}</span>
          {href ? (
            <a className="aiAttachment__tagValue aiAttachment__link" href={href} target="_blank" rel="noreferrer">
              {value}
            </a>
          ) : (
            <span className="aiAttachment__tagValue">{value}</span>
          )}
          {onRemove ? (
            <button type="button" className="aiAttachment__tagClose" aria-label="Remove attachment" onClick={onRemove}>
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <article className="aiAttachment__sourceTile" aria-label={value}>
        <header className="aiAttachment__sourceHeader">
          <span className="aiAttachment__sourceIcon">{icon ?? renderIcon(resolvedKind, false)}</span>
          {onRemove ? (
            <button type="button" className="aiAttachment__sourceAction" aria-label="Remove source" onClick={onRemove}>
              <X size={18} aria-hidden />
            </button>
          ) : null}
        </header>
        <div className="aiAttachment__sourceCopy">
          {href ? (
            <a className="aiAttachment__sourceValue aiAttachment__link" href={href} target="_blank" rel="noreferrer">
              {value}
            </a>
          ) : (
            <span className="aiAttachment__sourceValue">{value}</span>
          )}
          <p className="aiAttachment__sourceSubtitle">{subtitle}</p>
          {description ? <p className="aiAttachment__sourceDescription">{description}</p> : null}
        </div>
      </article>
    </div>
  );
}
