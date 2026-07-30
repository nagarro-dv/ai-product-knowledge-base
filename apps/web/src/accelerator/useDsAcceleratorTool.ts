import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelAgentJob,
  fetchAgentProviders,
  getAgentJob,
  postAgentChatStream,
  startAgentJob,
  streamAgentJob,
  type AgentJobStatus,
  type AgentProvider,
} from "../agentSseClient";
import { resolveActiveAuthMethod, subscribeAuthPreferences } from "../aiProviders/authPreferences";
import { fetchIntegrations } from "../integrations/jiraClient";
import { publishToGithub } from "../integrations/repositoryClient";
import type { AiAgentInputSendPayload } from "../components/custom/AiAgentInput";
import { buildDuplicateCorrectionNote, buildTooFewDirectionsCorrectionNote, findNearDuplicatePair } from "./directionQuality";
import { hasRealDirections, parseAnalysisOutput, parseProposalOutput, parseUnderstanding } from "./parsers";
import { buildProposalPrompt, buildTextDirectionsPrompt, buildUnderstandingPrompt } from "./prompts";
import { appendHistory, summarizeContext } from "./runHistory";
import { discardProposalRun, prepareProposalPreviews, promoteDirection } from "./proposalClient";
import { extractTicketKey, resolveTaskFolder } from "./task-docs";
import {
  ACTIVE_JOB_KEY,
  SNAPSHOT_KEY,
  SNAPSHOT_MAX_STREAM_ITEMS,
  STREAM_IDLE_RECONNECT_MS,
  collectFigmaUrls,
  formatStreamLine,
  mapPayloadSource,
  mergeStreamChunks,
  resolvePreviewTarget,
  safeReadSession,
  safeRemoveSession,
  safeWriteSession,
  toReadableAgentError,
} from "./tool-utils";
import type {
  AnalysisOutput,
  Direction,
  PreviewTarget,
  RunPhase,
  SourceEntry,
  StreamItem,
  ToolState,
  UnderstandingBrief,
} from "./types";

function newRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/** Bump when the snapshot shape or state semantics change — mismatched snapshots are dropped, not misread. */
const SNAPSHOT_VERSION = 2;

type SessionSnapshot = {
  version: number;
  state: ToolState;
  primaryFigma: string;
  primaryTicket: string;
  baseContext: string;
  sources: SourceEntry[];
  understanding: UnderstandingBrief | null;
  runPhase: RunPhase | null;
  analysis: AnalysisOutput | null;
  directions: Direction[];
  runId: string | null;
  chosenDirectionId: string | null;
  streamItems: StreamItem[];
  promotedFiles: string[];
  hasPromoted: boolean;
  promoteErrorMessage: string | null;
  generationStreamOffset: number;
  generationJobStatus: AgentJobStatus | null;
};

