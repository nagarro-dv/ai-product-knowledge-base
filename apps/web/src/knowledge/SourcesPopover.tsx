import { Check, Plus, Search } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeAnchoredPosition, type PopoverPosition } from "../accelerator/popoverPosition";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "./SourceMark";
import { SOURCE_GROUPS, UPLOAD_SOURCE_ID } from "./sources";
import "./SourcesPopover.css";

/**
 * The "+" button in the Knowledge Base prompt box, before the quick Jira and
 * Figma chips. Opens a grouped, searchable popover of every product-knowledge
 * source (file upload included), since there are far too many sources to keep
 * on screen. Stays open while the user picks
 * several; each pick toggles that source on the prompt.
 */
export function SourcesPopover({
  selectedIds,
  onToggle,
  onUpload,
}: {
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onUpload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SOURCE_GROUPS;
    return SOURCE_GROUPS.map((group) => ({
      ...group,
      sources: group.sources.filter((s) => s.label.toLowerCase().includes(q)),
    })).filter((group) => group.sources.length > 0);
  }, [query]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(computeAnchoredPosition(triggerRef.current, 440));
  }, [open]);

  useEffect(() => {
    if (open && position) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div className="sourcesPopover">
      <button
        ref={triggerRef}
        type="button"
        className="slotIntake__attachChip slotIntake__attachChip--icon"
        aria-label="Add references"
        title="Add references"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="knowledge-sources-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={16} aria-hidden />
      </button>

      {open && position ? (
        <div
          id="knowledge-sources-menu"
          ref={popoverRef}
          role="dialog"
          aria-label="Product knowledge sources"
          className="sourcesPopover__menu"
          style={{ top: position.top, bottom: position.bottom, left: position.left, maxHeight: position.maxHeight }}
        >
          <div className="sourcesPopover__search">
            <Search size={14} aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sources…"
              aria-label="Search sources"
              className="sourcesPopover__searchInput"
            />
          </div>
          <div className="sourcesPopover__list">
            {visibleGroups.length === 0 ? (
              <DsTypography as="p" variant="paragraph-small" className="sourcesPopover__empty">
                No sources match "{query}".
              </DsTypography>
            ) : null}
            {visibleGroups.map((group) => (
              <div key={group.label} className="sourcesPopover__group" role="group" aria-label={group.label}>
                <span className="sourcesPopover__groupLabel">{group.label}</span>
                {group.sources.map((source) => {
                  const { id, label } = source;
                  const isUpload = id === UPLOAD_SOURCE_ID;
                  const isSelected = !isUpload && selectedIds.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="sourcesPopover__row"
                      aria-pressed={isUpload ? undefined : isSelected}
                      onClick={() => {
                        if (isUpload) {
                          setOpen(false);
                          onUpload();
                        } else {
                          onToggle(id);
                        }
                      }}
                    >
                      <span
                        className={`sourcesPopover__rowIcon${typeof source.mark === "string" ? " sourcesPopover__rowIcon--logo" : ""}`}
                      >
                        <SourceMark source={source} size={14} />
                      </span>
                      <DsTypography as="span" variant="paragraph-small" className="sourcesPopover__rowLabel">
                        {label}
                      </DsTypography>
                      {isSelected ? <Check size={15} className="sourcesPopover__rowCheck" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
