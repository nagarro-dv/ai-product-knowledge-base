import { AlertTriangle, ChevronLeft, ExternalLink, Github, History as HistoryIcon } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AiAgentInput, type AiAgentInputSource } from "../components/custom/AiAgentInput";
import { DsAccordion } from "../components/ds/Accordion";
import { DsButton } from "../components/ds/Button";
import { DsIconButton } from "../components/ds/IconButton";
import { DsSpinner } from "../components/ds/Spinner";
import { DsSuccess } from "../components/ds/Success";
import { DsTypography } from "../components/ds/DsTypography";
import { fetchIntegrations } from "../integrations/jiraClient";
import { connectStorybook, storybookDisplayName, type StorybookSummary } from "../integrations/storybookClient";
import { AcceleratorTabs, type TabId } from "./AcceleratorTabs";
import { DirectionCard } from "./DirectionCard";
import { GenerationProgress } from "./GenerationProgress";
import { HistoryDrawer } from "./HistoryDrawer";
import { ProviderPicker } from "./ProviderPicker";
import { RefineControl } from "./RefineControl";
import { ResponsivePreviewStage } from "./ResponsivePreviewStage";
import { ResponsiveToolbar } from "./ResponsiveToolbar";
import { DEFAULT_VIEWPORT, withCustomWidth } from "./responsiveViewport";
import { SourceBadge } from "./SourceBadge";
import { type SourceChipKind } from "./source-format";
import { StorybookStoryFrame } from "./StorybookStoryFrame";
import { UnderstandingReview } from "./UnderstandingReview";
import { clearHistory, readHistory, type RunHistoryEntry } from "./runHistory";
import { openSettings } from "../navigationEvents";
import { groupFilesByDirection, lastStreamItemOfKind, streamItemLabel } from "./tool-utils";
import type { SourceEntry } from "./types";
import { useDsAcceleratorTool } from "./useDsAcceleratorTool";
import "./DsAcceleratorTool.css";

/** AiAgentInput owns its own source list internally — this bridges a restored history entry into it. */
function toInputSources(entries: SourceEntry[]): AiAgentInputSource[] {
  return entries
    .filter((entry) => entry.kind !== "internal-doc")
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind as "figma" | "ticket" | "component",
      href: entry.value,
      context: entry.context,
      storybook: entry.storybook,
    }));
}

