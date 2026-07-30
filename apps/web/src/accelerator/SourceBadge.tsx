import { Component, ExternalLink, Figma, Ticket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DsTypography } from "../components/ds/DsTypography";
import { computeAnchoredPosition, type PopoverPosition } from "./popoverPosition";
import { sourceChipName, sourceTypeLabel, type SourceChipKind } from "./source-format";
import type { SourceEntry } from "./types";
import "./SourceBadge.css";

/**
 * A source's scannable identity: small uppercase type, loud friendly name.
 * The full URL/context never appears inline — it lives in a click-to-open
 * detail popover, so the badge row stays readable at a glance.
 */
export function SourceBadge({ source }: { source: SourceEntry & { kind: SourceChipKind } }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const name = sourceChipName(source.kind, source.value, source.storybook?.componentPath);
  const isLink = /^https?:\/\//i.test(source.value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) setPosition(computeAnchoredPosition(triggerRef.current, 240));
    setOpen((current) => !current);
  };

  const icon =
    source.kind === "figma" ? (
      <Figma size={14} aria-hidden />
    ) : source.kind === "ticket" ? (
      <Ticket size={14} aria-hidden />
    ) : (
      <Component size={14} aria-hidden />
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="sourceBadge"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <span className="sourceBadge__icon">{icon}</span>
        <span className="sourceBadge__text">
          <span className="sourceBadge__type">{sourceTypeLabel(source.kind)}</span>
          <span className="sourceBadge__name">{name}</span>
        </span>
      </button>
      {open && position ? (
        <div
          ref={popoverRef}
          className="sourceBadge__popover"
          role="dialog"
          aria-label={`${sourceTypeLabel(source.kind)} source details`}
          style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
        >
          <DsTypography as="p" variant="paragraph-mini-bold" className="sourceBadge__popoverType">
            {sourceTypeLabel(source.kind)}
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small-bold" className="sourceBadge__popoverName">
            {name}
          </DsTypography>
          {isLink ? (
            <a className="sourceBadge__popoverLink" href={source.value} target="_blank" rel="noreferrer">
              <span className="sourceBadge__popoverUrl">{source.value}</span>
              <ExternalLink size={12} aria-hidden />
            </a>
          ) : source.value !== name ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="sourceBadge__popoverMeta">
              {source.value}
            </DsTypography>
          ) : null}
          {source.context.trim() ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="sourceBadge__popoverContext">
              {source.context}
            </DsTypography>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
