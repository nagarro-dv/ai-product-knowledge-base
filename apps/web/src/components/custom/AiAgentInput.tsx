import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Component, Figma, Search as SearchIcon, Ticket } from "lucide-react";
import { AiAttachment, type AiAttachmentKind } from "./AiAttachment";
import { ComponentPicker } from "./ComponentPicker";
import { JiraTicketPicker } from "./JiraTicketPicker";
import { SOURCE_MODAL_CONFIRM_LABEL, SOURCE_MODAL_SUBTITLE, SourceModal } from "./SourceModal";
import { DsButton } from "../ds/Button";
import { DsIconButton } from "../ds/IconButton";
import { DsSpinner } from "../ds/Spinner";
import { DsTypography } from "../ds/DsTypography";
import { sourceChipName, sourceTypeLabel } from "../../accelerator/source-format";
import { fetchIntegrations, startJiraConnect } from "../../integrations/jiraClient";
import type { JiraTicketDetail } from "../../integrations/jiraClient";
import {
  connectStorybook,
  formatStorybookComponentContext,
  listStorybookComponents,
  type StorybookComponent,
  type StorybookSummary,
} from "../../integrations/storybookClient";
import type { SourceRole } from "../../accelerator/types";
import "./AiAgentInput.css";

/**
 * Broader than AiAttachmentKind (which only covers rendering/icon lookup) —
 * this composer's own dropdown only ever creates figma/ticket/component, but
 * the type is shared with SlotIntake.tsx, whose slots can also produce
 * "doc" and "note" sources.
 */
type SourceKind = "figma" | "ticket" | "component" | "doc" | "note";
/** The subset this composer's own "Add source" dropdown offers. */
type ComposerSourceKind = Extract<AiAttachmentKind, "figma" | "ticket" | "component">;

/** Structured metadata carried when a component source comes from a connected Storybook. */
export type StorybookSourceMeta = {
  url: string;
  componentPath: string;
  storyIds: string[];
  storyNames: string[];
  importPath?: string;
};

/**
 * This composer is used only for AMENDMENTS to an already-running request
 * (the checkpoint's "Add context", direction comparison's "Refine") — the
 * initial slot-based intake lives in SlotIntake.tsx instead. A ticket added
 * here is a new requirement, a Figma/component link is a new reference; the
 * subject itself is already fixed by the time this composer is in play.
 */
const DEFAULT_ROLE_BY_KIND: Record<SourceKind, SourceRole> = {
  ticket: "requirement",
  figma: "reference",
  component: "reference",
  doc: "reference",
  note: "requirement",
};

export type AiAgentInputSource = {
  id: string;
  kind: SourceKind;
  role: SourceRole;
  href: string;
  context: string;
  /** Short human-readable preview shown on the source's chip — a ticket's title, a component's file path. */
  preview?: string;
  /** Present for component sources — they always come from the connected Storybook. */
  storybook?: StorybookSourceMeta;
};

export type AiAgentInputSendPayload = {
  message: string;
  sources: readonly AiAgentInputSource[];
};

export type AiAgentInputProps = {
  className?: string;
  placeholder?: string;
  onSend?: (payload: AiAgentInputSendPayload) => void;
  /** External text to load into the composer (e.g. an example-prompt chip). Re-applies whenever the value changes. */
  prefill?: string;
  /** External sources to load into the composer (e.g. restoring a history entry). Re-applies whenever the array reference changes. */
  prefillSources?: readonly AiAgentInputSource[];
  /** Fires whenever the composer text changes — lets the parent hide "empty state" affordances once the user starts typing. */
  onMessageChange?: (message: string) => void;
  /** Label for the primary action. Defaults to "Send"; e.g. "Update analysis" when embedded at the review checkpoint. */
  sendLabel?: string;
};

const PROMPT_MAX_HEIGHT_PX = 500;

