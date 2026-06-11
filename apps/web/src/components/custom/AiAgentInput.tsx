import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Component } from "lucide-react";
import { AiAttachment, type AiAttachmentKind } from "./AiAttachment";
import { DsButton } from "../ds/Button";
import { COMPONENT_REGISTRY } from "../../component-registry";
import "./AiAgentInput.css";

type SourceKind = Extract<AiAttachmentKind, "figma" | "ticket" | "component">;

export type AiAgentInputSource = {
  id: string;
  kind: SourceKind;
  href: string;
  context: string;
  componentId?: string;
};

export type AiAgentInputSendPayload = {
  message: string;
  sources: readonly AiAgentInputSource[];
};

export type AiAgentInputProps = {
  className?: string;
  placeholder?: string;
  onSend?: (payload: AiAgentInputSendPayload) => void;
};

const PROMPT_MAX_HEIGHT_PX = 500;

function isValidSource(kind: SourceKind, href: string, componentId?: string): boolean {
  if (kind === "component") return Boolean(componentId);
  if (kind === "ticket") return /[A-Z][A-Z0-9]+-\d+/i.test(href.trim());
  try {
    const parsed = new URL(href);
    return parsed.hostname.includes("figma.com");
  } catch {
    return false;
  }
}

export function AiAgentInput({
  className,
  placeholder = "What are you working on today?",
  onSend,
}: AiAgentInputProps) {
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<readonly AiAgentInputSource[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<SourceKind>("ticket");
  const [pendingHref, setPendingHref] = useState("");
  const [pendingContext, setPendingContext] = useState("");
  const [pendingComponentSearch, setPendingComponentSearch] = useState("");
  const [pendingComponentId, setPendingComponentId] = useState<string | null>(null);
  const addSourceRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = message.trim().length > 0 || sources.length > 0;
  const pendingComponentEntry = useMemo(
    () => COMPONENT_REGISTRY.find((e) => e.id === pendingComponentId) ?? null,
    [pendingComponentId],
  );
  const filteredComponents = useMemo(() => {
    const q = pendingComponentSearch.trim().toLowerCase();
    if (!q) return COMPONENT_REGISTRY.slice(0, 12);
    return COMPONENT_REGISTRY.filter(
      (e) => e.title.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
    ).slice(0, 12);
  }, [pendingComponentSearch]);

  const pendingValid =
    pendingKind === "component"
      ? Boolean(pendingComponentEntry)
      : isValidSource(pendingKind, pendingHref);

  const syncPromptHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, PROMPT_MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > PROMPT_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncPromptHeight();
  }, [message, syncPromptHeight]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!addSourceRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [dropdownOpen]);

  const openModal = (kind: SourceKind) => {
    setPendingKind(kind);
    setPendingHref("");
    setPendingContext("");
    setPendingComponentSearch("");
    setPendingComponentId(null);
    setDropdownOpen(false);
    setModalOpen(true);
  };

  const addSource = () => {
    if (!pendingValid) return;
    const href =
      pendingKind === "component" ? (pendingComponentEntry?.title ?? "") : pendingHref.trim();
    setSources((prev) => [
      ...prev,
      {
        id: `source-${Date.now()}`,
        kind: pendingKind,
        href,
        context: pendingContext.trim(),
        componentId: pendingKind === "component" ? pendingComponentEntry?.id : undefined,
      },
    ]);
    setModalOpen(false);
  };

  const rootClass = ["aiAgentInput", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <div className="aiAgentInput__main">
        <div className="aiAgentInput__sourcesRow">
          {sources.length > 0 ? (
            <div className="aiAgentInput__attachments">
              {sources.map((source) => (
                <AiAttachment
                  key={source.id}
                  size="tag"
                  kind={source.kind}
                  href={source.kind === "component" ? null : source.href}
                  value={source.href}
                  subtitle={
                    source.kind === "ticket" ? "Ticket" : source.kind === "figma" ? "Figma" : "Component"
                  }
                  icon={
                    source.kind === "component" ? <Component size={16} strokeWidth={1.8} aria-hidden /> : undefined
                  }
                  onRemove={() => setSources((prev) => prev.filter((s) => s.id !== source.id))}
                />
              ))}
            </div>
          ) : null}
          <div className="aiAgentInput__addSourceWrap" ref={addSourceRef}>
            <DsButton variant="secondary" size="small" type="button" onClick={() => setDropdownOpen((o) => !o)}>
              Add source
            </DsButton>
            {dropdownOpen ? (
              <div className="aiAgentInput__dropdown" role="menu">
                <button type="button" onClick={() => openModal("ticket")}>
                  Ticket
                </button>
                <button type="button" onClick={() => openModal("figma")}>
                  Figma
                </button>
                <button type="button" onClick={() => openModal("component")}>
                  Component
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <label className="aiAgentInput__inputShell">
          <textarea
            ref={textareaRef}
            className="aiAgentInput__textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            rows={2}
          />
        </label>
      </div>
      <div className="aiAgentInput__sendCol">
        <DsButton
          variant="primary"
          size="regular"
          type="button"
          disabled={!canSend}
          aria-label="Send"
          onClick={() => canSend && onSend?.({ message: message.trim(), sources })}
          rightIcon={<ArrowRight size={18} aria-hidden />}
        >
          Send
        </DsButton>
      </div>

      {modalOpen ? (
        <div className="aiAgentInput__modalRoot" role="dialog" aria-modal="true" aria-label="Add source">
          <button type="button" className="aiAgentInput__modalBackdrop" onClick={() => setModalOpen(false)} aria-label="Close" />
          <div className="aiAgentInput__modal">
            <h3 className="aiAgentInput__modalTitle">
              Add {pendingKind === "figma" ? "Figma" : pendingKind === "ticket" ? "ticket" : "component"} source
            </h3>
            <div className="aiAgentInput__modalFields">
              {pendingKind === "component" ? (
                <>
                  <label className="aiAgentInput__field">
                    <span className="aiAgentInput__fieldLabel">Search component</span>
                    <input
                      className="aiAgentInput__fieldInput"
                      value={pendingComponentSearch}
                      onChange={(e) => setPendingComponentSearch(e.target.value)}
                      placeholder="Type component name"
                    />
                  </label>
                  <div className="aiAgentInput__componentResults">
                    {filteredComponents.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={
                          pendingComponentId === entry.id
                            ? "aiAgentInput__componentOption aiAgentInput__componentOption--selected"
                            : "aiAgentInput__componentOption"
                        }
                        onClick={() => setPendingComponentId(entry.id)}
                      >
                        <span className="aiAgentInput__componentOptionTitle">{entry.title}</span>
                        <span className="aiAgentInput__componentOptionId">{entry.id}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <label className="aiAgentInput__field">
                  <span className="aiAgentInput__fieldLabel">
                    {pendingKind === "ticket" ? "Ticket key or link" : "Figma URL"}
                  </span>
                  <input
                    className="aiAgentInput__fieldInput"
                    value={pendingHref}
                    onChange={(e) => setPendingHref(e.target.value)}
                    placeholder={pendingKind === "ticket" ? "DS-042" : "https://www.figma.com/design/…"}
                  />
                </label>
              )}
              <label className="aiAgentInput__field">
                <span className="aiAgentInput__fieldLabel">Additional context (optional)</span>
                <textarea
                  className="aiAgentInput__contextInput"
                  value={pendingContext}
                  onChange={(e) => setPendingContext(e.target.value)}
                  rows={3}
                />
              </label>
            </div>
            <div className="aiAgentInput__modalActions">
              <DsButton variant="ghost" size="small" type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </DsButton>
              <DsButton variant="primary" size="small" type="button" disabled={!pendingValid} onClick={addSource}>
                Add source
              </DsButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
