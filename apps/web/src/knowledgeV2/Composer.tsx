import { ArrowUp, Bot, ChartLine, FileText, Lightbulb, Paperclip, Radar, type LucideIcon } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ProviderPicker } from "../accelerator/ProviderPicker";
import { fetchAgentProviders, type AgentProvider } from "../agentSseClient";
import { resolveSelectedProvider, saveSelectedProvider } from "../aiProviders/providerSelection";
import { AiAttachment } from "../components/custom/AiAttachment";
import { DsIconButton } from "../components/ds/IconButton";
import { DsTypography } from "../components/ds/DsTypography";
import { SourceMark } from "../knowledge/SourceMark";
import { SourcesPopover } from "../knowledge/SourcesPopover";
import { sourceById } from "../knowledge/sources";
import { openSettings } from "../navigationEvents";
import type { ContextRef, Initiative, Starter } from "./data";
import { PromptEditor, type PromptEditorHandle } from "./PromptEditor";
import { promptText, slotOptions, type PromptSegment } from "./promptSlots";
import { Tip } from "./Tip";

export type Attachment =
  | { kind: "source"; id: string }
  | { kind: "file"; id: string; name: string }
  | { kind: "context"; id: string; ref: ContextRef };

const PROVIDER_SCOPE = "knowledge-base-v2";
const QUICK_SOURCE_IDS = ["jira", "figma"];

const CONTEXT_ICONS: Record<ContextRef["kind"], LucideIcon> = {
  initiative: Lightbulb,
  metric: ChartLine,
  signal: Radar,
  template: FileText,
  agent: Bot,
  file: Paperclip,
};

const CONTEXT_SUBTITLES: Record<ContextRef["kind"], string> = {
  initiative: "Initiative",
  metric: "Metric",
  signal: "Insight",
  template: "Template",
  agent: "Agent",
  file: "File",
};

export type ComposerHandle = { focus: () => void };

const RESIZE_MS = 280;
const RESIZE_EASING = "cubic-bezier(0.2, 0, 0, 1)";

type Layout = { height: number; radius: number; send: DOMRect | null };

/**
 * The v2 prompt box — the same composer as v1 (+ for every source, Jira and
 * Figma one click away), plus "context" chips: initiatives, metrics and
 * insights the user pulled in from the cards above.
 *
 * `compact` collapses it to a one-line box with just the send button, for
 * while it floats over content. The text field stays mounted in both states so
 * clicking into the compact box keeps focus as it expands.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    value: PromptSegment[];
    onChange: (value: PromptSegment[]) => void;
    /** For the slot chips' lists (initiatives change as users move them along). */
    initiatives: Initiative[];
    attachments: Attachment[];
    onAttachmentsChange: (next: Attachment[]) => void;
    onSubmit: () => void;
    placeholder: string;
    label: string;
    compact?: boolean;
    /** Fires when focus enters or leaves the box (chips and menus included). */
    onFocusWithinChange?: (focused: boolean) => void;
  }
