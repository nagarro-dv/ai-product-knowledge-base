import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Component, FileText, Figma, Plus, Search as SearchIcon, Ticket } from "lucide-react";
import type { AcceleratorMode, CriterionWithState } from "@ds-starter/standards";
import { AiAttachment } from "../components/custom/AiAttachment";
import type { AiAgentInputSendPayload, AiAgentInputSource } from "../components/custom/AiAgentInput";
import { ComponentPicker } from "../components/custom/ComponentPicker";
import { JiraTicketPicker } from "../components/custom/JiraTicketPicker";
import { SOURCE_MODAL_CONFIRM_LABEL, SOURCE_MODAL_SUBTITLE, SourceModal } from "../components/custom/SourceModal";
import { DsButton } from "../components/ds/Button";
import { DsIconButton } from "../components/ds/IconButton";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import { fetchIntegrations, startJiraConnect, type JiraTicketDetail } from "../integrations/jiraClient";
import {
  connectStorybook,
  formatStorybookComponentContext,
  listStorybookComponents,
  type StorybookComponent,
  type StorybookSummary,
} from "../integrations/storybookClient";
import { sourceChipName, sourceTypeLabel } from "./source-format";
import { StandardsPanel } from "./StandardsPanel";
import { ProviderPicker } from "./ProviderPicker";
import type { AgentProvider } from "../agentSseClient";
import type { ModeConfig, SourceEntry, SourceSlot } from "./types";
import "./SlotIntake.css";

/** Inverse of tool-utils.mapPayloadSource — rehydrates a persisted SourceEntry back into composer-shaped state, for restoring a history entry into its slots. */
function sourceEntryToAttachment(entry: SourceEntry): AiAgentInputSource {
  return {
    id: entry.id,
    kind: entry.kind,
    role: entry.role,
    href: entry.value,
    context: entry.context,
    preview: entry.preview,
    storybook: entry.storybook,
  };
}

type KindMenuOption = Exclude<SourceSlot["kinds"][number], "note">;

const KIND_ICON: Record<KindMenuOption, typeof Ticket> = {
  ticket: Ticket,
  figma: Figma,
  component: Component,
  doc: FileText,
};

const KIND_LABEL: Record<KindMenuOption, string> = {
  ticket: "Jira ticket",
  figma: "Figma",
  component: "Component",
  doc: "Doc",
};

function isValidUrlOrTicket(kind: KindMenuOption, value: string): boolean {
  if (kind === "ticket") return /[A-Z][A-Z0-9]+-\d+/i.test(value.trim());
  if (kind === "component") return false;
  try {
    const parsed = new URL(value);
    return kind === "figma" ? parsed.hostname.includes("figma.com") : true;
  } catch {
    return false;
  }
}

/** Renders one attached source as a removable "tag" chip — shared by the composer's own attachment row and every secondary slot's. */
function AttachmentChip({ source, onRemove }: { source: AiAgentInputSource; onRemove: () => void }) {
  return (
    <AiAttachment
      size="tag"
      kind={source.kind === "doc" || source.kind === "note" ? "comment" : source.kind}
      href={source.kind === "component" || source.kind === "note" ? null : source.href}
      value={sourceChipName(source.kind, source.href)}
      subtitle={sourceTypeLabel(source.kind)}
      preview={source.preview}
      onRemove={onRemove}
    />
  );
}

export type SlotIntakeProps = {
  mode: AcceleratorMode;
  config: ModeConfig;
  criteria: CriterionWithState[];
  onToggleCriterion: (id: string) => void;
  standardsLoading?: boolean;
  standardsErrorMessage?: string | null;
  onRetryStandards?: () => void;
  providers: AgentProvider[];
  selectedProvider: string;
  onSelectProvider: (id: string) => void;
  onManageProviders: () => void;
  onSend: (payload: AiAgentInputSendPayload) => void;
  sendLabel: string;
  errorMessage?: string | null;
  /** Repopulates slots from a restored history entry or a prior draft — read once on mount, not kept in sync afterward. */
  initialSources?: SourceEntry[];
  initialMessage?: string;
};

/**
 * The primary intake screen for every mode: one chat-style composer for the
 * subject (the component, if this mode has one) and the free-text request,
 * with the rest of that request's attachable kinds available as inline
 * chips — plus every other slot (references, watch-out notes) tucked under
 * a small "+ Label" toggle below the box, so the box itself never has more
 * than a couple of buttons in it. The role a source plays (subject /
 * requirement / reference / watch-out) is still implied entirely by which
 * slot it landed in — the user never names it themselves.
 */