function isValidSource(kind: ComposerSourceKind, href: string): boolean {
  if (kind === "component") return false; // component validity is decided by the Storybook picker selection
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
  prefill,
  prefillSources,
  onMessageChange,
  sendLabel = "Send",
}: AiAgentInputProps) {
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<readonly AiAgentInputSource[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<ComposerSourceKind>("ticket");
  const [pendingHref, setPendingHref] = useState("");
  const [pendingContext, setPendingContext] = useState("");
  const [pendingComponent, setPendingComponent] = useState<StorybookComponent | null>(null);
  const [componentSearchOpen, setComponentSearchOpen] = useState(false);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<JiraTicketDetail | null>(null);
  const [pendingTicketContext, setPendingTicketContext] = useState("");
  const [sbSummary, setSbSummary] = useState<StorybookSummary | null>(null);
  const [sbComponents, setSbComponents] = useState<StorybookComponent[]>([]);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbConnectUrl, setSbConnectUrl] = useState("");
  const [sbConnecting, setSbConnecting] = useState(false);
  const [sbConnectError, setSbConnectError] = useState<string | null>(null);
  const addSourceRef = useRef<HTMLDivElement>(null);
  const addSourceButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalFirstFieldRef = useRef<HTMLInputElement>(null);

  const canSend = message.trim().length > 0 || sources.length > 0;
  const sbConnected = sbSummary?.status === "connected";
  const jiraPickerActive = pendingKind === "ticket" && jiraConnected;

  const pendingValid =
    pendingKind === "component"
      ? Boolean(pendingComponent)
      : jiraPickerActive
        ? Boolean(pendingTicket)
        : isValidSource(pendingKind, pendingHref);

  const syncPromptHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Empty textareas can report a stale scrollHeight while only the
    // placeholder is shown — fall back to the CSS min-height in that case.
    if (!el.value) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, PROMPT_MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > PROMPT_MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncPromptHeight();
  }, [message, syncPromptHeight]);

  useEffect(() => {
    window.addEventListener("resize", syncPromptHeight);
    return () => window.removeEventListener("resize", syncPromptHeight);
  }, [syncPromptHeight]);

  useEffect(() => {
    if (!prefill) return;
    setMessage(prefill);
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    if (!prefillSources) return;
    setSources(prefillSources);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSources]);

  useEffect(() => {
    onMessageChange?.(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!addSourceRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDropdownOpen(false);
      addSourceButtonRef.current?.focus();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchIntegrations({ signal: controller.signal })
      .then((list) => {
        const jira = list.find((i) => i.id === "jira");
        setJiraConfigured(Boolean(jira?.configured));
        setJiraConnected(jira?.status === "connected");
        const sb = list.find((i) => i.id === "storybook");
        if (sb) {
          setSbSummary({
            status: (sb.status === "connected" || sb.status === "error" ? sb.status : "not-connected"),
            url: sb.url,
            componentCount: sb.componentCount,
            lastIndexedAt: sb.lastIndexedAt,
            error: sb.error,
            projectTitle: sb.projectTitle,
          });
        }
      })
      .catch(() => {
        setJiraConfigured(false);
        setJiraConnected(false);
      });
    return () => controller.abort();
  }, []);

  // Load the Storybook component index when the component picker opens.
  useEffect(() => {
    if (!modalOpen || pendingKind !== "component" || !sbConnected) return;
    const controller = new AbortController();
    setSbLoading(true);
    void listStorybookComponents(undefined, { signal: controller.signal })
      .then(({ components }) => setSbComponents(components))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSbComponents([]);
      })
      .finally(() => setSbLoading(false));
    return () => controller.abort();
  }, [modalOpen, pendingKind, sbConnected]);

  useEffect(() => {
    if (!modalOpen) return;
    modalFirstFieldRef.current?.focus();
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    addSourceButtonRef.current?.focus();
  };

  const openModal = (kind: ComposerSourceKind) => {
    setPendingKind(kind);
    setPendingHref("");
    setPendingContext("");
    setPendingComponent(null);
    setComponentSearchOpen(false);
    setPendingTicket(null);
    setPendingTicketContext("");
    setSbConnectError(null);
    setDropdownOpen(false);
    setModalOpen(true);
  };

  const handleConnectStorybook = async () => {
    if (!sbConnectUrl.trim() || sbConnecting) return;
    setSbConnecting(true);
    setSbConnectError(null);
    try {
      const summary = await connectStorybook(sbConnectUrl);
      setSbSummary(summary);
      const { components } = await listStorybookComponents();
      setSbComponents(components);
    } catch (error) {
      setSbConnectError(error instanceof Error ? error.message : "Could not connect to that Storybook.");
    } finally {
      setSbConnecting(false);
    }
  };

  const addSource = () => {
    if (!pendingValid) return;
    if (pendingKind === "component" && pendingComponent) {
      const userContext = pendingContext.trim();
      const sbUrl = sbSummary?.url;
      if (!sbUrl) return;
      // Same pattern as Jira tickets: the source carries a structured
      // context block the AI can rely on, not just a display name.
      const structured = formatStorybookComponentContext(pendingComponent, sbUrl);
      setSources((prev) => [
        ...prev,
        {
          id: `source-${Date.now()}`,
          kind: "component",
          role: DEFAULT_ROLE_BY_KIND.component,
          href: pendingComponent.title,
          context: userContext ? `${structured}\n\nWhy this source: ${userContext}` : structured,
          preview: pendingComponent.importPath ?? pendingComponent.path,
          storybook: {
            url: sbUrl,
            componentPath: pendingComponent.path,
            storyIds: pendingComponent.storyIds,
            storyNames: pendingComponent.storyNames,
            importPath: pendingComponent.importPath,
          },
        },
      ]);
      closeModal();
      return;
    }
    if (jiraPickerActive) {
      if (!pendingTicket) return;
      setSources((prev) => [
        ...prev,
        {
          id: `source-${Date.now()}`,
          kind: "ticket",
          role: DEFAULT_ROLE_BY_KIND.ticket,
          href: pendingTicket.key,
          context: pendingTicketContext,
          preview: pendingTicket.title,
        },
      ]);
      closeModal();
      return;
    }
    setSources((prev) => [
      ...prev,
      {
        id: `source-${Date.now()}`,
        kind: pendingKind,
        role: DEFAULT_ROLE_BY_KIND[pendingKind],
        href: pendingHref.trim(),
        context: pendingContext.trim(),
      },
    ]);
    closeModal();
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
                  kind={source.kind === "doc" || source.kind === "note" ? "comment" : source.kind}
                  href={source.kind === "component" ? null : source.href}
                  value={sourceChipName(source.kind, source.href)}
                  subtitle={sourceTypeLabel(source.kind)}
                  preview={source.preview}
                  title={source.kind === "figma" ? source.href : undefined}
                  icon={
                    source.kind === "component" ? <Component size={16} strokeWidth={1.8} aria-hidden /> : undefined
                  }
                  onRemove={() => setSources((prev) => prev.filter((s) => s.id !== source.id))}
                />
              ))}
            </div>
          ) : null}
          <div className="aiAgentInput__addSourceWrap" ref={addSourceRef}>
            <DsButton
              ref={addSourceButtonRef}
              variant="secondary"
              size="small"
              type="button"
              aria-expanded={dropdownOpen}
              aria-controls="aiAgentInput-source-menu"
              onClick={() => setDropdownOpen((o) => !o)}
            >
              Add source
            </DsButton>
            {dropdownOpen ? (
              <div id="aiAgentInput-source-menu" className="aiAgentInput__dropdown" role="menu">
                <button type="button" onClick={() => openModal("ticket")}>
                  <Ticket size={15} strokeWidth={1.8} aria-hidden className="aiAgentInput__menuIcon" />
                  <span className="aiAgentInput__menuCopy">
                    <span className="aiAgentInput__menuTitle">Ticket</span>
                    <span className="aiAgentInput__menuHint">Paste a key like DS-042</span>
                  </span>
                </button>
                <button type="button" onClick={() => openModal("figma")}>
                  <Figma size={15} strokeWidth={1.8} aria-hidden className="aiAgentInput__menuIcon" />
                  <span className="aiAgentInput__menuCopy">
                    <span className="aiAgentInput__menuTitle">Figma design</span>
                    <span className="aiAgentInput__menuHint">Paste a Figma file link</span>
                  </span>
                </button>
                <button type="button" onClick={() => openModal("component")}>
                  <Component size={15} strokeWidth={1.8} aria-hidden className="aiAgentInput__menuIcon" />
                  <span className="aiAgentInput__menuCopy">
                    <span className="aiAgentInput__menuTitle">Component</span>
                    <span className="aiAgentInput__menuHint">Pick from this design system</span>
                  </span>
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
          <DsIconButton
            variant="primary"
            size="small"
            type="button"
            className="aiAgentInput__sendButton"
            disabled={!canSend}
            aria-label={sendLabel}
            onClick={() => canSend && onSend?.({ message: message.trim(), sources })}
          >
            <ArrowRight size={16} aria-hidden />
          </DsIconButton>
        </label>
      </div>

      {modalOpen ? (
        <SourceModal
          kind={pendingKind}
          subtitle={SOURCE_MODAL_SUBTITLE[pendingKind]}
          onClose={closeModal}
          footer={{ confirmLabel: SOURCE_MODAL_CONFIRM_LABEL[pendingKind], confirmDisabled: !pendingValid, onConfirm: addSource }}
          fixedHeight={jiraPickerActive}
          headerAction={
            pendingKind === "component" && sbConnected ? (
              <DsIconButton
                variant="ghost"
                size="small"
                aria-label="Search components"
                onClick={() => setComponentSearchOpen((open) => !open)}
              >
                <SearchIcon size={16} aria-hidden />
              </DsIconButton>
            ) : undefined
          }
        >
          {pendingKind !== "ticket" || jiraPickerActive ? null : jiraConfigured ? (
            <button type="button" className="sourceModal__jiraModeSwitch" onClick={() => startJiraConnect()}>
              Connect Jira to search tickets
            </button>
          ) : (
            <DsTypography as="p" variant="paragraph-mini-regular" className="aiAgentInput__jiraSetupNote">
              Jira isn't set up on the assistant service yet — an admin can enable it from Settings → Integrations
              (it needs an Atlassian OAuth app).
            </DsTypography>
          )}

          {jiraPickerActive ? (
            <JiraTicketPicker
              onPreviewChange={(ticket, formattedContext) => {
                setPendingTicket(ticket);
                setPendingTicketContext(formattedContext);
              }}
            />
          ) : pendingKind === "component" ? (
            !sbConnected ? (
              <div className="sourceModal__sbConnect">
                <DsTypography as="span" variant="paragraph-small-bold">
                  Connect your Storybook
                </DsTypography>
                <input
                  ref={modalFirstFieldRef}
                  className="sourceModal__fieldInput"
                  value={sbConnectUrl}
                  onChange={(e) => setSbConnectUrl(e.target.value)}
                  placeholder="http://localhost:6006 or https://…"
                  aria-label="Storybook URL"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleConnectStorybook();
                  }}
                />
                <DsButton
                  variant="secondary"
                  size="small"
                  type="button"
                  disabled={sbConnecting || !sbConnectUrl.trim()}
                  onClick={() => void handleConnectStorybook()}
                  leftIcon={sbConnecting ? <DsSpinner size={12} aria-hidden /> : undefined}
                >
                  {sbConnecting ? "Connecting…" : "Connect"}
                </DsButton>
                {sbConnectError ? (
                  <DsTypography as="p" variant="paragraph-mini-regular" role="alert">
                    {sbConnectError}
                  </DsTypography>
                ) : null}
              </div>
            ) : (
              <ComponentPicker
                components={sbComponents}
                loading={sbLoading}
                selected={pendingComponent}
                onSelect={setPendingComponent}
                inputRef={modalFirstFieldRef}
                searchOpen={componentSearchOpen}
                onSearchOpenChange={setComponentSearchOpen}
              />
            )
          ) : (
            <>
              <label className="sourceModal__field">
                <span>{pendingKind === "ticket" ? "Ticket key or link" : "Figma URL"}</span>
                <input
                  ref={modalFirstFieldRef}
                  className="sourceModal__fieldInput"
                  value={pendingHref}
                  onChange={(e) => setPendingHref(e.target.value)}
                  placeholder={pendingKind === "ticket" ? "DS-042" : "https://www.figma.com/design/…"}
                />
              </label>
              <label className="sourceModal__field">
                <span>Additional context (optional)</span>
                <textarea
                  className="sourceModal__contextInput"
                  value={pendingContext}
                  onChange={(e) => setPendingContext(e.target.value)}
                  rows={3}
                />
              </label>
            </>
          )}
        </SourceModal>
      ) : null}
    </div>
  );
}