>(function Composer(
  {
    value,
    onChange,
    initiatives,
    attachments,
    onAttachmentsChange,
    onSubmit,
    placeholder,
    label,
    compact = false,
    onFocusWithinChange,
  },
  ref,
) {
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<PromptEditorHandle | null>(null);
  // The slot chip menu renders outside the form; while it's open the box
  // still counts as focused.
  const pickerOpen = useRef(false);
  const hasText = promptText(value).trim().length > 0;
  const formRef = useRef<HTMLFormElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const lastLayout = useRef<Layout | null>(null);
  const lastCompact = useRef(compact);
  const animating = useRef(false);
  const attachedSourceIds = new Set(attachments.filter((a) => a.kind === "source").map((a) => a.id));

  useImperativeHandle(ref, () => ({ focus: () => editorRef.current?.focus() }), []);

  const onPickerOpenChange = useCallback(
    (open: boolean) => {
      pickerOpen.current = open;
      if (open) return;
      // Closing the menu by clicking elsewhere drops focus without a blur event.
      window.requestAnimationFrame(() => {
        if (!formRef.current?.contains(document.activeElement)) onFocusWithinChange?.(false);
      });
    },
    [onFocusWithinChange],
  );

  // Compact ↔ full is a layout swap (one row ↔ text over toolbar), so it's
  // animated FLIP-style: remember the last layout, and when `compact` flips,
  // play the height, corner radius and the send button's move from there to
  // the new layout — all in one timeline so they stay in step. The chips and
  // engine picker fade/slide in on mount via CSS.
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const measure = (): Layout => {
      const height = form.getBoundingClientRect().height;
      // The pill uses the "full" radius token (9999px). Anything past half the
      // height looks the same, so cap it there — otherwise the animation
      // spends almost all its time on invisible radii and snaps at the end.
      const radius = Math.min(parseFloat(getComputedStyle(form).borderTopLeftRadius) || 0, height / 2);
      return { height, radius, send: actionsRef.current?.lastElementChild?.getBoundingClientRect() ?? null };
    };
    const before = lastLayout.current;
    const changed = lastCompact.current !== compact;
    lastCompact.current = compact;
    if (!changed) {
      if (!animating.current) lastLayout.current = measure();
      return;
    }
    const after = measure();
    lastLayout.current = after;
    if (!before || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const options = { duration: RESIZE_MS, easing: RESIZE_EASING };
    animating.current = true;
    form.style.overflow = "hidden";
    const resize = form.animate(
      [
        { height: `${before.height}px`, borderRadius: `${before.radius}px` },
        { height: `${after.height}px`, borderRadius: `${after.radius}px` },
      ],
      options,
    );
    const send = actionsRef.current?.lastElementChild as HTMLElement | null | undefined;
    if (send && before.send && after.send) {
      const dx = before.send.right - after.send.right;
      const dy = before.send.top - after.send.top;
      send.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], options);
    }
    resize.onfinish = resize.oncancel = () => {
      form.style.overflow = "";
      animating.current = false;
      lastLayout.current = measure();
    };
  }, [compact, attachments.length, providers.length]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAgentProviders({ signal: controller.signal })
      .then((list) => {
        setProviders(list);
        setSelectedProvider(resolveSelectedProvider(PROVIDER_SCOPE, list));
      })
      .catch(() => {
        // Agent service unreachable — the composer simply shows no engine picker.
      });
    return () => controller.abort();
  }, []);

  const toggleSource = (id: string) => {
    onAttachmentsChange(
      attachedSourceIds.has(id)
        ? attachments.filter((a) => !(a.kind === "source" && a.id === id))
        : [...attachments, { kind: "source", id }],
    );
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added: Attachment[] = Array.from(files).map((file) => ({
      kind: "file",
      id: `${file.name}:${file.size}:${file.lastModified}`,
      name: file.name,
    }));
    onAttachmentsChange([...attachments, ...added.filter((f) => !attachments.some((a) => a.id === f.id))]);
  };

  return (
    <form
      ref={formRef}
      className={`slotIntake__composer kb2Composer${compact ? " kb2Composer--compact" : ""}`}
      onClick={(event) => {
        // The whole compact box reads as a text field; clicking anywhere on it expands it.
        if (compact && event.target === event.currentTarget) editorRef.current?.focus();
      }}
      onFocus={() => onFocusWithinChange?.(true)}
      onBlur={(event) => {
        if (pickerOpen.current) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFocusWithinChange?.(false);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (hasText) onSubmit();
      }}
    >
      {attachments.length > 0 && !compact ? (
        <div className="slotIntake__composerAttachments">
          {attachments.map((attachment) => {
            const remove = () => onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
            if (attachment.kind === "file") {
              return (
                <AiAttachment
                  key={attachment.id}
                  size="tag"
                  kind="comment"
                  value={attachment.name}
                  subtitle="File"
                  title={attachment.name}
                  onRemove={remove}
                />
              );
            }
            if (attachment.kind === "context") {
              const Icon = CONTEXT_ICONS[attachment.ref.kind];
              return (
                <AiAttachment
                  key={attachment.id}
                  size="tag"
                  value={attachment.ref.label}
                  subtitle={CONTEXT_SUBTITLES[attachment.ref.kind]}
                  title={attachment.ref.label}
                  icon={<Icon size={16} strokeWidth={1.8} aria-hidden />}
                  onRemove={remove}
                />
              );
            }
            const source = sourceById(attachment.id);
            return (
              <AiAttachment
                key={attachment.id}
                size="tag"
                value={source.label}
                subtitle="Source"
                icon={<SourceMark source={source} size={16} />}
                onRemove={remove}
              />
            );
          })}
        </div>
      ) : null}
      <PromptEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        onSubmit={() => formRef.current?.requestSubmit()}
        placeholder={placeholder}
        label={label}
        getOptions={(slotLabel) => slotOptions(slotLabel, initiatives)}
        onPickerOpenChange={onPickerOpenChange}
      />
      <div className="slotIntake__composerToolbar">
        {compact ? null : (
          <div className="slotIntake__composerAttachButtons">
            <Tip label="Add sources or files">
              <SourcesPopover
                selectedIds={attachedSourceIds}
                onToggle={toggleSource}
                onUpload={() => fileInputRef.current?.click()}
              />
            </Tip>
            {QUICK_SOURCE_IDS.filter((id) => !attachedSourceIds.has(id))
              .map(sourceById)
              .map((source) => (
                <button key={source.id} type="button" className="slotIntake__attachChip" onClick={() => toggleSource(source.id)}>
                  <SourceMark source={source} size={13} />
                  {source.label}
                </button>
              ))}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        )}
        <div className="slotIntake__composerActions" ref={actionsRef}>
          {providers.length > 0 && !compact ? (
            <div className="kb2Composer__picker">
              <ProviderPicker
                providers={providers}
                selectedProviderId={selectedProvider}
                onSelect={(id) => {
                  setSelectedProvider(id);
                  saveSelectedProvider(PROVIDER_SCOPE, id);
                }}
                onManage={() => openSettings("ai-models")}
              />
            </div>
          ) : null}
          <Tip label="Send">
            <DsIconButton variant="primary" size="small" type="submit" aria-label="Send" disabled={!hasText}>
              <ArrowUp size={16} aria-hidden />
            </DsIconButton>
          </Tip>
        </div>
      </div>
    </form>
  );
});