export function useDsAcceleratorTool() {
  const [state, setState] = useState<ToolState>("intake");
  const [primaryFigma, setPrimaryFigma] = useState("");
  const [primaryTicket, setPrimaryTicket] = useState("");
  const [baseContext, setBaseContext] = useState("");
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [understanding, setUnderstanding] = useState<UnderstandingBrief | null>(null);
  const [runPhase, setRunPhase] = useState<RunPhase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisOutput | null>(null);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [chosenDirectionId, setChosenDirectionId] = useState<string | null>(null);
  const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intakeErrorMessage, setIntakeErrorMessage] = useState<string | null>(null);
  const [promoteErrorMessage, setPromoteErrorMessage] = useState<string | null>(null);
  const [hasPromoted, setHasPromoted] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotedFiles, setPromotedFiles] = useState<string[]>([]);
  const [publishBranch, setPublishBranch] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ prUrl: string; prNumber: number } | null>(null);
  const [publishErrorMessage, setPublishErrorMessage] = useState<string | null>(null);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationJobStatus, setGenerationJobStatus] = useState<AgentJobStatus | null>(null);
  const [generationStreamOffset, setGenerationStreamOffset] = useState(-1);
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [authPreferenceVersion, setAuthPreferenceVersion] = useState(0);

  const analysisStreamRef = useRef<HTMLDivElement | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const isHydratingFromSnapshotRef = useRef(false);
  const pendingDiscardRunIdRef = useRef<string | null>(null);

  useEffect(() => subscribeAuthPreferences(() => setAuthPreferenceVersion((v) => v + 1)), []);

  const activeProvider = useMemo(
    () => providers.find((p) => p.id === selectedProvider),
    [providers, selectedProvider],
  );
  // authPreferenceVersion re-derives the active method when the user changes
  // their choice on the AI Providers page.
  const activeAuthMethod = useMemo(
    () => resolveActiveAuthMethod(activeProvider),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProvider, authPreferenceVersion],
  );
  const activeProviderConnectedMethods = useMemo(
    () => activeProvider?.authMethods?.filter((method) => method.ok).length ?? 0,
    [activeProvider],
  );
  /** Only agentic runtimes (Claude Code, Cursor) can read/write real files — everything else is text-only. */
  const activeCanEditFiles = activeAuthMethod?.capabilities?.localRepoEdits ?? false;

  /**
   * Real code generation needs BOTH a capable engine AND a workspace
   * repository to point it at — a Storybook (e.g. a public, third-party one)
   * never implies a writable repo. Without one, everything degrades to the
   * existing text-only pipeline: honest analysis/directions, no fabricated
   * code preview, and Apply is separately blocked outright (see canApply).
   */
  const [repositoryConnected, setRepositoryConnected] = useState(false);
  /** 'github' unlocks the post-Apply "Publish to GitHub" action; 'local' and null don't. */
  const [repositoryKind, setRepositoryKind] = useState<string | null>(null);
  const [repositoryDefaultBranch, setRepositoryDefaultBranch] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetchIntegrations({ signal: controller.signal })
      .then((list) => {
        const repo = list.find((i) => i.id === "repository");
        setRepositoryConnected(repo?.status === "connected");
        setRepositoryKind(repo?.status === "connected" ? (repo.kind ?? null) : null);
        setRepositoryDefaultBranch(repo?.status === "connected" ? (repo.defaultBranch ?? null) : null);
      })
      .catch(() => {
        setRepositoryConnected(false);
        setRepositoryKind(null);
        setRepositoryDefaultBranch(null);
      });
    return () => controller.abort();
  }, []);
  const canGenerateRealCode = activeCanEditFiles && repositoryConnected;

  const ticketKey = useMemo(() => extractTicketKey(primaryTicket), [primaryTicket]);
  const taskFolder = useMemo(() => resolveTaskFolder(ticketKey).taskFolder, [ticketKey]);
  const resolvedPreviewTarget: PreviewTarget = useMemo(
    () => resolvePreviewTarget(sources, baseContext, analysis?.changeIntent ?? null),
    [analysis?.changeIntent, baseContext, sources],
  );
  const chosenDirection = directions.find((d) => d.id === chosenDirectionId) ?? null;
  const canConfirmChoice = state === "directionsReady" && chosenDirectionId !== null;
  /**
   * Choosing a direction and being ALLOWED to apply it are separate gates —
   * browsing, analysis, and comparing directions never needed a writable
   * repository, only Apply does.
   */
  const canApply = canConfirmChoice && repositoryConnected;
  const canGenerateDirections = state === "analysisReady" && understanding !== null && !isBusy;
  const inPromoteFlow = state === "implementing" || state === "implementationReady" || state === "implementationSuccess";
  const showBackHomeArrow = state !== "intake" && !isBusy;

  const runStatusLabel = useMemo(() => {
    if (isPromoting) return "Applying the chosen direction…";
    if (state === "analyzing") return "Analyzing your request…";
    if (state === "analysisReady") return "Analysis ready — review it before generating.";
    if (state === "generating") return "Generating directions…";
    if (state === "implementationReady") return "Couldn't apply — try again.";
    if (state === "implementationSuccess") return "Direction applied";
    if (state === "analysisStopped") return "Analysis stopped";
    if (state === "error") return liveStatus;
    return `${directions.length} direction${directions.length === 1 ? "" : "s"} generated`;
  }, [directions.length, isPromoting, liveStatus, state]);

  const clearPersistence = useCallback(() => {
    safeRemoveSession(SNAPSHOT_KEY);
    safeRemoveSession(ACTIVE_JOB_KEY);
  }, []);

  const appendStream = useCallback((item: Omit<StreamItem, "id">) => {
    setStreamItems((current) => {
      if (item.kind === "assistant" || item.kind === "thinking") {
        const last = current[current.length - 1];
        if (last && last.kind === item.kind) {
          return [...current.slice(0, -1), { ...last, text: mergeStreamChunks(last.text, item.text) }];
        }
      }
      return [...current, { id: `stream-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, ...item }];
    });
  }, []);

  /** Best-effort — never blocks the UI. Frees an abandoned run's staged files. */
  const discardRun = useCallback((id: string | null) => {
    if (!id) return;
    void discardProposalRun(id).catch(() => {
      // best effort
    });
  }, []);

  const consumeGenerationJob = useCallback(
    async (jobId: string, startAfter: number, phase: RunPhase): Promise<string | null> => {
      const controller = new AbortController();
      generationAbortRef.current = controller;
      let after = startAfter;
      let draftOutput = "";
      let consecutiveDrops = 0;
      const MAX_CONSECUTIVE_DROPS = 8;
      try {
        while (true) {
          const streamController = new AbortController();
          const abortParentToChild = () => streamController.abort("parent-abort");
          controller.signal.addEventListener("abort", abortParentToChild);
          const idleTimeout = window.setTimeout(() => streamController.abort("idle-timeout"), STREAM_IDLE_RECONNECT_MS);
          try {
            await streamAgentJob(
              jobId,
              (event) => {
                after += 1;
                consecutiveDrops = 0;
                setGenerationStreamOffset(after);
                if (event.kind === "text_delta" && event.text) draftOutput += event.text;
                if (event.kind === "status" && event.status) setLiveStatus(event.status);
                const line = formatStreamLine(event);
                if (line) appendStream(line);
              },
              { after, signal: streamController.signal },
            );
          } catch (error) {
            // A long job reconnects often (idle timeout, a dropped connection) — anything
            // that isn't the user explicitly cancelling should be retried, not treated as
            // fatal. DOMException names vary by browser/cause (AbortError, NetworkError, …),
            // so we don't gate reconnection on a specific one.
            if (String(streamController.signal.reason ?? "") === "parent-abort") throw error;
            consecutiveDrops += 1;
            if (consecutiveDrops > MAX_CONSECUTIVE_DROPS) throw error;
            appendStream({ kind: "status", text: "Reconnecting…" });
          } finally {
            window.clearTimeout(idleTimeout);
            controller.signal.removeEventListener("abort", abortParentToChild);
          }
          const summary = await getAgentJob(jobId, { signal: controller.signal });
          consecutiveDrops = 0;
          setGenerationJobStatus(summary.status);
          if (summary.status === "queued" || summary.status === "running") continue;
          if (summary.status === "finished") {
            return summary.result?.output?.trim() || draftOutput.trim();
          }
          if (summary.status === "cancelled") {
            if (phase === "directions") {
              // Stopping direction generation returns to the checkpoint — the
              // confirmed analysis is still valid, no need to start over.
              appendStream({ kind: "status", text: "Generation stopped — you're back at the analysis." });
              setState("analysisReady");
            } else {
              setState("analysisStopped");
            }
            setLiveStatus("Stopped");
            return null;
          }
          setState("error");
          setErrorMessage(
            summary.error ||
              (phase === "directions"
                ? "The generation didn't finish. You can try again."
                : "The analysis didn't finish. You can try again."),
          );
          setLiveStatus("Error");
          return null;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return null;
        setState("error");
        setErrorMessage(toReadableAgentError(error));
        setLiveStatus("Error");
        return null;
      } finally {
        generationAbortRef.current = null;
        setIsBusy(false);
      }
    },
    [appendStream],
  );

  useEffect(() => {
    window.setTimeout(() => {
      if (analysisStreamRef.current) {
        analysisStreamRef.current.scrollTop = analysisStreamRef.current.scrollHeight;
      }
    }, 0);
  }, [streamItems, state]);

  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const list = await fetchAgentProviders({ signal: controller.signal });
        setProviders(list);
        const firstHealthy = list.find((p) => p.ok) ?? list[0];
        if (firstHealthy) setSelectedProvider(firstHealthy.id);
        setProvidersError(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProvidersError("We couldn't load the AI engines. The default engine will be used.");
      } finally {
        setProvidersLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const rawSnapshot = safeReadSession(SNAPSHOT_KEY);
    const rawJobId = safeReadSession(ACTIVE_JOB_KEY);
    if (!rawSnapshot) {
      // A job id without a snapshot has no phase context — unrecoverable.
      if (rawJobId) clearPersistence();
      return;
    }
    let restoredOffset = -1;
    let restoredRunId: string | null = null;
    let restoredPhase: RunPhase = "understanding";
    let restoredState: ToolState = "intake";
    try {
      const snapshot = JSON.parse(rawSnapshot) as SessionSnapshot;
      if (snapshot.version !== SNAPSHOT_VERSION) {
        clearPersistence();
        return;
      }
      isHydratingFromSnapshotRef.current = true;
      restoredState = snapshot.state;
      if ((restoredState === "analyzing" || restoredState === "generating") && !rawJobId) {
        // A run was in flight but there's no job to resume (stopped locally, a
        // chat-stream run, or expired) — land on the nearest stable screen
        // instead of a spinner nobody will ever resolve.
        restoredState = snapshot.understanding ? "analysisReady" : "intake";
      }
      setState(restoredState);
      setPrimaryFigma(snapshot.primaryFigma);
      setPrimaryTicket(snapshot.primaryTicket);
      setBaseContext(snapshot.baseContext);
      setSources(snapshot.sources);
      setUnderstanding(snapshot.understanding);
      setRunPhase(snapshot.runPhase);
      setAnalysis(snapshot.analysis);
      setDirections(snapshot.directions);
      setRunId(snapshot.runId);
      setChosenDirectionId(snapshot.chosenDirectionId);
      setStreamItems(snapshot.streamItems);
      setPromotedFiles(snapshot.promotedFiles);
      setHasPromoted(snapshot.hasPromoted);
      setPromoteErrorMessage(snapshot.promoteErrorMessage);
      setGenerationStreamOffset(snapshot.generationStreamOffset);
      setGenerationJobStatus(snapshot.generationJobStatus);
      restoredOffset = Number.isFinite(snapshot.generationStreamOffset) ? snapshot.generationStreamOffset : -1;
      restoredRunId = snapshot.runId;
      restoredPhase = snapshot.runPhase ?? "understanding";
    } catch {
      clearPersistence();
      return;
    } finally {
      isHydratingFromSnapshotRef.current = false;
    }
    if (!rawJobId) {
      // No job to resume, but if we landed straight into a state where
      // directions/previews are on screen, the staged preview files may be
      // stale or gone (the server sweeps any staging dir older than 2h) or
      // were never prepared this session (e.g. a snapshot restored after a
      // full reload). Re-running prepare is cheap — it only re-copies
      // already-generated files, no AI call — and keeps previews honest
      // instead of leaving a previewModulePath that 404s in the iframe.
      if (
        restoredRunId &&
        (restoredState === "directionsReady" || restoredState === "implementing" || restoredState === "implementationReady")
      ) {
        void prepareProposalPreviews(restoredRunId).catch(() => {
          // Best-effort — an individual preview iframe will report its own load error if this fails.
        });
      }
      return;
    }
    setGenerationJobId(rawJobId);
    void (async () => {
      setIsBusy(true);
      try {
        const summary = await getAgentJob(rawJobId);
        setGenerationJobStatus(summary.status);
        const finishPhase = async (output: string) => {
          if (restoredPhase === "directions") {
            if (restoredRunId) {
              try {
                await prepareProposalPreviews(restoredRunId);
              } catch {
                // best effort — previews will show their own load error instead
              }
            }
            const parsed = parseProposalOutput(output, restoredRunId ?? "");
            if (!hasRealDirections(parsed.directions)) {
              setState("error");
              setErrorMessage("The AI didn't return any usable directions for this request. Try again, or add more detail and generate again.");
              setLiveStatus("Error");
              return;
            }
            setAnalysis(parsed);
            setDirections(parsed.directions);
            setState("directionsReady");
          } else {
            setUnderstanding(parseUnderstanding(output));
            setState("analysisReady");
          }
        };
        if (summary.status === "queued" || summary.status === "running") {
          setState(restoredPhase === "directions" ? "generating" : "analyzing");
          const output = await consumeGenerationJob(rawJobId, restoredOffset, restoredPhase);
          if (output) await finishPhase(output);
          return;
        }
        if (summary.status === "finished") {
          await finishPhase(summary.result?.output?.trim() || "");
          return;
        }
        if (summary.status === "cancelled") {
          // A cancelled directions job returns to the checkpoint — the confirmed
          // analysis is still valid. Only a cancelled analysis is a dead stop.
          setState(restoredPhase === "directions" ? "analysisReady" : "analysisStopped");
          return;
        }
        setState("error");
        setErrorMessage(summary.error || "The run didn't finish.");
      } catch {
        clearPersistence();
        setGenerationJobId(null);
      } finally {
        setIsBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isHydratingFromSnapshotRef.current) return;
    // Persist across the whole mid-journey band — a reload at the checkpoint
    // or the direction comparison must not silently discard the run.
    const recoverable =
      state === "analyzing" || state === "analysisReady" || state === "generating" || state === "directionsReady";
    if (!recoverable && !generationJobId) {
      if (state === "intake") clearPersistence();
      return;
    }
    const snapshot: SessionSnapshot = {
      version: SNAPSHOT_VERSION,
      state,
      primaryFigma,
      primaryTicket,
      baseContext,
      sources,
      understanding,
      runPhase,
      analysis,
      directions,
      runId,
      chosenDirectionId,
      streamItems: streamItems.slice(-SNAPSHOT_MAX_STREAM_ITEMS),
      promotedFiles,
      hasPromoted,
      promoteErrorMessage,
      generationStreamOffset,
      generationJobStatus,
    };
    if (!safeWriteSession(SNAPSHOT_KEY, JSON.stringify(snapshot))) clearPersistence();
    if (generationJobId) safeWriteSession(ACTIVE_JOB_KEY, generationJobId);
  }, [
    analysis,
    baseContext,
    chosenDirectionId,
    clearPersistence,
    directions,
    generationJobId,
    generationJobStatus,
    generationStreamOffset,
    hasPromoted,
    primaryFigma,
    primaryTicket,
    promoteErrorMessage,
    promotedFiles,
    runId,
    runPhase,
    sources,
    state,
    streamItems,
    understanding,
  ]);

  /** Chat-stream runner for text-only engines. Returns output text, or null after handling stop/error itself. */
  const runChatPhase = async (prompt: string, phase: RunPhase, figmaUrls: string[] = []): Promise<string | null> => {
    setIsBusy(true);
    let draftText = "";
    const controller = new AbortController();
    generationAbortRef.current = controller;
    try {
      const done = await postAgentChatStream(
        {
          messages: [{ role: "user", content: prompt }],
          ...(selectedProvider && { provider: selectedProvider }),
          ...(selectedProvider && activeAuthMethod && { authMethod: activeAuthMethod.id }),
          ...(figmaUrls.length > 0 && { figmaUrls }),
        },
        (event) => {
          if (event.kind === "text_delta" && event.text) draftText += event.text;
          if (event.kind === "status" && event.status) setLiveStatus(event.status);
          const line = formatStreamLine(event);
          if (line) appendStream(line);
        },
        { signal: controller.signal },
      );
      return done.output?.trim() || draftText.trim();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (phase === "directions") {
          appendStream({ kind: "status", text: "Generation stopped — you're back at the analysis." });
          setState("analysisReady");
        } else {
          setState("analysisStopped");
        }
        setLiveStatus("Stopped");
        return null;
      }
      setState("error");
      setErrorMessage(toReadableAgentError(error));
      setLiveStatus("Error");
      return null;
    } finally {
      generationAbortRef.current = null;
      setIsBusy(false);
    }
  };

  /** Job runner for agentic engines. Returns output text, or null after handling stop/error itself. */
  const runJobPhase = async (prompt: string, phase: RunPhase, figmaUrls: string[] = []): Promise<string | null> => {
    setIsBusy(true);
    try {
      const { jobId } = await startAgentJob({
        messages: [{ role: "user", content: prompt }],
        ...(selectedProvider && { provider: selectedProvider }),
        ...(selectedProvider && activeAuthMethod && { authMethod: activeAuthMethod.id }),
        ...(figmaUrls.length > 0 && { figmaUrls }),
      });
      setGenerationJobId(jobId);
      setGenerationJobStatus("queued");
      setGenerationStreamOffset(-1);
      safeWriteSession(ACTIVE_JOB_KEY, jobId);
      return await consumeGenerationJob(jobId, -1, phase);
    } catch (error) {
      setGenerationJobId(null);
      setState("error");
      setErrorMessage(toReadableAgentError(error));
      setLiveStatus("Error");
      setIsBusy(false);
      return null;
    } finally {
      safeRemoveSession(ACTIVE_JOB_KEY);
    }
  };

  /**
   * Phase 1 — analysis only. Read-capable for agentic engines but forbidden
   * from writing; ends at the checkpoint (`analysisReady`) where the user
   * reviews the AI's understanding before any implementation time is spent.
   */
  const executeUnderstanding = async (nextSources: SourceEntry[], context: string, figma: string, ticket: string) => {
    // Any staged directions from a previous run are now stale — free them.
    discardRun(runId);
    setRunId(null);
    setGenerationJobId(null);
    setState("analyzing");
    setRunPhase("understanding");
    setStreamItems([]);
    setUnderstanding(null);
    setAnalysis(null);
    setDirections([]);
    setChosenDirectionId(null);
    setHasPromoted(false);
    setPromotedFiles([]);
    setPromoteErrorMessage(null);
    setErrorMessage(null);
    setIntakeErrorMessage(null);
    setLiveStatus("Analyzing your request…");

    const componentSource = nextSources.find((source) => source.kind === "component");
    const figmaUrls = collectFigmaUrls(nextSources, figma);
    const figmaMcpAvailable = figmaUrls.length > 0 && Boolean(activeAuthMethod?.mcpServers?.includes("figma"));
    const prompt = buildUnderstandingPrompt({
      primaryFigma: figma,
      primaryTicket: ticket,
      baseContext: context,
      sources: nextSources,
      selectedComponentId: componentSource?.storybook?.componentPath,
      selectedComponentLabel: componentSource?.value,
      canReadRepo: canGenerateRealCode,
      figmaMcpAvailable,
    });
    const output = canGenerateRealCode
      ? await runJobPhase(prompt, "understanding", figmaUrls)
      : await runChatPhase(prompt, "understanding", figmaUrls);
    if (!output) return;
    setUnderstanding(parseUnderstanding(output));
    setState("analysisReady");
    setLiveStatus("Analysis ready");
  };

  /**
   * Phase 2 — direction generation, only reachable after the user confirmed
   * the understanding at the checkpoint. Seeds the prompt with the approved
   * brief so the engine builds on the reviewed interpretation instead of
   * re-deriving its own.
   */
  const executeDirections = async (amendment?: string, nextSources?: SourceEntry[]) => {
    if (!understanding) return;
    // Callers that just merged a new source (e.g. handleRefine attaching one
    // via Refine) pass it explicitly rather than relying on the `sources`
    // state — setSources() called moments earlier in the same tick hasn't
    // committed yet, so the closure below would still see the stale value.
    const sourcesForRun = nextSources ?? sources;
    let context = baseContext;
    const trimmedAmendment = amendment?.trim() ?? "";
    if (trimmedAmendment) {
      context = context.trim() ? `${context.trim()}\n\nAlso: ${trimmedAmendment}` : trimmedAmendment;
      setBaseContext(context);
    }

    discardRun(runId);
    setGenerationJobId(null);
    setState("generating");
    setRunPhase("directions");
    setStreamItems([]);
    setDirections([]);
    setChosenDirectionId(null);
    setHasPromoted(false);
    setPromotedFiles([]);
    setPromoteErrorMessage(null);
    setErrorMessage(null);

    const componentSource = sourcesForRun.find((source) => source.kind === "component");
    const figmaUrls = collectFigmaUrls(sourcesForRun, primaryFigma);
    const figmaMcpAvailable = figmaUrls.length > 0 && Boolean(activeAuthMethod?.mcpServers?.includes("figma"));
    const shared = {
      primaryFigma,
      primaryTicket,
      baseContext: context,
      sources: sourcesForRun,
      selectedComponentId: componentSource?.storybook?.componentPath,
      selectedComponentLabel: componentSource?.value,
    };

    // Max 3 generation attempts: a first pass, and — only if that pass
    // returns fewer than 2 directions or two that read as the same solution
    // twice — up to two automatic retries with a specific correction. The
    // product requires at least 2 genuinely different directions for every
    // request; there is no collapse-to-one fallback. If every attempt still
    // fails the check, the run ends in an error state rather than presenting
    // a single direction or a fake comparison. See directionQuality.ts for
    // what "too few" and "the same solution twice" mean here — this is the
    // actual enforcement gate; the prompt instructions alone (asking the
    // model to self-differentiate) are not trusted on their own.
    const MAX_DIRECTION_ATTEMPTS = 3;
    const TOO_FEW_ERROR_MESSAGE =
      "The AI couldn't produce two genuinely different design directions for this request after several attempts. Try again, or add more detail to help it explore different approaches.";

    if (!canGenerateRealCode) {
      setRunId(null);
      let correctionNote: string | undefined;
      for (let attempt = 1; attempt <= MAX_DIRECTION_ATTEMPTS; attempt += 1) {
        setLiveStatus(attempt === 1 ? "Generating directions…" : "First pass wasn't a real comparison — regenerating…");
        const output = await runChatPhase(
          buildTextDirectionsPrompt({ ...shared, confirmedBrief: understanding, figmaMcpAvailable, correctionNote }),
          "directions",
          figmaUrls,
        );
        if (!output) return;
        const parsed = parseAnalysisOutput(output);
        if (!hasRealDirections(parsed.directions)) {
          setState("error");
          setErrorMessage("The AI didn't return any usable directions for this request. Try again, or add more detail and generate again.");
          setLiveStatus("Error");
          return;
        }
        const tooFew = parsed.directions.length < 2;
        const duplicate = tooFew ? null : findNearDuplicatePair(parsed.directions);
        if (!tooFew && !duplicate) {
          setAnalysis(parsed);
          setDirections(parsed.directions);
          setState("directionsReady");
          return;
        }
        if (attempt === MAX_DIRECTION_ATTEMPTS) {
          setState("error");
          setErrorMessage(TOO_FEW_ERROR_MESSAGE);
          setLiveStatus("Error");
          return;
        }
        correctionNote = tooFew ? buildTooFewDirectionsCorrectionNote(parsed.directions.length) : buildDuplicateCorrectionNote(duplicate!);
        appendStream({
          kind: "status",
          text: tooFew
            ? "Only one direction was produced — regenerating a genuinely different second option."
            : "The two directions were too similar to be a real comparison — regenerating a clearer alternative.",
        });
      }
      return;
    }

    let correctionNote: string | undefined;
    let previousAttemptRunId: string | null = null;
    for (let attempt = 1; attempt <= MAX_DIRECTION_ATTEMPTS; attempt += 1) {
      if (previousAttemptRunId) discardRun(previousAttemptRunId);
      const attemptRunId = newRunId();
      previousAttemptRunId = attemptRunId;
      setRunId(attemptRunId);
      setLiveStatus(
        attempt === 1
          ? "Generating directions from your confirmed analysis…"
          : "First pass wasn't a real comparison — regenerating…",
      );
      const output = await runJobPhase(
        buildProposalPrompt({ runId: attemptRunId, ...shared, confirmedBrief: understanding, figmaMcpAvailable, correctionNote }),
        "directions",
        figmaUrls,
      );
      if (!output) return;
      try {
        // Fills in unmodified sibling files (./DsTypography, ./Badge.css, …) so the preview
        // iframe's relative imports resolve — best effort; a failure here shouldn't hide
        // otherwise-valid directions, previews will just show their own load error instead.
        await prepareProposalPreviews(attemptRunId);
      } catch {
        appendStream({ kind: "status", text: "Some previews may not load — preparing the staging files failed." });
      }
      const parsed = parseProposalOutput(output, attemptRunId);
      if (!hasRealDirections(parsed.directions)) {
        setState("error");
        setErrorMessage("The AI didn't return any usable directions for this request. Try again, or add more detail and generate again.");
        setLiveStatus("Error");
        return;
      }
      const tooFew = parsed.directions.length < 2;
      const duplicate = tooFew ? null : findNearDuplicatePair(parsed.directions);
      if (!tooFew && !duplicate) {
        setAnalysis(parsed);
        setDirections(parsed.directions);
        setState("directionsReady");
        return;
      }
      if (attempt === MAX_DIRECTION_ATTEMPTS) {
        setState("error");
        setErrorMessage(TOO_FEW_ERROR_MESSAGE);
        setLiveStatus("Error");
        return;
      }
      correctionNote = tooFew ? buildTooFewDirectionsCorrectionNote(parsed.directions.length) : buildDuplicateCorrectionNote(duplicate!);
      appendStream({
        kind: "status",
        text: tooFew
          ? "Only one direction was produced — regenerating a genuinely different second option."
          : "The two directions were too similar to be a real comparison — regenerating a clearer alternative.",
      });
    }
  };

  /**
   * Blocks a run before it starts when it would reference a Figma source the
   * selected engine can't actually inspect — either because the engine has no
   * Figma MCP wiring at all, or because the MCP connection itself isn't
   * signed in right now. Checked fresh (not from mount-time state) so a
   * Connect completed on the Workspace page in another tab is picked up
   * immediately. Returns a user-facing message to block on, or null when
   * it's safe to proceed. Must be called from every path that can introduce
   * a Figma source before it reaches executeUnderstanding/executeDirections —
   * those only trust the caller, they never re-check connection status.
   */
  const checkFigmaReadiness = async (candidateSources: SourceEntry[], primaryFigmaUrl: string): Promise<string | null> => {
    const figmaUrlsInRequest = collectFigmaUrls(candidateSources, primaryFigmaUrl);
    if (figmaUrlsInRequest.length === 0 || !activeAuthMethod?.mcpServers?.includes("figma")) return null;
    try {
      const list = await fetchIntegrations();
      const figma = list.find((i) => i.id === "figma");
      if (figma?.status !== "connected") {
        return figma?.status === "needs-auth"
          ? "Figma is registered but not signed in — go to Settings → Workspace and connect Figma before analyzing this source."
          : "Connect Figma in Settings → Workspace first so the AI can actually inspect this frame, not just the link.";
      }
      return null;
    } catch {
      return "Couldn't check whether Figma is connected — make sure the assistant service is running, then try again.";
    }
  };

  const handleAiAgentInputSend = async (payload: AiAgentInputSendPayload) => {
    if (providersLoading) {
      setIntakeErrorMessage("The AI engines are still loading — try again in a moment.");
      return;
    }
    if (!payload.message.trim() && payload.sources.length === 0) {
      setIntakeErrorMessage("Describe the change or add at least one source to get started.");
      return;
    }
    const figmaSources = payload.sources.filter((source) => source.kind === "figma");
    const ticketSources = payload.sources.filter((source) => source.kind === "ticket");
    const nextPrimaryFigma = figmaSources[0]?.href ?? "";
    const nextPrimaryTicket = ticketSources[0]?.href ?? "";
    const primaryIds = new Set([figmaSources[0]?.id ?? "", ticketSources[0]?.id ?? ""]);
    const mappedSources = payload.sources.map(mapPayloadSource);
    const additionalSources = mappedSources.filter((source) => !primaryIds.has(source.id));
    const resolvedSources: SourceEntry[] = [...additionalSources];
    if (nextPrimaryFigma.trim()) {
      resolvedSources.unshift({
        id: `primary-figma-${Date.now()}`,
        kind: "figma",
        value: nextPrimaryFigma.trim(),
        context: payload.message.trim(),
      });
    }
    if (nextPrimaryTicket.trim()) {
      const key = extractTicketKey(nextPrimaryTicket);
      const resolution = resolveTaskFolder(key);
      resolvedSources.unshift({
        id: `primary-ticket-${Date.now()}`,
        kind: "ticket",
        value: nextPrimaryTicket.trim(),
        context: payload.message.trim(),
        ticketKey: key ?? undefined,
        taskFolder: resolution.taskFolder ?? undefined,
      });
    }
    const figmaError = await checkFigmaReadiness(resolvedSources, nextPrimaryFigma);
    if (figmaError) {
      setIntakeErrorMessage(figmaError);
      return;
    }
    setPrimaryFigma(nextPrimaryFigma.trim());
    setPrimaryTicket(nextPrimaryTicket.trim());
    setBaseContext(payload.message.trim());
    setSources(resolvedSources);
    setIntakeErrorMessage(null);
    const nextTicketKey = extractTicketKey(nextPrimaryTicket);
    const nextTicketResolution = resolveTaskFolder(nextTicketKey);
    const ticketLabel =
      nextPrimaryTicket.trim() && nextTicketResolution.taskFolder
        ? `${nextPrimaryTicket.trim()} (task: docs/tasks/${nextTicketResolution.taskFolder})`
        : nextPrimaryTicket.trim();
    await executeUnderstanding(resolvedSources, payload.message.trim(), nextPrimaryFigma.trim(), ticketLabel);
  };

  /**
   * A conversation turn at the checkpoint — the designer answers the AI's open
   * questions or adds context WITHOUT rewriting the original request. The
   * clarification is appended to the original base context (never replaces it)
   * and the analysis re-runs with everything it had before plus the new input.
   */
  const handleClarify = async (payload: AiAgentInputSendPayload) => {
    const clarification = payload.message.trim();
    if (!clarification && payload.sources.length === 0) return;
    const newSources = payload.sources.map(mapPayloadSource);
    const mergedSources = [
      ...sources,
      ...newSources.filter((next) => !sources.some((existing) => existing.id === next.id)),
    ];
    // A clarification can attach a new Figma source just like the initial
    // send — must be gated the same way, or an unauthenticated MCP server
    // gets claimed as available and the model hits a real tool failure mid-run.
    const figmaError = await checkFigmaReadiness(mergedSources, primaryFigma);
    if (figmaError) {
      setIntakeErrorMessage(figmaError);
      return;
    }
    setIntakeErrorMessage(null);
    const mergedContext = clarification
      ? `${baseContext.trim()}\n\nClarification from the designer: ${clarification}`.trim()
      : baseContext;
    setBaseContext(mergedContext);
    setSources(mergedSources);
    await executeUnderstanding(mergedSources, mergedContext, primaryFigma, primaryTicket);
  };

  const handleStopAnalysis = () => {
    if (generationJobId) {
      // Job-backed run: cancel server-side ONLY. consumeGenerationJob observes
      // the cancelled status and routes to the right state for the phase —
      // aborting the local consumer here would race that and strand the UI
      // in a running state nobody resolves.
      void cancelAgentJob(generationJobId).catch(() => {
        // best effort
      });
      return;
    }
    generationAbortRef.current?.abort();
  };

  /**
   * The checkpoint's primary action — the user approved the understanding, generate directions.
   * `amendment` carries any inline-resolved open questions, folded in the same way
   * `handleRefine` folds a refinement instruction — no separate re-analysis step.
   */
  const handleConfirmUnderstanding = async (amendment?: string) => {
    if (!canGenerateDirections) return;
    await executeDirections(amendment);
  };

  /**
   * Regenerates directions with a small added instruction and/or a newly
   * attached source, keeping the confirmed understanding. For corrections
   * that change the understanding itself, the user goes back to the
   * checkpoint instead. Mirrors handleClarify's merge pattern.
   */
  const handleRefine = async (payload: AiAgentInputSendPayload) => {
    const instruction = payload.message.trim();
    if (!instruction && payload.sources.length === 0) return;
    if (!understanding) return;
    const newSources = payload.sources.map(mapPayloadSource);
    const mergedSources = [
      ...sources,
      ...newSources.filter((next) => !sources.some((existing) => existing.id === next.id)),
    ];
    const figmaError = await checkFigmaReadiness(mergedSources, primaryFigma);
    if (figmaError) {
      setIntakeErrorMessage(figmaError);
      return;
    }
    setIntakeErrorMessage(null);
    setSources(mergedSources);
    await executeDirections(instruction, mergedSources);
  };

  /** Returns from the direction comparison to the checkpoint without losing anything. */
  const handleBackToAnalysis = () => {
    if (!hasPromoted) discardRun(runId);
    setRunId(null);
    setDirections([]);
    setChosenDirectionId(null);
    setAnalysis(null);
    setState("analysisReady");
    setLiveStatus("Analysis ready");
  };

  /** Re-runs whichever phase failed/stopped — the "try again" recovery action. */
  const handleRetryRun = async () => {
    if (runPhase === "directions" && understanding) {
      await executeDirections();
      return;
    }
    await executeUnderstanding(sources, baseContext, primaryFigma, primaryTicket);
  };

  const handleChooseDirection = (directionId: string) => {
    setChosenDirectionId((current) => (current === directionId ? null : directionId));
  };

  const updateDirectionPreviewStatus = (directionId: string, status: "ready" | "failed") => {
    setDirections((current) =>
      current.map((direction) => (direction.id === directionId ? { ...direction, previewStatus: status } : direction)),
    );
  };

  const handleConfirmChoice = async () => {
    if (isPromoting || !chosenDirectionId || hasPromoted) return;

    if (!runId) {
      // Text-only engines never generated real files — there's nothing to promote, just mark the run done.
      setIsPromoting(true);
      setState("implementing");
      appendStream({ kind: "status", text: "This engine only produced a text proposal — no files were changed." });
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      setPromotedFiles([]);
      setHasPromoted(true);
      setState("implementationSuccess");
      setIsPromoting(false);
      appendHistory({
        outcome: "applied",
        targetLabel: resolvedPreviewTarget.label,
        contextSummary: summarizeContext(baseContext, directions.map((d) => d.title)),
        baseContext,
        sources,
        directionTitles: directions.map((d) => d.title),
        appliedFilePaths: [],
        provider: activeProvider?.label,
      });
      return;
    }

    if (!chosenDirection || chosenDirection.affectedFiles.length === 0) {
      setPromoteErrorMessage("This direction didn't declare any affected files — nothing to apply.");
      setState("implementationReady");
      return;
    }

    setIsPromoting(true);
    setState("implementing");
    setPromoteErrorMessage(null);
    setLiveStatus("Applying the chosen direction…");
    try {
      const { promotedFiles: files, branch } = await promoteDirection(runId, chosenDirectionId, chosenDirection.affectedFiles);
      setPromotedFiles(files);
      setPublishBranch(branch);
      setPublishResult(null);
      setPublishErrorMessage(null);
      setHasPromoted(true);
      setPromoteErrorMessage(null);
      setState("implementationSuccess");
      appendHistory({
        outcome: "applied",
        targetLabel: resolvedPreviewTarget.label,
        contextSummary: summarizeContext(baseContext, directions.map((d) => d.title)),
        baseContext,
        sources,
        directionTitles: directions.map((d) => d.title),
        appliedFilePaths: files,
        provider: activeProvider?.label,
      });
    } catch (error) {
      setPromoteErrorMessage(toReadableAgentError(error));
      setHasPromoted(false);
      setState("implementationReady");
    } finally {
      setIsPromoting(false);
    }
  };

  /** GitHub-only: commits whatever Apply already wrote on this run's branch, pushes it, and opens (or reuses) a PR. */
  const handlePublish = async () => {
    if (isPublishing || !runId || !chosenDirectionId || !chosenDirection) return;
    setIsPublishing(true);
    setPublishErrorMessage(null);
    try {
      const result = await publishToGithub({
        runId,
        directionId: chosenDirectionId,
        title: chosenDirection.title,
        description: chosenDirection.summary,
      });
      setPublishResult({ prUrl: result.prUrl, prNumber: result.prNumber });
      setPublishBranch(result.branch);
    } catch (error) {
      setPublishErrorMessage(toReadableAgentError(error));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleBackHome = () => {
    if ((state === "error" || state === "analysisStopped") && (baseContext.trim() || sources.length > 0)) {
      appendHistory({
        outcome: state === "error" ? "error" : "stopped",
        targetLabel: resolvedPreviewTarget.label,
        contextSummary: summarizeContext(baseContext, directions.map((d) => d.title)),
        baseContext,
        sources,
        directionTitles: directions.map((d) => d.title),
        appliedFilePaths: [],
        provider: activeProvider?.label,
      });
    }
    if (!hasPromoted) discardRun(runId);
    generationAbortRef.current?.abort();
    setState("intake");
    setPrimaryFigma("");
    setPrimaryTicket("");
    setBaseContext("");
    setSources([]);
    setUnderstanding(null);
    setRunPhase(null);
    setAnalysis(null);
    setDirections([]);
    setRunId(null);
    setChosenDirectionId(null);
    setStreamItems([]);
    setIsBusy(false);
    setErrorMessage(null);
    setIntakeErrorMessage(null);
    setLiveStatus("Idle");
    setPromoteErrorMessage(null);
    setHasPromoted(false);
    setPromotedFiles([]);
    setGenerationJobId(null);
    setGenerationJobStatus(null);
    setGenerationStreamOffset(-1);
    setIsPromoting(false);
    clearPersistence();
  };

  /** Repopulates the intake from a history entry — does not replay old generated code. */
  const restoreFromHistory = (entry: { baseContext: string; sources: SourceEntry[] }) => {
    handleBackHome();
    setBaseContext(entry.baseContext);
    setSources(entry.sources);
  };

  const removeSource = (sourceId: string) => {
    setSources((current) => current.filter((source) => source.id !== sourceId));
  };

  // Free an abandoned run's staged files if the tab closes mid-review, without adding a
  // dependency loop — this ref mirrors the latest runId/hasPromoted for the unmount effect.
  pendingDiscardRunIdRef.current = hasPromoted ? null : runId;
  useEffect(() => {
    return () => {
      discardRun(pendingDiscardRunIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    baseContext,
    sources,
    providers,
    selectedProvider,
    setSelectedProvider,
    providersLoading,
    providersError,
    activeAuthMethod,
    activeProviderConnectedMethods,
    activeCanEditFiles,
    repositoryConnected,
    repositoryKind,
    repositoryDefaultBranch,
    canGenerateRealCode,
    understanding,
    runPhase,
    analysis,
    directions,
    runId,
    chosenDirectionId,
    chosenDirection,
    streamItems,
    errorMessage,
    intakeErrorMessage,
    promoteErrorMessage,
    hasPromoted,
    isPromoting,
    promotedFiles,
    publishBranch,
    isPublishing,
    publishResult,
    publishErrorMessage,
    handlePublish,
    analysisStreamRef,
    resolvedPreviewTarget,
    canConfirmChoice,
    canApply,
    canGenerateDirections,
    inPromoteFlow,
    showBackHomeArrow,
    runStatusLabel,
    liveStatus,
    handleAiAgentInputSend,
    handleClarify,
    handleStopAnalysis,
    handleConfirmUnderstanding,
    handleRefine,
    handleBackToAnalysis,
    handleRetryRun,
    handleChooseDirection,
    updateDirectionPreviewStatus,
    handleConfirmChoice,
    handleBackHome,
    restoreFromHistory,
    removeSource,
    taskFolder,
  };
}

export type DsAcceleratorToolViewModel = ReturnType<typeof useDsAcceleratorTool>;