export function DsAcceleratorTool() {
  const vm = useDsAcceleratorTool();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<RunHistoryEntry[]>([]);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
  // Prefills the composer when restoring a history entry.
  const [examplePrefill, setExamplePrefill] = useState("");

  // The design system IS the connected Storybook — the workflow only unlocks
  // once one is connected. null = still checking.
  const [sbSummary, setSbSummary] = useState<StorybookSummary | null>(null);
  const [sbStatusKnown, setSbStatusKnown] = useState(false);
  const [sbConnectUrl, setSbConnectUrl] = useState("");
  const [sbConnecting, setSbConnecting] = useState(false);
  const [sbConnectError, setSbConnectError] = useState<string | null>(null);

  // The AI's raw activity stream is a secondary disclosure attached to the
  // Review/Comparison stage header — collapsed by default so the stage's
  // actual output (the analysis, the directions), not the model's process,
  // is what's in front of the user. Resets on every stage change.
  const [activityOpen, setActivityOpen] = useState(false);
  // "Add context" is a bounded action, not an always-open chat box — it only
  // appears once the user asks for it, so the Overview tab doesn't read as a
  // second chat thread sitting open under the analysis by default. It's for
  // anything the AI didn't ask about; flagged questions resolve inline instead.
  const [addContextOpen, setAddContextOpen] = useState(false);
  // Answers to inline-resolved open questions, keyed by question text —
  // accumulate silently and fold into the next "Generate directions" call
  // instead of triggering an immediate re-analysis per answer.
  const [resolvedAnswers, setResolvedAnswers] = useState<Record<string, string>>({});
  // Lets the user "look at" any unlocked tab without disturbing the live run
  // — the tab bar is independent of ToolState. Any real state change (a new
  // action) snaps this back to null so the view follows the live run again.
  const [viewOverride, setViewOverride] = useState<TabId | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchIntegrations({ signal: controller.signal })
      .then((list) => {
        const sb = list.find((integration) => integration.id === "storybook");
        setSbSummary(
          sb
            ? {
                status: sb.status === "connected" || sb.status === "error" ? sb.status : "not-connected",
                url: sb.url,
                componentCount: sb.componentCount,
                lastIndexedAt: sb.lastIndexedAt,
                error: sb.error,
                projectTitle: sb.projectTitle,
              }
            : { status: "not-connected" },
        );
      })
      .catch(() => {
        // Service unreachable — don't block the screen on an unknown status;
        // the composer's own error handling reports the outage honestly.
        setSbSummary({ status: "not-connected", error: "service-unreachable" });
      })
      .finally(() => setSbStatusKnown(true));
    return () => controller.abort();
  }, []);

  const handleConnectStorybook = async () => {
    if (!sbConnectUrl.trim() || sbConnecting) return;
    setSbConnecting(true);
    setSbConnectError(null);
    try {
      const summary = await connectStorybook(sbConnectUrl);
      setSbSummary(summary);
    } catch (error) {
      setSbConnectError(error instanceof Error ? error.message : "Could not connect to that Storybook.");
    } finally {
      setSbConnecting(false);
    }
  };

  // Shared across the Original component preview + every direction's preview
  // in the Compare-directions screen, so a breakpoint check always compares
  // all of them at the same width. Desktop (fluid, today's exact behavior)
  // is the default; resets per run so a custom width from a previous
  // comparison never silently carries into a new one.
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const handleResizeWidth = (width: number) => setViewport((current) => withCustomWidth(current, width));
  useEffect(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, [vm.runId]);

  const [restoredSources, setRestoredSources] = useState<AiAgentInputSource[] | undefined>(undefined);
  const runHeadingRef = useRef<HTMLElement | null>(null);
  const understandingHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const successHeadingRef = useRef<HTMLElement | null>(null);
  const errorCardRef = useRef<HTMLElement | null>(null);

  // Move focus with the journey so screen-reader and keyboard users land on the
  // section that just became relevant. Also closes the two per-stage
  // disclosures on every stage change, so neither carries over stale-open
  // from whatever stage was active before.
  useEffect(() => {
    if (vm.state === "analyzing" || vm.state === "generating") runHeadingRef.current?.focus();
    if (vm.state === "analysisReady") understandingHeadingRef.current?.focus();
    if (vm.state === "implementationSuccess") successHeadingRef.current?.focus();
    if (vm.state === "error" || vm.state === "analysisStopped") errorCardRef.current?.focus();
    setActivityOpen(false);
    setViewOverride(null);
    if (vm.state === "analyzing") {
      setAddContextOpen(false);
      setResolvedAnswers({});
    }
  }, [vm.state]);

  // Scrolls/focuses the add-context panel only once it has actually rendered
  // (i.e. after addContextOpen flips true and React has committed the DOM) —
  // not before, which a ref lookup in the same tick as setAddContextOpen(true)
  // would risk missing.
  useEffect(() => {
    if (!addContextOpen) return;
    addContextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    addContextRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addContextOpen]);

  const openHistory = () => {
    setHistoryEntries(readHistory());
    setHistoryOpen(true);
  };

  const renderStream = (emptyLabel: string, streamRef: RefObject<HTMLDivElement | null>) => (
    <div
      className="accelerator__analysisStream"
      ref={streamRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Activity"
    >
      {vm.streamItems.length === 0 ? (
        <DsTypography as="p" variant="paragraph-regular">
          {emptyLabel}
        </DsTypography>
      ) : (
        vm.streamItems.map((item) => (
          <DsTypography
            key={item.id}
            as="p"
            variant="paragraph-small"
            className={`accelerator__streamLine accelerator__streamLine--${item.kind}`}
          >
            {streamItemLabel(item)}
          </DsTypography>
        ))
      )}
    </div>
  );

  /** The activity stream as a quiet, collapsed-by-default toggle attached to a stage header — never the default visible content. */
  const renderActivityToggle = () => (
    <div className="accelerator__activityDisclosure">
      <button
        type="button"
        className="accelerator__activityToggle"
        onClick={() => setActivityOpen((open) => !open)}
        aria-expanded={activityOpen}
      >
        {activityOpen ? "Hide process log" : "View process log"}
      </button>
      {activityOpen ? renderStream("Waiting for updates…", vm.analysisStreamRef) : null}
    </div>
  );

  // Progress steps advance on real signals only — first stream activity, and
  // (for directions) the agent's own "updating code" tool events. Never timers.
  const sawWriteActivity = vm.streamItems.some((item) => item.text.includes("updating code"));
  const lastStreamItem = vm.streamItems[vm.streamItems.length - 1];
  // Real 3rd-step signal (never a timer): once files have been written AND
  // the stream has moved back to assistant prose — not mid tool-call — the
  // model is composing its summary/JSON, not writing code anymore.
  const isDescribingDirections = sawWriteActivity && lastStreamItem?.kind === "assistant";
  const progressIndex =
    vm.state === "generating"
      ? isDescribingDirections
        ? 2
        : sawWriteActivity
          ? 1
          : 0
      : vm.streamItems.length > 0
        ? 1
        : 0;
  // The working screen's real content: the model's latest actual reasoning,
  // kept separate from the latest process tick so a tool call mid-thought
  // doesn't bump real content off screen for a "Working — …" pill.
  const latestThinkingItem = lastStreamItemOfKind(vm.streamItems, ["thinking", "assistant"]);
  const latestProcessItem = lastStreamItemOfKind(vm.streamItems, ["tool", "status"]);

  // A Storybook-backed component source gets a REAL story render (via the
  // Storybook's own iframe endpoint) instead of the built-in preview.
  const storybookSource = vm.sources.find((source) => source.kind === "component" && source.storybook);

  // Sources are pinned, structural context — grounding for the current
  // stage's content, not chat attachments — so they render in the stage's
  // own header, never inline mid-scroll.
  const visibleSources = vm.sources.filter(
    (source): source is SourceEntry & { kind: SourceChipKind } => source.kind !== "internal-doc",
  );
  const renderSourceStrip = () =>
    visibleSources.length > 0 ? (
      <div className="accelerator__sourceStrip" aria-label="Sources used">
        <DsTypography as="p" variant="paragraph-mini-bold" className="accelerator__sourceStripLabel">
          Sources
        </DsTypography>
        <div className="accelerator__sourceStripBadges">
          {visibleSources.map((source) => (
            <SourceBadge key={source.id} source={source} />
          ))}
        </div>
      </div>
    ) : null;

  const addContextRef = useRef<HTMLDivElement | null>(null);

  const handleResolveQuestion = (question: string, answer: string) => {
    setResolvedAnswers((current) => ({ ...current, [question]: answer }));
  };

  // Resolved questions accumulate silently — this is where they finally
  // reach the AI, bundled into the "Generate directions" call, same
  // mechanism handleRefine already uses for a regeneration instruction.
  const buildAmendmentFromAnswers = (): string | undefined => {
    const entries = Object.entries(resolvedAnswers);
    if (entries.length === 0) return undefined;
    return entries.map(([question, answer]) => `Q: ${question}\nA: ${answer}`).join("\n\n");
  };

  // Tabs are derived from ToolState, not the other way around — the same
  // bucketing the old stage rail used, collapsed from 7 stages to 3 tabs.
  // "error" anchors to whichever phase actually failed.
  const errorTab: TabId = vm.runPhase === "directions" ? "directions" : "overview";
  const activeTab: TabId =
    vm.state === "error"
      ? errorTab
      : vm.state === "implementing" || vm.state === "implementationReady" || vm.state === "implementationSuccess"
        ? "implementation"
        : vm.state === "generating" || vm.state === "directionsReady"
          ? "directions"
          : "overview";
  // A tab stays unlocked for the rest of the run once its content has ever
  // existed — derived from data the hook already keeps, not new hook state.
  const directionsUnlocked = vm.state === "generating" || vm.directions.length > 0;
  const implementationUnlocked =
    vm.state === "implementing" || vm.state === "implementationReady" || vm.state === "implementationSuccess";
  // What the user is actually looking at — follows the live run unless
  // they've clicked an unlocked tab to look at something else.
  const effectiveTab: TabId = viewOverride ?? activeTab;

  // Only present when a real Storybook-bound component source exists —
  // never an empty placeholder.
  const renderOriginalComponent = () =>
    storybookSource?.storybook && storybookSource.storybook.storyIds.length > 0 ? (
      <div className="accelerator__originalComponent">
        <DsTypography as="h3" variant="paragraph-small-bold" className="accelerator__originalHeading">
          Original component · {storybookSource.value}
        </DsTypography>
        <ResponsivePreviewStage
          viewport={viewport}
          onResizeWidth={handleResizeWidth}
          label="Resize original component preview width"
        >
          <StorybookStoryFrame
            url={storybookSource.storybook.url}
            storyId={storybookSource.storybook.storyIds[0]!}
            title={storybookSource.value}
          />
        </ResponsivePreviewStage>
      </div>
    ) : null;

  // The applied result's payoff, shown on the Done state — the staged
  // preview module is deleted the instant promote runs (server sweeps
  // .generated/{runId} immediately), so this can't reuse that iframe. The
  // connected Storybook is the only thing still pointing at the real,
  // now-changed file, and it's exactly the promise the gate copy makes
  // ("your Storybook reflects it immediately") — the same story, genuinely
  // live, is a stronger proof than a frozen snapshot would have been anyway.
  const renderAppliedComponent = () =>
    storybookSource?.storybook && storybookSource.storybook.storyIds.length > 0 ? (
      <div className="accelerator__appliedPreview">
        <ResponsivePreviewStage
          viewport={viewport}
          onResizeWidth={handleResizeWidth}
          label="Resize applied result preview width"
        >
          <StorybookStoryFrame
            url={storybookSource.storybook.url}
            storyId={storybookSource.storybook.storyIds[0]!}
            title={storybookSource.value}
          />
        </ResponsivePreviewStage>
      </div>
    ) : null;

  return (
    <main className="accelerator" aria-label="DS Accelerator">
      <section
        className={`accelerator__window${vm.state === "intake" ? " accelerator__window--intake" : ""}`}
        aria-labelledby="accelerator-title"
      >
        {vm.state === "intake" && !sbStatusKnown ? (
          <section className="accelerator__startScreen" aria-label="Loading">
            <div className="accelerator__startContent accelerator__gateLoading" role="status">
              <DsSpinner size={16} aria-hidden />
              <DsTypography as="p" variant="paragraph-small">
                Checking your design system connection…
              </DsTypography>
            </div>
          </section>
        ) : vm.state === "intake" && sbSummary?.status === "not-connected" && sbSummary.error !== "service-unreachable" ? (
          <section className="accelerator__startScreen" aria-label="Connect your design system">
            <div className="accelerator__startContent accelerator__gate">
              <section className="accelerator__startIntro" aria-label="Introduction">
                <DsTypography as="span" variant="paragraph-mini-bold" className="accelerator__gateEyebrow">
                  DS Accelerator
                </DsTypography>
                <DsTypography as="h1" id="accelerator-title" variant="heading-2">
                  Connect your design system to begin
                </DsTypography>
                <DsTypography as="p" variant="paragraph-regular" className="accelerator__startHint">
                  DS Accelerator turns change requests into reviewed, ready-to-apply component code. It works directly
                  with your team's Storybook — the same components you actually ship, not a copy.
                </DsTypography>
              </section>
              <div className="accelerator__gateConnect">
                <DsTypography as="label" variant="paragraph-small-bold" htmlFor="accelerator-sb-url">
                  Storybook URL
                </DsTypography>
                <div className="accelerator__gateConnectRow">
                  <input
                    id="accelerator-sb-url"
                    className="accelerator__gateInput"
                    value={sbConnectUrl}
                    onChange={(event) => setSbConnectUrl(event.target.value)}
                    placeholder="http://localhost:6006 or https://your-storybook.example.com"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleConnectStorybook();
                    }}
                  />
                  <DsButton
                    variant="primary"
                    size="regular"
                    onClick={() => void handleConnectStorybook()}
                    disabled={sbConnecting || !sbConnectUrl.trim()}
                    leftIcon={sbConnecting ? <DsSpinner size={14} aria-hidden /> : undefined}
                  >
                    {sbConnecting ? "Connecting…" : "Connect"}
                  </DsButton>
                </div>
                <DsTypography as="p" variant="paragraph-mini-regular" className="accelerator__gateFieldHint" aria-live="polite">
                  {sbConnecting
                    ? "Validating the URL and indexing your components…"
                    : "Works with a local Storybook, a hosted build, or Chromatic. We validate before saving anything."}
                </DsTypography>
                {sbConnectError ? (
                  <DsTypography as="p" variant="paragraph-small" className="accelerator__gateError" role="alert">
                    {sbConnectError}
                  </DsTypography>
                ) : null}
              </div>
              <ol className="accelerator__gateSteps" aria-label="What happens next">
                <li>
                  <DsTypography as="span" variant="paragraph-small">
                    Your components become searchable sources for any request.
                  </DsTypography>
                </li>
                <li>
                  <DsTypography as="span" variant="paragraph-small">
                    The AI analyses each request against the real component code and explains its plan before touching
                    anything.
                  </DsTypography>
                </li>
                <li>
                  <DsTypography as="span" variant="paragraph-small">
                    You compare working directions, pick one, and the change lands in your codebase — your Storybook
                    reflects it immediately.
                  </DsTypography>
                </li>
              </ol>
            </div>
          </section>
        ) : vm.state === "intake" ? (
          <section className="accelerator__startScreen" aria-label="Describe your request">
            <div className="accelerator__startContent">
              <section className="accelerator__startIntro" aria-label="Introduction">
                <DsTypography as="h1" id="accelerator-title" variant="heading-2">
                  What should we improve today?
                </DsTypography>
                <DsTypography as="p" variant="paragraph-regular" className="accelerator__startHint">
                  Describe the change you need. Attach a ticket, a Figma design, or a component for better results.
                </DsTypography>
                {sbSummary?.status === "connected" ? (
                  <button type="button" className="accelerator__dsStatus" onClick={() => openSettings("workspace")}>
                    <span className="accelerator__dsStatusDot accelerator__dsStatusDot--ok" aria-hidden />
                    <DsTypography as="span" variant="paragraph-small" className="accelerator__dsStatusText">
                      Current Design System: <strong>{storybookDisplayName(sbSummary)}</strong>
                    </DsTypography>
                  </button>
                ) : sbSummary?.status === "error" ? (
                  <button
                    type="button"
                    className="accelerator__dsStatus accelerator__dsStatus--warning"
                    onClick={() => openSettings("workspace")}
                  >
                    <span className="accelerator__dsStatusDot accelerator__dsStatusDot--warning" aria-hidden />
                    <DsTypography as="span" variant="paragraph-small" className="accelerator__dsStatusText">
                      Current Design System: <strong>{storybookDisplayName(sbSummary)}</strong> — not reachable right
                      now
                    </DsTypography>
                  </button>
                ) : null}
              </section>
              <AiAgentInput
                className="accelerator__startInput"
                placeholder="Describe what should change and why…"
                onSend={vm.handleAiAgentInputSend}
                prefill={examplePrefill}
                prefillSources={restoredSources}
              />
              <section className="accelerator__optionsRow" aria-label="Run options">
                {vm.providers.length > 0 ? (
                  <ProviderPicker
                    providers={vm.providers}
                    selectedProviderId={vm.selectedProvider}
                    onSelect={vm.setSelectedProvider}
                    onManage={() => openSettings("ai-models")}
                  />
                ) : null}
                <div className="accelerator__optionsGroup">
                  <DsIconButton
                    ref={historyTriggerRef}
                    variant="ghost"
                    size="small"
                    aria-label="Recent runs"
                    onClick={openHistory}
                  >
                    <HistoryIcon size={16} aria-hidden />
                  </DsIconButton>
                </div>
              </section>
              {!vm.activeCanEditFiles && vm.activeAuthMethod ? (
                <DsTypography as="p" variant="paragraph-small" className="accelerator__textOnlyNote">
                  {vm.providers.find((p) => p.id === vm.selectedProvider)?.label ?? "This engine"} proposes directions
                  as text only — switch to Claude Code or Cursor for live previews.
                </DsTypography>
              ) : null}
              {vm.providers.length < 2 && vm.providersError ? (
                <p className="accelerator__inlineWarning" role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <DsTypography as="span" variant="paragraph-small">
                    {vm.providersError}
                  </DsTypography>
                </p>
              ) : null}
              {vm.intakeErrorMessage ? (
                <div className="accelerator__errorCard" role="alert">
                  <DsTypography as="p" variant="paragraph-regular">
                    {vm.intakeErrorMessage}
                  </DsTypography>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {vm.state !== "intake" ? (
          <header className="accelerator__runHeader">
            <div className="accelerator__runBrand">
              {vm.showBackHomeArrow ? (
                <DsButton
                  variant="ghost"
                  size="small"
                  aria-label="Back to home"
                  onClick={vm.handleBackHome}
                  leftIcon={<ChevronLeft size={16} aria-hidden />}
                >
                  Back
                </DsButton>
              ) : null}
              <DsTypography
                as="p"
                id="accelerator-title"
                variant="heading-4"
                tabIndex={-1}
                ref={runHeadingRef}
                className="accelerator__srOnly"
              >
                DS Accelerator
              </DsTypography>
            </div>
            <DsIconButton
              ref={historyTriggerRef}
              variant="ghost"
              size="small"
              aria-label="Recent runs"
              onClick={openHistory}
            >
              <HistoryIcon size={16} aria-hidden />
            </DsIconButton>
          </header>
        ) : null}

        {vm.state !== "intake" ? (
          <div className="accelerator__shell">
            <AcceleratorTabs
              activeTab={effectiveTab}
              directionsUnlocked={directionsUnlocked}
              implementationUnlocked={implementationUnlocked}
              hasError={vm.state === "error"}
              errorTab={errorTab}
              onSelectTab={setViewOverride}
            />
            <div className="accelerator__stagePanel">
              {effectiveTab === "implementation" && vm.state === "implementationSuccess" ? (
                <div className="accelerator__stageBody">
                  <section className="accelerator__successScreen" aria-label="Direction applied">
                    <div className="accelerator__successCard">
                      <div tabIndex={-1} ref={successHeadingRef as RefObject<HTMLDivElement | null>}>
                        <DsSuccess
                          titleText={
                            vm.promotedFiles.length > 0
                              ? `${vm.resolvedPreviewTarget.label} updated`
                              : "Direction recorded — no files changed"
                          }
                          descriptionText={
                            vm.promotedFiles.length > 0
                              ? vm.chosenDirection
                                ? `"${vm.chosenDirection.title}" was applied to the project. Nothing else was touched.`
                                : "Your chosen direction was applied to the project."
                              : vm.chosenDirection
                                ? `"${vm.chosenDirection.title}" was a text-only proposal — the engine that generated it can't edit files, so nothing in your project was changed.`
                                : "This was a text-only proposal — the engine that generated it can't edit files, so nothing in your project was changed."
                          }
                        />
                      </div>

                      {vm.promotedFiles.length > 0 ? renderAppliedComponent() : null}

                      {vm.promotedFiles.length > 0 ? (
                        <div className="accelerator__fileList" aria-label="Files changed">
                          {groupFilesByDirection(vm.promotedFiles, vm.directions.map((d) => d.title)).map((group) => (
                            <div key={group.label} className="accelerator__fileGroup">
                              <DsTypography as="p" variant="paragraph-small-bold">
                                {group.label}
                              </DsTypography>
                              <ul>
                                {group.files.map((path) => (
                                  <li key={path}>
                                    <code className="accelerator__markdownInlineCode">{path}</code>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {vm.repositoryKind === "github" && vm.promotedFiles.length > 0 ? (
                      <div className="accelerator__publishBlock" aria-label="Publish to GitHub">
                        {vm.publishResult ? (
                          <div className="accelerator__publishStatus accelerator__publishStatus--success" role="status">
                            <DsTypography as="p" variant="paragraph-small">
                              Pull request #{vm.publishResult.prNumber} opened
                              {vm.publishBranch ? ` from ${vm.publishBranch}` : ""}. Review and merge it on GitHub
                              whenever you're ready.
                            </DsTypography>
                            <a
                              href={vm.publishResult.prUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="accelerator__publishOpenLink"
                            >
                              Open Pull Request
                              <ExternalLink size={12} aria-hidden />
                            </a>
                          </div>
                        ) : (
                          <div className="accelerator__publishStatus">
                            <DsTypography as="p" variant="paragraph-small" className="accelerator__publishHint">
                              {vm.publishBranch
                                ? `Applied to branch ${vm.publishBranch} in your clone, not yet pushed.`
                                : "Applied to a branch in your clone, not yet pushed."}{" "}
                              Publish it as a pull request so it can be reviewed on GitHub before merging — nothing is
                              pushed to {vm.repositoryDefaultBranch ?? "the default branch"} directly.
                            </DsTypography>
                            <DsButton
                              variant="secondary"
                              size="mini"
                              leftIcon={<Github size={13} aria-hidden />}
                              onClick={() => void vm.handlePublish()}
                              disabled={vm.isPublishing}
                            >
                              {vm.isPublishing ? "Publishing…" : "Publish to GitHub"}
                            </DsButton>
                            {vm.publishErrorMessage ? (
                              <DsTypography as="p" variant="paragraph-mini-regular" className="accelerator__publishError" role="alert">
                                {vm.publishErrorMessage}{" "}
                                <button
                                  type="button"
                                  className="accelerator__publishRetry"
                                  onClick={() => void vm.handlePublish()}
                                >
                                  Try again
                                </button>
                              </DsTypography>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="accelerator__successActions">
                      <DsButton variant="primary" size="regular" onClick={vm.handleBackHome}>
                        Start a new change
                      </DsButton>
                    </div>
                  </section>
                </div>
              ) : (
                <>
                  {effectiveTab === "overview" && vm.understanding ? (
                    <div className="accelerator__stageHeader">
                      <DsTypography as="h2" variant="heading-4">
                        Review your analysis
                      </DsTypography>
                      {renderSourceStrip()}
                      {renderActivityToggle()}
                    </div>
                  ) : null}

                  {effectiveTab === "directions" && vm.directions.length > 0 ? (
                    <div className="accelerator__stageHeader">
                      <DsTypography as="h2" variant="heading-4">
                        {vm.directions.length > 1 ? "Compare directions" : "Recommended direction"}
                      </DsTypography>
                      <div className="accelerator__compareTop">
                        {renderSourceStrip()}
                        <div className="accelerator__responsiveToolbarRow">
                          <ResponsiveToolbar viewport={viewport} onChange={setViewport} />
                        </div>
                      </div>
                      {renderActivityToggle()}
                    </div>
                  ) : null}

                  <div className="accelerator__stageBody">
                    {effectiveTab === "overview" && vm.state === "analyzing" ? (
                      <section className="accelerator__loadingScreen" aria-label="Analyzing">
                        <DsTypography as="p" variant="paragraph-bold" role="status" className="accelerator__loadingStatus">
                          {vm.runStatusLabel}
                        </DsTypography>
                        <GenerationProgress
                          mode="analysis"
                          activeIndex={progressIndex}
                          thinkingItem={latestThinkingItem}
                          processLine={latestProcessItem?.text}
                        />
                        <DsButton variant="ghost" size="small" onClick={vm.handleStopAnalysis}>
                          Stop
                        </DsButton>
                        <DsAccordion variant="ghost" size="small" title="Show full activity log" defaultOpen={false}>
                          {renderStream("Waiting for updates…", vm.analysisStreamRef)}
                        </DsAccordion>
                      </section>
                    ) : null}

                    {effectiveTab === "directions" && vm.state === "generating" ? (
                      <section className="accelerator__loadingScreen" aria-label="Generating directions">
                        <DsTypography as="p" variant="paragraph-bold" role="status" className="accelerator__loadingStatus">
                          {vm.runStatusLabel}
                        </DsTypography>
                        <GenerationProgress
                          mode="directions"
                          activeIndex={progressIndex}
                          thinkingItem={latestThinkingItem}
                          processLine={latestProcessItem?.text}
                        />
                        <DsButton variant="ghost" size="small" onClick={vm.handleStopAnalysis}>
                          Stop
                        </DsButton>
                        <DsAccordion variant="ghost" size="small" title="Show full activity log" defaultOpen={false}>
                          {renderStream("Waiting for updates…", vm.analysisStreamRef)}
                        </DsAccordion>
                      </section>
                    ) : null}

                    {effectiveTab === "overview" && vm.understanding ? (
                      <section className="accelerator__understandScreen" aria-label="Analysis">
                        <UnderstandingReview
                          ref={understandingHeadingRef}
                          brief={vm.understanding}
                          targetLabel={vm.resolvedPreviewTarget.label}
                          resolvedAnswers={resolvedAnswers}
                          onResolveQuestion={handleResolveQuestion}
                        />

                        <div className="accelerator__reviewNext" aria-label="Before you continue">
                          <DsTypography as="h3" variant="paragraph-small-bold" className="accelerator__reviewNextTitle">
                            Anything to add before generating directions?
                          </DsTypography>
                          <div className="accelerator__addContext" ref={addContextRef}>
                            {addContextOpen ? (
                              <>
                                <AiAgentInput
                                  placeholder="Add context, correct something, or attach another source…"
                                  onSend={vm.handleClarify}
                                  sendLabel="Update analysis"
                                />
                                {vm.intakeErrorMessage ? (
                                  <div className="accelerator__errorCard" role="alert">
                                    <DsTypography as="p" variant="paragraph-regular">
                                      {vm.intakeErrorMessage}
                                    </DsTypography>
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <DsButton
                                variant="ghost"
                                size="small"
                                className="accelerator__addContextTrigger"
                                onClick={() => setAddContextOpen(true)}
                              >
                                Add context
                              </DsButton>
                            )}
                          </div>
                        </div>

                        <div className="accelerator__reviewActionBar">
                          <DsButton
                            variant="primary"
                            size="regular"
                            onClick={() => void vm.handleConfirmUnderstanding(buildAmendmentFromAnswers())}
                            disabled={!vm.canGenerateDirections}
                          >
                            Generate directions
                          </DsButton>
                        </div>
                      </section>
                    ) : null}

                    {effectiveTab === "directions" && vm.directions.length > 0 ? (
                      <section
                        className="accelerator__compareScreen"
                        aria-label={vm.directions.length > 1 ? "Compare directions" : "Recommended direction"}
                      >
                        {renderOriginalComponent()}
                        {vm.directions.length > 1 ? (
                          <div className="accelerator__compareStrip" aria-label="How these directions differ">
                            <DsTypography as="span" variant="paragraph-mini-bold" className="accelerator__compareStripLabel">
                              How they differ
                            </DsTypography>
                            <div className="accelerator__compareStripRow">
                              {vm.directions.map((direction, index) => (
                                <span key={direction.id} className="accelerator__compareStripItem">
                                  <span className="accelerator__compareStripLetter">{String.fromCharCode(65 + index)}</span>
                                  {direction.differentiationAxis ||
                                    (direction.highlights ?? []).slice(0, 2).join(" · ") ||
                                    direction.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="accelerator__directionGrid">
                          {vm.directions.map((direction, index) => (
                            <DirectionCard
                              key={direction.id}
                              direction={direction}
                              index={index}
                              soloDirection={vm.directions.length === 1}
                              chosen={vm.chosenDirectionId === direction.id}
                              onChoose={() => vm.handleChooseDirection(direction.id)}
                              viewport={viewport}
                              onResizeWidth={handleResizeWidth}
                              onPreviewStatusChange={vm.updateDirectionPreviewStatus}
                            />
                          ))}
                        </div>
                        <div className="accelerator__directionsFooter">
                          <RefineControl onRefine={vm.handleRefine} />
                        </div>
                        {vm.chosenDirection ? (
                          <div className="accelerator__commitBar" role="region" aria-label="Apply the chosen direction">
                            <div className="accelerator__commitInfo">
                              {vm.directions.length > 1 ? (
                                <span className="accelerator__commitEyebrow">
                                  Direction{" "}
                                  {String.fromCharCode(
                                    65 + Math.max(0, vm.directions.findIndex((d) => d.id === vm.chosenDirectionId)),
                                  )}
                                </span>
                              ) : null}
                              <span className="accelerator__commitTitle">{vm.chosenDirection.title}</span>
                            </div>
                            {vm.repositoryConnected ? (
                              <DsButton
                                variant="primary"
                                size="regular"
                                onClick={() => void vm.handleConfirmChoice()}
                                disabled={!vm.canApply}
                              >
                                Apply direction
                              </DsButton>
                            ) : (
                              <div className="accelerator__commitBlocked" role="status">
                                <DsTypography as="p" variant="paragraph-small">
                                  No writable repository connected — connect one to apply this direction.
                                </DsTypography>
                                <DsButton variant="secondary" size="small" onClick={() => openSettings("workspace")}>
                                  Connect a repository →
                                </DsButton>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {effectiveTab === "implementation" && (vm.state === "implementing" || vm.state === "implementationReady") ? (
                      <section className="accelerator__buildScreen" aria-label="Build status">
                        {vm.chosenDirection ? (
                          <div className="accelerator__buildSummary">
                            <DsTypography as="h2" variant="paragraph-bold">
                              {vm.chosenDirection.title}
                            </DsTypography>
                            {vm.chosenDirection.summary ? (
                              <DsTypography as="p" variant="paragraph-small">
                                {vm.chosenDirection.summary}
                              </DsTypography>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="accelerator__buildingRow" aria-live="polite">
                          {vm.isPromoting ? <DsSpinner size={14} aria-hidden /> : null}
                          <DsTypography as="p" variant="paragraph-regular">
                            {vm.isPromoting
                              ? `Applying "${vm.chosenDirection?.title ?? "your direction"}"…`
                              : vm.state === "implementationReady"
                                ? `Couldn't apply "${vm.chosenDirection?.title ?? "your direction"}".`
                                : "Applying…"}
                          </DsTypography>
                        </div>
                        {vm.state === "implementationReady" ? (
                          <div className="accelerator__phaseAction">
                            <DsButton variant="primary" size="regular" onClick={() => void vm.handleConfirmChoice()}>
                              Try again
                            </DsButton>
                            {vm.promoteErrorMessage ? (
                              <DsTypography as="p" variant="paragraph-small" className="accelerator__inlineError">
                                {vm.promoteErrorMessage}
                              </DsTypography>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {(vm.state === "analysisStopped" && effectiveTab === "overview") ||
                    (vm.state === "error" && effectiveTab === errorTab) ? (
                      <section className="accelerator__errorScreen" aria-label="Error">
                        <section
                          className="accelerator__artifactCard accelerator__artifactCard--warning"
                          tabIndex={-1}
                          ref={errorCardRef}
                        >
                          <DsTypography as="p" variant="paragraph-regular" className="accelerator__errorText">
                            {vm.state === "error"
                              ? vm.errorMessage || "The run didn't finish. You can try again."
                              : "The analysis was stopped."}
                          </DsTypography>
                          <DsButton
                            variant="secondary"
                            size="small"
                            onClick={() => void vm.handleRetryRun()}
                            className="accelerator__errorRetry"
                          >
                            Try again
                          </DsButton>
                        </section>
                        <DsAccordion variant="ghost" size="small" title="Show full activity log" defaultOpen={false}>
                          {renderStream("Waiting for updates…", vm.analysisStreamRef)}
                        </DsAccordion>
                      </section>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>
      {historyOpen ? (
        <HistoryDrawer
          entries={historyEntries}
          onClose={() => setHistoryOpen(false)}
          returnFocusRef={historyTriggerRef}
          onRestore={(entry) => {
            vm.restoreFromHistory(entry);
            setExamplePrefill(entry.baseContext);
            setRestoredSources(toInputSources(entry.sources));
            setHistoryOpen(false);
          }}
          onClear={() => {
            clearHistory();
            setHistoryEntries([]);
          }}
        />
      ) : null}
    </main>
  );
}