/** "Not sure where to start?" chips under the prompt box. */
export function Starters({ starters, onPick }: { starters: Starter[]; onPick: (starter: Starter) => void }) {
  return (
    <section className="kb2Starters" aria-labelledby="kb2-starters-title">
      <DsTypography as="h2" id="kb2-starters-title" variant="heading-5" className="kb2Starters__title">
        Not sure where to start?
      </DsTypography>
      <div className="kb2Starters__list">
        {starters.map((starter) => (
          <button key={starter.label} type="button" className="kb2Chip" onClick={() => onPick(starter)}>
            <StarterIcon icon={starter.icon} />
            <DsTypography as="span" variant="paragraph-small-medium">
              {starter.label}
            </DsTypography>
          </button>
        ))}
      </div>
    </section>
  );
}

function StarterIcon({ icon }: { icon: Starter["icon"] }) {
  if ("source" in icon) return <SourceMark source={sourceById(icon.source)} size={15} />;
  const Icon = icon;
  return <Icon size={15} strokeWidth={1.8} aria-hidden />;
}

/** A row of overlapping source logos, e.g. the evidence behind an initiative. */
export function SourceStack({ ids, size = 16 }: { ids: string[]; size?: number }) {
  return (
    <span className="kb2SourceStack" aria-label={ids.map((id) => sourceById(id).label).join(", ")}>
      {ids.map((id) => (
        <Tip key={id} label={sourceById(id).label} className="kb2SourceStack__item">
          <SourceMark source={sourceById(id)} size={size} />
        </Tip>
      ))}
    </span>
  );
}

/** A tiny trend line; colour comes from `currentColor`. */
export function Sparkline({ series, width = 120, height = 36 }: { series: number[]; width?: number; height?: number }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  // 3px inset on every side so the end dot isn't clipped.
  const step = (width - 6) / (series.length - 1);
  const points = series.map((v, i) => [3 + i * step, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  return (
    <svg className="kb2Sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={`${line} L${last[0]},${height} L3,${height} Z`} fill="currentColor" opacity="0.08" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="currentColor" />
    </svg>
  );
}
