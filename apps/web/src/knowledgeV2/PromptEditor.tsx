import { Check, Search, TrendingDown, TrendingUp } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { computeAnchoredPosition, type PopoverPosition } from "../accelerator/popoverPosition";
import { slotTooltip, type PromptSegment, type SlotOption } from "./promptSlots";
import { useFloatingTip } from "./Tip";

/** What a pick puts in a slot. */
type Picked = { value: string; group?: string; hint?: string };

export type PromptEditorHandle = { focus: () => void };

/*
 * The prompt box's text field: plain text plus inline slot chips. It's a
 * contentEditable whose DOM is built from `value` only when `value` changes
 * from outside (a prefill, a pick, a clear); while the user types, the DOM is
 * read back into segments and React leaves it alone, so the caret never jumps.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Lucide's chevron-down, drawn by hand since chips are built outside React. */
function chevronDown(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "m6 9 6 6 6-6");
  svg.append(path);
  return svg;
}

function buildDom(editor: HTMLElement, segments: PromptSegment[]) {
  const nodes: Node[] = segments.map((segment) => {
    if (segment.type === "text") return document.createTextNode(segment.text);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.contentEditable = "false";
    chip.className = segment.value ? "kb2Slot" : "kb2Slot kb2Slot--empty";
    chip.dataset.slot = segment.id;
    chip.dataset.label = segment.label;
    if (segment.value) chip.dataset.value = segment.value;
    if (segment.group) chip.dataset.group = segment.group;
    if (segment.hint) chip.dataset.hint = segment.hint;
    chip.setAttribute("aria-haspopup", "listbox");
    chip.setAttribute("aria-label", segment.value ? `${slotTooltip(segment)}: ${segment.value}. Change` : `Choose ${segment.label}`);
    const text = document.createElement("span");
    text.className = "kb2Slot__text";
    text.textContent = segment.value ?? segment.label;
    chip.append(text, chevronDown());
    return chip;
  });
  editor.replaceChildren(...nodes);
}

function readDom(editor: HTMLElement): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last?.type === "text") last.text += text;
    else segments.push({ type: "text", text });
  };
  const walk = (node: Node, isFirstBlock: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? "");
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.slot) {
      segments.push({
        type: "slot",
        id: node.dataset.slot,
        label: node.dataset.label ?? "",
        value: node.dataset.value,
        group: node.dataset.group,
        hint: node.dataset.hint,
      });
      return;
    }
    if (node.tagName === "BR") {
      pushText("\n");
      return;
    }
    // Browsers sometimes wrap new lines in <div>s.
    if ((node.tagName === "DIV" || node.tagName === "P") && !isFirstBlock) pushText("\n");
    node.childNodes.forEach((child, i) => walk(child, i === 0));
  };
  editor.childNodes.forEach((child, i) => walk(child, i === 0));
  // A lone trailing <br> is the browser's placeholder for an empty line.
  const last = segments[segments.length - 1];
  if (last?.type === "text" && last.text === "\n" && segments.length === 1) return [];
  return segments;
}

function placeCaretAtEnd(editor: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export const PromptEditor = forwardRef<
  PromptEditorHandle,
  {
    value: PromptSegment[];
    onChange: (next: PromptSegment[]) => void;
    onSubmit: () => void;
    placeholder: string;
    label: string;
    getOptions: (slotLabel: string) => SlotOption[];
    /** The chip menu lives outside the form; keep the box "focused" while it's open. */
    onPickerOpenChange: (open: boolean) => void;
  }
>(function PromptEditor({ value, onChange, onSubmit, placeholder, label, getOptions, onPickerOpenChange }, ref) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const rendered = useRef<string>("");
  // After a pick, the slot whose chip the caret should land after.
  const caretAfterSlot = useRef<string | null>(null);
  const [picker, setPicker] = useState<{ slotId: string; label: string; value?: string; anchor: HTMLElement } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        placeCaretAtEnd(editor);
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const json = JSON.stringify(value);
    if (json === rendered.current) return;
    rendered.current = json;
    buildDom(editor, value);
    const chip = caretAfterSlot.current ? editor.querySelector<HTMLElement>(`[data-slot="${caretAfterSlot.current}"]`) : null;
    caretAfterSlot.current = null;
    if (chip) {
      // Back to typing right after the chip that was just filled — in the same
      // commit, so keys pressed straight after picking aren't lost.
      editor.focus();
      const range = document.createRange();
      range.setStartAfter(chip);
      range.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    } else if (document.activeElement === editor) {
      placeCaretAtEnd(editor);
    }
  }, [value]);

  useEffect(() => onPickerOpenChange(picker !== null), [picker, onPickerOpenChange]);

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = readDom(editor);
    rendered.current = JSON.stringify(next);
    onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    } else if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      document.execCommand("insertLineBreak");
    }
  };

  const openSlot = (chip: HTMLElement) => {
    setPicker({ slotId: chip.dataset.slot!, label: chip.dataset.label ?? "", value: chip.dataset.value, anchor: chip });
  };

  const pick = (slotId: string, picked: Picked) => {
    const next = value.map((s) =>
      s.type === "slot" && s.id === slotId ? { ...s, value: picked.value, group: picked.group, hint: picked.hint } : s,
    );
    caretAfterSlot.current = slotId;
    setPicker(null);
    onChange(next);
  };

  // Hovering a chip names what its value is — same tooltip as the icon buttons.
  const tip = useFloatingTip();
  const chipAt = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-slot]") ?? null;
  const showChipTip = (chip: HTMLElement) =>
    tip.show(
      chip,
      slotTooltip({ label: chip.dataset.label ?? "", value: chip.dataset.value, group: chip.dataset.group, hint: chip.dataset.hint }),
    );

  const isEmpty = value.length === 0 || (value.length === 1 && value[0]!.type === "text" && value[0]!.text === "");

  return (
    <>
      <div
        ref={editorRef}
        className="slotIntake__composerTextarea kb2Editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        data-empty={isEmpty}
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          // Plain text only — no pasted formatting in the prompt.
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
        onClick={(event) => {
          const chip = chipAt(event.target);
          if (!chip) return;
          tip.hide();
          openSlot(chip);
        }}
        onMouseOver={(event) => {
          const chip = chipAt(event.target);
          // Not over the chip whose menu is already open.
          if (chip && chip !== chipAt(event.relatedTarget) && picker?.anchor !== chip) showChipTip(chip);
        }}
        onMouseOut={(event) => {
          const chip = chipAt(event.target);
          if (chip && chip !== chipAt(event.relatedTarget)) tip.hide();
        }}
        onFocus={(event) => {
          const chip = chipAt(event.target);
          if (chip?.matches(":focus-visible")) showChipTip(chip);
        }}
        onBlur={(event) => {
          if (chipAt(event.target)) tip.hide();
        }}
      />
      {tip.tooltip}
      {picker ? (
        <SlotPicker
          anchor={picker.anchor}
          label={picker.label}
          current={picker.value}
          options={getOptions(picker.label)}
          onPick={(picked) => pick(picker.slotId, picked)}
          onClose={() => {
            setPicker(null);
            picker.anchor.focus();
          }}
        />
      ) : null}
    </>
  );
});