export function SlotIntake({
  mode,
  config,
  criteria,
  onToggleCriterion,
  standardsLoading,
  standardsErrorMessage,
  onRetryStandards,
  providers,
  selectedProvider,
  onSelectProvider,
  onManageProviders,
  onSend,
  sendLabel,
  errorMessage,
  initialSources,
  initialMessage,
}: SlotIntakeProps) {
  const subjectSlot = config.slots.find((slot) => slot.role === "subject") ?? null;
  const requirementSlot = config.slots.find((slot) => slot.role === "requirement" && slot.allowFreeText) ?? null;
  const secondarySlots = config.slots.filter((slot) => slot !== subjectSlot && slot !== requirementSlot);

  const [attachments, setAttachments] = useState<Record<string, AiAgentInputSource[]>>(() => {
    if (!initialSources || initialSources.length === 0) return {};
    const bucketed: Record<string, AiAgentInputSource[]> = {};
    for (const entry of initialSources) {
      const slot = config.slots.find((s) => s.role === entry.role && s.kinds.includes(entry.kind));
      if (!slot) continue;
      (bucketed[slot.id] ??= []).push(sourceEntryToAttachment(entry));
    }
    return bucketed;
  });
  const [freeText, setFreeText] = useState<Record<string, string>>(() =>
    requirementSlot && initialMessage ? { [requirementSlot.id]: initialMessage } : {},
  );
  const [modal, setModal] = useState<{ slot: SourceSlot; kind: KindMenuOption } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const allAttachments = useMemo(() => Object.values(attachments).flat(), [attachments]);
  const canSend =
    config.slots.filter((slot) => slot.required).every((slot) => {
      const hasAttachment = (attachments[slot.id] ?? []).length > 0;
      const hasText = slot.allowFreeText && (freeText[slot.id] ?? "").trim().length > 0;
      return hasAttachment || hasText;
    }) && !config.disabled;

  const addAttachment = (slotId: string, source: AiAgentInputSource) => {
    setAttachments((current) => ({ ...current, [slotId]: [...(current[slotId] ?? []), source] }));
  };
  const removeAttachment = (slotId: string, id: string) => {
    setAttachments((current) => ({ ...current, [slotId]: (current[slotId] ?? []).filter((s) => s.id !== id) }));
  };

  const handleSend = () => {
    if (!canSend) return;
    const sources: AiAgentInputSource[] = [];
    for (const slot of config.slots) {
      if (slot === requirementSlot) continue;
      sources.push(...(attachments[slot.id] ?? []));
      const text = (freeText[slot.id] ?? "").trim();
      if (slot.allowFreeText && text) {
        sources.push({ id: `${slot.id}-note-${Date.now()}`, kind: "note", role: slot.role, href: text, context: "" });
      }
    }
    if (requirementSlot) sources.push(...(attachments[requirementSlot.id] ?? []));
    const message = requirementSlot ? (freeText[requirementSlot.id] ?? "").trim() : "";
    onSend({ message, sources });
  };

  // The subject (e.g. "Component to change") gets its own dedicated chip
  // button in the composer toolbar — it's always exactly one kind (max 1).
  const subjectKind = subjectSlot?.kinds.find((k): k is KindMenuOption => k !== "note");
  const subjectAttachments = subjectSlot ? (attachments[subjectSlot.id] ?? []) : [];
  const subjectAtMax = !subjectSlot || (subjectSlot.max !== "many" && subjectAttachments.length >= subjectSlot.max);

  // The requirement's own attachable kinds: "ticket" gets a dedicated chip
  // (matches what most requests actually attach); anything else (e.g. "doc"
  // for QA) lives behind the composer's "+" so the toolbar stays short.
  const requirementKinds = requirementSlot
    ? requirementSlot.kinds.filter((k): k is KindMenuOption => k !== "note")
    : [];
  const requirementPrimaryKinds = requirementKinds.filter((k) => k === "ticket");
  const requirementOverflowKinds = requirementKinds.filter((k) => k !== "ticket");
  const requirementAttachments = requirementSlot ? (attachments[requirementSlot.id] ?? []) : [];

  const composerAttachments = [
    ...(subjectSlot ? subjectAttachments.map((source) => ({ source, slotId: subjectSlot.id })) : []),
    ...(requirementSlot ? requirementAttachments.map((source) => ({ source, slotId: requirementSlot.id })) : []),
  ];

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreMenuOpen]);

  return (
    <div className="slotIntake">
      <div className="slotIntake__composer">
        {composerAttachments.length > 0 ? (
          <div className="slotIntake__composerAttachments">
            {composerAttachments.map(({ source, slotId }) => (
              <AttachmentChip key={source.id} source={source} onRemove={() => removeAttachment(slotId, source.id)} />
            ))}
          </div>
        ) : null}

        {requirementSlot ? (
          <textarea
            className="slotIntake__composerTextarea"
            value={freeText[requirementSlot.id] ?? ""}
            onChange={(e) => setFreeText((current) => ({ ...current, [requirementSlot.id]: e.target.value }))}
            placeholder={requirementSlot.hint}
            rows={3}
          />
        ) : null}

        <div className="slotIntake__composerToolbar">
          <div className="slotIntake__composerAttachButtons">
            {subjectSlot && subjectKind && !subjectAtMax ? (
              <button
                type="button"
                className="slotIntake__attachChip"
                onClick={() => setModal({ slot: subjectSlot, kind: subjectKind })}
              >
                <Component size={13} aria-hidden />
                {KIND_LABEL[subjectKind]}
              </button>
            ) : null}
            {requirementSlot
              ? requirementPrimaryKinds.map((kind) => {
                  const Icon = KIND_ICON[kind];
                  return (
                    <button
                      key={kind}
                      type="button"
                      className="slotIntake__attachChip"
                      onClick={() => setModal({ slot: requirementSlot, kind })}
                    >
                      <Icon size={13} aria-hidden />
                      {KIND_LABEL[kind]}
                    </button>
                  );
                })
              : null}
            {requirementSlot && requirementOverflowKinds.length > 0 ? (
              <div className="slotIntake__composerMore" ref={moreMenuRef}>
                <button
                  type="button"
                  className="slotIntake__attachChip slotIntake__attachChip--icon"
                  aria-label="Add more"
                  aria-haspopup="menu"
                  aria-expanded={moreMenuOpen}
                  onClick={() => setMoreMenuOpen((open) => !open)}
                >
                  <Plus size={13} aria-hidden />
                </button>
                {moreMenuOpen ? (
                  <div className="slotIntake__composerMoreMenu" role="menu">
                    {requirementOverflowKinds.map((kind) => {
                      const Icon = KIND_ICON[kind];
                      return (
                        <button
                          key={kind}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setModal({ slot: requirementSlot, kind });
                            setMoreMenuOpen(false);
                          }}
                        >
                          <Icon size={14} aria-hidden />
                          {KIND_LABEL[kind]}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="slotIntake__composerActions">
            {providers.length > 0 ? (
              <ProviderPicker
                providers={providers}
                selectedProviderId={selectedProvider}
                onSelect={onSelectProvider}
                onManage={onManageProviders}
              />
            ) : null}
            <DsIconButton
              variant="primary"
              size="small"
              type="button"
              aria-label={sendLabel}
              disabled={!canSend}
              onClick={handleSend}
            >
              <ArrowRight size={16} aria-hidden />
            </DsIconButton>
          </div>
        </div>
      </div>

      <div className="slotIntake__belowRow">
        <div className="slotIntake__secondarySlots">
          {secondarySlots.map((slot) => (
            <SecondarySlot
              key={slot.id}
              slot={slot}
              attachments={attachments[slot.id] ?? []}
              freeText={freeText[slot.id] ?? ""}
              onFreeTextChange={(value) => setFreeText((current) => ({ ...current, [slot.id]: value }))}
              onRemove={(id) => removeAttachment(slot.id, id)}
              onOpenKind={(kind) => setModal({ slot, kind })}
              forceOpen={
                (attachments[slot.id]?.length ?? 0) > 0 || (freeText[slot.id] ?? "").trim().length > 0
              }
            />
          ))}
        </div>

        <div className="slotIntake__criteriaSlot">
          <StandardsPanel
            criteria={criteria}
            onToggle={onToggleCriterion}
            heading={mode === "qa" ? "What to check" : "Quality checklist"}
            loading={standardsLoading}
            errorMessage={standardsErrorMessage}
            onRetry={onRetryStandards}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="accelerator__errorCard" role="alert">
          <DsTypography as="p" variant="paragraph-regular">
            {errorMessage}
          </DsTypography>
        </div>
      ) : null}

      {modal ? (
        <SlotSourceModal
          slot={modal.slot}
          kind={modal.kind}
          existing={allAttachments}
          onClose={() => setModal(null)}
          onAdd={(source) => {
            addAttachment(modal.slot.id, source);
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** One optional slot (references, watch-outs) collapsed to a small "+ Label" toggle — expands in place to the same attachments + kind-buttons + free-text field the composer itself uses, so nothing this slot can hold is unreachable, just out of the way until asked for. */
function SecondarySlot({
  slot,
  attachments,
  freeText,
  onFreeTextChange,
  onRemove,
  onOpenKind,
  forceOpen,
}: {
  slot: SourceSlot;
  attachments: AiAgentInputSource[];
  freeText: string;
  onFreeTextChange: (value: string) => void;
  onRemove: (id: string) => void;
  onOpenKind: (kind: KindMenuOption) => void;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(forceOpen);
  // Once the user has actually put something in this slot (from a restored
  // draft, say), it stays expanded — collapsing it would hide their own input.
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const attachableKinds = slot.kinds.filter((kind): kind is KindMenuOption => kind !== "note");
  const atMax = slot.max !== "many" && attachments.length >= slot.max;

  if (!open) {
    return (
      <button type="button" className="slotIntake__secondaryToggle" onClick={() => setOpen(true)}>
        <Plus size={13} aria-hidden />
        {slot.label}
      </button>
    );
  }

  return (
    <div className="slotIntake__secondaryOpen">
      <DsTypography as="span" variant="paragraph-small-medium" className="slotIntake__secondaryLabel">
        {slot.label}
      </DsTypography>

      {attachments.length > 0 ? (
        <div className="slotIntake__composerAttachments">
          {attachments.map((source) => (
            <AttachmentChip key={source.id} source={source} onRemove={() => onRemove(source.id)} />
          ))}
        </div>
      ) : null}

      {slot.allowFreeText ? (
        <textarea
          className="slotIntake__secondaryTextarea"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder={slot.hint}
          rows={2}
        />
      ) : null}

      {!atMax && attachableKinds.length > 0 ? (
        <div className="slotBox__kindRow">
          {attachableKinds.map((kind) => {
            const Icon = KIND_ICON[kind];
            return (
              <button key={kind} type="button" className="slotBox__kindButton" onClick={() => onOpenKind(kind)}>
                <Icon size={13} aria-hidden />
                {KIND_LABEL[kind]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** A focused single-kind modal — the slot already constrains which kind this is, so unlike the legacy composer there's no kind picker inside it. */
function SlotSourceModal({
  slot,
  kind,
  existing,
  onClose,
  onAdd,
}: {
  slot: SourceSlot;
  kind: KindMenuOption;
  existing: AiAgentInputSource[];
  onClose: () => void;
  onAdd: (source: AiAgentInputSource) => void;
}) {
  const [href, setHref] = useState("");
  const [context, setContext] = useState("");
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<JiraTicketDetail | null>(null);
  const [pendingTicketContext, setPendingTicketContext] = useState("");
  const [sbSummary, setSbSummary] = useState<StorybookSummary | null>(null);
  const [sbComponents, setSbComponents] = useState<StorybookComponent[]>([]);
  const [sbLoading, setSbLoading] = useState(false);
  const [pendingComponent, setPendingComponent] = useState<StorybookComponent | null>(null);
  const [componentSearchOpen, setComponentSearchOpen] = useState(false);
  const [sbConnectUrl, setSbConnectUrl] = useState("");
  const [sbConnecting, setSbConnecting] = useState(false);
  const [sbConnectError, setSbConnectError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

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
            status: sb.status === "connected" || sb.status === "error" ? sb.status : "not-connected",
            url: sb.url,
            componentCount: sb.componentCount,
            lastIndexedAt: sb.lastIndexedAt,
            error: sb.error,
            projectTitle: sb.projectTitle,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (kind !== "component" || sbSummary?.status !== "connected") return;
    const controller = new AbortController();
    setSbLoading(true);
    void listStorybookComponents(undefined, { signal: controller.signal })
      .then(({ components }) => setSbComponents(components))
      .catch(() => setSbComponents([]))
      .finally(() => setSbLoading(false));
    return () => controller.abort();
  }, [kind, sbSummary?.status]);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

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

  const jiraPickerActive = kind === "ticket" && jiraConnected;

  const handleConfirm = () => {
    if (kind === "component") {
      if (!pendingComponent || sbSummary?.url == null) return;
      const structured = formatStorybookComponentContext(pendingComponent, sbSummary.url);
      onAdd({
        id: `source-${Date.now()}`,
        kind: "component",
        role: slot.role,
        href: pendingComponent.title,
        context: context.trim() ? `${structured}\n\nWhy this source: ${context.trim()}` : structured,
        preview: pendingComponent.importPath ?? pendingComponent.path,
        storybook: {
          url: sbSummary.url,
          componentPath: pendingComponent.path,
          storyIds: pendingComponent.storyIds,
          storyNames: pendingComponent.storyNames,
          importPath: pendingComponent.importPath,
        },
      });
      return;
    }
    if (jiraPickerActive) {
      if (!pendingTicket) return;
      onAdd({
        id: `source-${Date.now()}`,
        kind: "ticket",
        role: slot.role,
        href: pendingTicket.key,
        context: pendingTicketContext,
        preview: pendingTicket.title,
      });
      return;
    }
    if (!isValidUrlOrTicket(kind, href) || existing.some((s) => s.kind === kind && s.href === href.trim())) return;
    onAdd({ id: `source-${Date.now()}`, kind, role: slot.role, href: href.trim(), context: context.trim() });
  };

  const valid = kind === "component"
    ? Boolean(pendingComponent)
    : jiraPickerActive
      ? Boolean(pendingTicket)
      : isValidUrlOrTicket(kind, href);

  // The only remaining case: Jira isn't connected yet, but could be — nothing to switch
  // between once connected, since the picker (with its own Search tab) is then the only
  // path and manual key entry would just duplicate it.
  const jiraModeSwitch =
    kind === "ticket" && !jiraConnected && jiraConfigured ? (
      <button type="button" className="sourceModal__jiraModeSwitch" onClick={() => startJiraConnect()}>
        Connect Jira to search tickets
      </button>
    ) : null;

  return (
    <SourceModal
      kind={kind}
      // slot.hint is written for the composer's placeholder — for the "requirement" slot
      // that's a mode-level instruction ("Change something that already exists — describe
      // what should change, or attach a ticket"), which reads as a non-sequitur under an
      // "Attach a Jira ticket" title. The generic, attach-focused copy fits every kind;
      // slot.hint only adds real value for slots that describe what to attach (subject,
      // reference), so it's used there instead.
      subtitle={slot.role === "requirement" ? SOURCE_MODAL_SUBTITLE[kind] : slot.hint}
      onClose={onClose}
      footer={{ confirmLabel: SOURCE_MODAL_CONFIRM_LABEL[kind], confirmDisabled: !valid, onConfirm: handleConfirm }}
      headerAction={
        kind === "component" && sbSummary?.status === "connected" ? (
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
      {jiraModeSwitch}

      {jiraPickerActive ? (
        <JiraTicketPicker
          onPreviewChange={(ticket, formattedContext) => {
            setPendingTicket(ticket);
            setPendingTicketContext(formattedContext);
          }}
        />
      ) : kind === "component" ? (
        sbSummary?.status !== "connected" ? (
          <div className="sourceModal__sbConnect">
            <DsTypography as="span" variant="paragraph-small-bold">
              Connect your Storybook
            </DsTypography>
            <input
              ref={firstFieldRef}
              className="sourceModal__fieldInput"
              value={sbConnectUrl}
              onChange={(e) => setSbConnectUrl(e.target.value)}
              placeholder="http://localhost:6006 or https://…"
              onKeyDown={(e) => e.key === "Enter" && void handleConnectStorybook()}
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
            inputRef={firstFieldRef}
            searchOpen={componentSearchOpen}
            onSearchOpenChange={setComponentSearchOpen}
          />
        )
      ) : (
        <>
          <label className="sourceModal__field">
            <span>{kind === "ticket" ? "Ticket key" : kind === "figma" ? "Figma URL" : "Document URL"}</span>
            <input
              ref={firstFieldRef}
              className="sourceModal__fieldInput"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder={kind === "ticket" ? "DS-042" : kind === "figma" ? "https://www.figma.com/design/…" : "https://…"}
            />
          </label>
          <label className="sourceModal__field">
            <span>Additional context (optional)</span>
            <textarea className="sourceModal__contextInput" value={context} onChange={(e) => setContext(e.target.value)} rows={3} />
          </label>
        </>
      )}
    </SourceModal>
  );
}