// ── Chip menu ───────────────────────────────────────────────────────────────

/** What a list item puts in its chip; typed-in values carry no group or detail. */
function pickedFrom(item: SlotOption & { typed: boolean }): Picked {
  if (item.typed) return { value: item.value };
  const hint = [item.hint, item.change?.delta].filter(Boolean).join(" · ") || undefined;
  return { value: item.value, group: item.group, hint };
}

function SlotPicker({
  anchor,
  label,
  current,
  options,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  label: string;
  current?: string;
  options: SlotOption[];
  onPick: (picked: Picked) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.value} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const typed = query.trim();
  const offerTyped = typed && !options.some((o) => o.value.toLowerCase() === typed.toLowerCase());
  const items = [...filtered.map((o) => ({ ...o, typed: false })), ...(offerTyped ? [{ value: typed, group: "", typed: true }] : [])];

  useLayoutEffect(() => setPosition(computeAnchoredPosition(anchor, 320)), [anchor]);
  useEffect(() => {
    if (position) inputRef.current?.focus();
  }, [position]);
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) onPick(pickedFrom(item));
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  if (!position) return null;
  let lastGroup = "";
  return createPortal(
    <div
      ref={menuRef}
      className="kb2SlotPicker"
      data-placement={position.placement}
      style={{ top: position.top, bottom: position.bottom, left: position.left, maxHeight: position.maxHeight }}
    >
      <div className="kb2SlotPicker__search">
        <Search size={14} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={options.length ? `Search or type a ${label}…` : `Type a ${label}…`}
          aria-label={`Choose ${label}`}
          aria-controls="kb2-slot-options"
          aria-activedescendant={items[active] ? `kb2-slot-option-${active}` : undefined}
          role="combobox"
          aria-expanded="true"
        />
      </div>
      <ul id="kb2-slot-options" role="listbox" aria-label={label} className="kb2SlotPicker__list">
        {items.length === 0 ? <li className="kb2SlotPicker__empty">Start typing to add your own.</li> : null}
        {items.map((item, index) => {
          const header = !item.typed && item.group !== lastGroup ? item.group : null;
          lastGroup = item.typed ? lastGroup : item.group;
          return (
            <li key={`${item.group}:${item.value}:${item.typed}`} role="presentation">
              {header ? <span className="kb2SlotPicker__group">{header}</span> : null}
              <button
                id={`kb2-slot-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                data-index={index}
                className="kb2SlotPicker__option"
                onMouseEnter={() => setActive(index)}
                onClick={() =>
                  onPick(pickedFrom(item))
                }
              >
                <span className="kb2SlotPicker__value">{item.typed ? `Use “${item.value}”` : item.value}</span>
                {/* Next to the name, so the right edge stays the details column. */}
                {item.value === current ? <Check size={14} className="kb2SlotPicker__check" aria-hidden /> : null}
                {"hint" in item && item.hint ? <span className="kb2SlotPicker__hint">{item.hint}</span> : null}
                {"change" in item && item.change ? (
                  <span className={`kb2SlotPicker__delta kb2Trend--${item.change.trend}`}>
                    {item.change.delta}
                    <span className="accelerator__srOnly">{item.change.trend === "up" ? " (good)" : " (needs attention)"}</span>
                    {/* Last, so the arrows form one column on the right edge. */}
                    {item.change.trend === "up" ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
