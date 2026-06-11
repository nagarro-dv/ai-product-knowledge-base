import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelAgentJob,
  getAgentJob,
  postAgentChatStream,
  startAgentJob,
  streamAgentJob,
  type AgentJobStatus,
} from "../agentSseClient";
import { getComponentEntry } from "../component-registry";
import type { AiAgentInputSendPayload } from "../components/custom/AiAgentInput";
import { buildMockAnalysisOutput } from "./mock-data";
import { parseAnalysisOutput, parseChangedFilesFromApplyOutput, slugify } from "./parsers";
import { buildAnalysisPrompt, buildImplementationPrompt } from "./prompts";
import { extractTicketKey, resolveTaskFolder } from "./task-docs";
import {
  ACTIVE_JOB_KEY,
  SNAPSHOT_KEY,
  SNAPSHOT_MAX_STREAM_ITEMS,
  STREAM_IDLE_RECONNECT_MS,
  UNKNOWN_TARGET,
  extractTaskFromEvent,
  formatStreamLine,
  mapPayloadSource,
  mergeStreamChunks,
  resolvePreviewTarget,
  safeReadSession,
  safeRemoveSession,
  safeWriteSession,
  toReadableAgentError,
  toTaskFields,
} from "./tool-utils";
import type {
  AnalysisOutput,
  AnalysisTask,
  ImplementationTask,
  PreviewTarget,
  SourceEntry,
  StreamItem,
  ToolState,
} from "./types";

type SessionSnapshot = {
  state: ToolState;
  primaryFigma: string;
  primaryTicket: string;
  baseContext: string;
  sources: SourceEntry[];
  selectedSkillIds: string[];
  mockDataTest: boolean;
  analysis: AnalysisOutput | null;
  analysisTasks: AnalysisTask[];
  implementationTasks: ImplementationTask[];
  selectedSolutionIndex: number;
  streamItems: StreamItem[];
  appliedFilePaths: string[];
  hasAppliedImplementation: boolean;
  implementationErrorMessage: string | null;
  implementationStreamOffset: number;
  implementationJobStatus: AgentJobStatus | null;
};

export function useDsAcceleratorTool() {
  const [state, setState] = useState<ToolState>("intake");
  const [primaryFigma, setPrimaryFigma] = useState("");
  const [primaryTicket, setPrimaryTicket] = useState("");
  const [baseContext, setBaseContext] = useState("");
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [mockDataTest, setMockDataTest] = useState(false);
  const [skillsDropdownOpen, setSkillsDropdownOpen] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisOutput | null>(null);
  const [analysisTasks, setAnalysisTasks] = useState<AnalysisTask[]>([]);
  const [implementationTasks, setImplementationTasks] = useState<ImplementationTask[]>([]);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState(0);
  const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intakeErrorMessage, setIntakeErrorMessage] = useState<string | null>(null);
  const [implementationErrorMessage, setImplementationErrorMessage] = useState<string | null>(null);
  const [hasAppliedImplementation, setHasAppliedImplementation] = useState(false);
  const [isApplyingConfirmedChanges, setIsApplyingConfirmedChanges] = useState(false);
  const [appliedFilePaths, setAppliedFilePaths] = useState<string[]>([]);
  const [implementationJobId, setImplementationJobId] = useState<string | null>(null);
  const [implementationJobStatus, setImplementationJobStatus] = useState<AgentJobStatus | null>(null);
  const [implementationStreamOffset, setImplementationStreamOffset] = useState(-1);
  const [taskListOpen, setTaskListOpen] = useState(false);

  const analysisStreamRef = useRef<HTMLDivElement | null>(null);
  const implementationStreamRef = useRef<HTMLDivElement | null>(null);
  const skillsDropdownRef = useRef<HTMLDivElement | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const implementationAbortRef = useRef<AbortController | null>(null);
  const implementationTimerRef = useRef<number | null>(null);
  const streamedTaskKeysRef = useRef<Set<string>>(new Set());
  const isHydratingFromSnapshotRef = useRef(false);

  const ticketKey = useMemo(() => extractTicketKey(primaryTicket), [primaryTicket]);
  const taskFolder = useMemo(() => resolveTaskFolder(ticketKey).taskFolder, [ticketKey]);
  const resolvedPreviewTarget: PreviewTarget = useMemo(
    () => resolvePreviewTarget(sources, baseContext, analysis?.changeIntent ?? null),
    [analysis?.changeIntent, baseContext, sources],
  );
  const activeSolutions = useMemo(() => analysisTasks.filter((task) => task.active), [analysisTasks]);
  const selectedSolution =
    activeSolutions[selectedSolutionIndex] ?? activeSolutions[0] ?? analysisTasks[selectedSolutionIndex] ?? analysisTasks[0];
  const selectedSolutionName =
    selectedSolution?.label ??
    `Solution ${String.fromCharCode(65 + (selectedSolutionIndex % 26))}${selectedSolutionIndex >= 26 ? `-${selectedSolutionIndex + 1}` : ""}`;
  const solutionCountLabel = `${Math.min(selectedSolutionIndex + 1, Math.max(activeSolutions.length, 1))}/${Math.max(activeSolutions.length, 1)}`;
  const intentConfidence = analysis?.changeIntent.confidence ?? 0;
  const blockedByUnknownTarget = resolvedPreviewTarget.id === UNKNOWN_TARGET;
  const blockedByLowConfidence = intentConfidence < 0.6;
  const canStartImplementation =
    state === "analysisReady" &&
    analysisTasks.some((task) => task.active) &&
    (mockDataTest || (!blockedByUnknownTarget && !blockedByLowConfidence));
  const inImplementationFlow =
    state === "implementing" || state === "implementationReady" || state === "implementationSuccess";
  const completedImplementationTasks = implementationTasks.filter((task) => task.status === "done").length;
  const inProgressImplementationTasks = implementationTasks.filter((task) => task.status === "doing").length;
  const implementationProgressLabel = `${completedImplementationTasks}/${Math.max(implementationTasks.length, 1)} solutions done · ${inProgressImplementationTasks} running`;
  const showBackHomeArrow = state !== "intake" && !isBusy;

  const runStatusLabel = useMemo(() => {
    if (isApplyingConfirmedChanges) return mockDataTest ? "Mock: finishing…" : "Finishing implementation…";
    if (state === "analyzing") return "Running analysis…";
    if (state === "implementing") return `${inProgressImplementationTasks || activeSolutions.length} solution(s) running`;
    if (state === "implementationReady") {
      return hasAppliedImplementation ? "Implementation finished. Confirm to continue." : implementationProgressLabel;
    }
    if (state === "implementationSuccess") return "Changes applied";
    if (state === "analysisStopped") return "Analysis stopped";
    if (state === "error") return liveStatus;
    return `${analysisTasks.length} solution${analysisTasks.length === 1 ? "" : "s"}`;
  }, [
    activeSolutions.length,
    analysisTasks.length,
    hasAppliedImplementation,
    implementationProgressLabel,
    inProgressImplementationTasks,
    isApplyingConfirmedChanges,
    liveStatus,
    mockDataTest,
    state,
  ]);

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

  const consumeImplementationJob = useCallback(
    async (jobId: string, startAfter: number) => {
      const controller = new AbortController();
      implementationAbortRef.current = controller;
      let after = startAfter;
      let draftOutput = "";
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
                setImplementationStreamOffset(after);
                if (event.kind === "text_delta" && event.text) draftOutput += event.text;
                if (event.kind === "status" && event.status) setLiveStatus(event.status);
                const line = formatStreamLine(event);
                if (line) appendStream(line);
              },
              { after, signal: streamController.signal },
            );
          } catch (error) {
            const isAbort = error instanceof DOMException && error.name === "AbortError";
            if (!isAbort) throw error;
            if (String(streamController.signal.reason ?? "") === "parent-abort") throw error;
            if (String(streamController.signal.reason ?? "") === "idle-timeout") {
              appendStream({ kind: "status", text: "No stream updates for 30s. Reconnecting…" });
            }
          } finally {
            window.clearTimeout(idleTimeout);
            controller.signal.removeEventListener("abort", abortParentToChild);
          }
          const summary = await getAgentJob(jobId, { signal: controller.signal });
          setImplementationJobStatus(summary.status);
          if (summary.status === "queued" || summary.status === "running") continue;
          if (summary.status === "finished") {
            const output = summary.result?.output?.trim() || draftOutput.trim();
            setAppliedFilePaths(parseChangedFilesFromApplyOutput(output));
            setHasAppliedImplementation(true);
            setImplementationErrorMessage(null);
            setState("implementationReady");
            return;
          }
          setImplementationErrorMessage(
            summary.status === "cancelled"
              ? "Implementation was stopped because Stop Implementation was clicked."
              : summary.error || "Implementation failed before completion.",
          );
          setHasAppliedImplementation(false);
          setState("implementationReady");
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setImplementationErrorMessage(toReadableAgentError(error));
        setHasAppliedImplementation(false);
        setState("implementationReady");
      } finally {
        implementationAbortRef.current = null;
        setIsApplyingConfirmedChanges(false);
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
      if (implementationStreamRef.current) {
        implementationStreamRef.current.scrollTop = implementationStreamRef.current.scrollHeight;
      }
    }, 0);
  }, [streamItems, state]);

  useEffect(() => {
    const max = Math.max(0, activeSolutions.length - 1);
    setSelectedSolutionIndex((current) => (current > max ? 0 : current));
  }, [activeSolutions.length]);

  useEffect(() => {
    if (!skillsDropdownOpen) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!skillsDropdownRef.current?.contains(event.target as Node)) setSkillsDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [skillsDropdownOpen]);

  useEffect(() => {
    return () => {
      if (implementationTimerRef.current !== null) window.clearTimeout(implementationTimerRef.current);
      implementationAbortRef.current?.abort();
      analysisAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const rawSnapshot = safeReadSession(SNAPSHOT_KEY);
    const rawJobId = safeReadSession(ACTIVE_JOB_KEY);
    if (!rawSnapshot && !rawJobId) return;
    let restoredOffset = -1;
    if (rawSnapshot) {
      try {
        const snapshot = JSON.parse(rawSnapshot) as SessionSnapshot;
        isHydratingFromSnapshotRef.current = true;
        setState(snapshot.state);
        setPrimaryFigma(snapshot.primaryFigma);
        setPrimaryTicket(snapshot.primaryTicket);
        setBaseContext(snapshot.baseContext);
        setSources(snapshot.sources);
        setSelectedSkillIds(snapshot.selectedSkillIds);
        setMockDataTest(snapshot.mockDataTest);
        setAnalysis(snapshot.analysis);
        setAnalysisTasks(snapshot.analysisTasks);
        setImplementationTasks(snapshot.implementationTasks);
        setSelectedSolutionIndex(snapshot.selectedSolutionIndex);
        setStreamItems(snapshot.streamItems);
        setAppliedFilePaths(snapshot.appliedFilePaths);
        setHasAppliedImplementation(snapshot.hasAppliedImplementation);
        setImplementationErrorMessage(snapshot.implementationErrorMessage);
        setImplementationStreamOffset(snapshot.implementationStreamOffset);
        setImplementationJobStatus(snapshot.implementationJobStatus);
        restoredOffset = Number.isFinite(snapshot.implementationStreamOffset) ? snapshot.implementationStreamOffset : -1;
      } catch {
        clearPersistence();
      } finally {
        isHydratingFromSnapshotRef.current = false;
      }
    }
    if (!rawJobId) return;
    setImplementationJobId(rawJobId);
    void (async () => {
      setIsBusy(true);
      try {
        const summary = await getAgentJob(rawJobId);
        setImplementationJobStatus(summary.status);
        if (summary.status === "queued" || summary.status === "running") {
          setState("implementing");
          await consumeImplementationJob(rawJobId, restoredOffset);
          return;
        }
        if (summary.status === "finished") {
          setAppliedFilePaths(parseChangedFilesFromApplyOutput(summary.result?.output?.trim() || ""));
          setHasAppliedImplementation(true);
          setImplementationErrorMessage(null);
          setState("implementationReady");
          return;
        }
        setImplementationErrorMessage(
          summary.status === "cancelled"
            ? "Implementation was stopped. You can retry the run."
            : summary.error || "Implementation failed.",
        );
        setState("implementationReady");
      } catch {
        clearPersistence();
        setImplementationJobId(null);
      } finally {
        setIsBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isHydratingFromSnapshotRef.current) return;
    const recoverable =
      state === "implementing" || state === "implementationReady" || state === "implementationSuccess";
    if (!recoverable && !implementationJobId) {
      if (state === "intake") clearPersistence();
      return;
    }
    const snapshot: SessionSnapshot = {
      state,
      primaryFigma,
      primaryTicket,
      baseContext,
      sources,
      selectedSkillIds,
      mockDataTest,
      analysis,
      analysisTasks,
      implementationTasks,
      selectedSolutionIndex,
      streamItems: streamItems.slice(-SNAPSHOT_MAX_STREAM_ITEMS),
      appliedFilePaths,
      hasAppliedImplementation,
      implementationErrorMessage,
      implementationStreamOffset,
      implementationJobStatus,
    };
    if (!safeWriteSession(SNAPSHOT_KEY, JSON.stringify(snapshot))) clearPersistence();
    if (implementationJobId) safeWriteSession(ACTIVE_JOB_KEY, implementationJobId);
  }, [
    analysis,
    analysisTasks,
    appliedFilePaths,
    baseContext,
    clearPersistence,
    hasAppliedImplementation,
    implementationErrorMessage,
    implementationJobId,
    implementationJobStatus,
    implementationStreamOffset,
    implementationTasks,
    mockDataTest,
    primaryFigma,
    primaryTicket,
    selectedSkillIds,
    selectedSolutionIndex,
    sources,
    state,
    streamItems,
  ]);

  const runAnalysis = async (prompt: string): Promise<string | null> => {
    setIsBusy(true);
    setLiveStatus("Analyzing…");
    let draftText = "";
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    try {
      const done = await postAgentChatStream(
        { messages: [{ role: "user", content: prompt }] },
        (event) => {
          if (event.kind === "text_delta" && event.text) draftText += event.text;
          if (event.kind === "status" && event.status) setLiveStatus(event.status);
          const taskText = extractTaskFromEvent(event);
          if (taskText) {
            const key = taskText.toLowerCase();
            if (!streamedTaskKeysRef.current.has(key)) {
              streamedTaskKeysRef.current.add(key);
              const fields = toTaskFields(taskText);
              setAnalysisTasks((current) => [
                ...current,
                {
                  id: `live-task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                  label: fields.title,
                  description: fields.description,
                  active: true,
                },
              ]);
            }
          }
          const line = formatStreamLine(event);
          if (line) appendStream(line);
        },
        { signal: controller.signal },
      );
      setLiveStatus(done.status || "Analysis ready");
      return done.output?.trim() || draftText.trim();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState("analysisStopped");
        setLiveStatus("Stopped");
        return null;
      }
      setState("error");
      setErrorMessage(toReadableAgentError(error));
      setLiveStatus("Error");
      return null;
    } finally {
      analysisAbortRef.current = null;
      setIsBusy(false);
    }
  };

  const executeAnalysis = async (nextSources: SourceEntry[], context: string, figma: string, ticket: string) => {
    setState("analyzing");
    setStreamItems([]);
    setAnalysis(null);
    setAnalysisTasks([]);
    streamedTaskKeysRef.current = new Set();
    setErrorMessage(null);
    setIntakeErrorMessage(null);
    if (mockDataTest) {
      setIsBusy(true);
      setLiveStatus("Mock: loading sample data…");
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      const mock = buildMockAnalysisOutput();
      setAnalysis(mock);
      setAnalysisTasks(mock.tasks);
      appendStream({ kind: "status", text: "Mock mode: agent calls are skipped." });
      setState("analysisReady");
      setLiveStatus("Mock: ready");
      setIsBusy(false);
      return;
    }
    const componentSource = nextSources.find((source) => source.kind === "component");
    const componentEntry = componentSource?.componentId ? getComponentEntry(componentSource.componentId) : undefined;
    const prompt = buildAnalysisPrompt({
      primaryFigma: figma,
      primaryTicket: ticket,
      baseContext: context,
      sources: nextSources,
      selectedSkillIds,
      selectedComponentId: componentSource?.componentId,
      selectedComponentLabel: componentEntry?.title ?? componentSource?.value,
    });
    const output = await runAnalysis(prompt);
    if (!output) return;
    const parsed = parseAnalysisOutput(output);
    setAnalysis(parsed);
    setAnalysisTasks((current) =>
      parsed.tasks.map((task) => {
        const existing = current.find((candidate) => candidate.label.toLowerCase() === task.label.toLowerCase());
        return { ...task, active: existing?.active ?? task.active, description: existing?.description ?? task.description };
      }),
    );
    setState("analysisReady");
  };

  const handleAiAgentInputSend = async (payload: AiAgentInputSendPayload) => {
    if (!payload.message.trim() && payload.sources.length === 0) {
      setIntakeErrorMessage("Describe the problem or add at least one source to start analysis.");
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
    await executeAnalysis(resolvedSources, payload.message.trim(), nextPrimaryFigma.trim(), ticketLabel);
  };

  const runImplementationApply = async () => {
    if (!analysis || isApplyingConfirmedChanges) return;
    if (mockDataTest) {
      setIsApplyingConfirmedChanges(true);
      setIsBusy(true);
      appendStream({ kind: "status", text: "Mock mode: repository write skipped." });
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      setAppliedFilePaths([]);
      setHasAppliedImplementation(true);
      setState("implementationReady");
      setIsApplyingConfirmedChanges(false);
      setIsBusy(false);
      return;
    }
    const selectedSolutions = analysisTasks.filter((task) => task.active).map((task) => ({ title: task.label }));
    const targetEntry = getComponentEntry(resolvedPreviewTarget.id);
    setIsApplyingConfirmedChanges(true);
    setIsBusy(true);
    setImplementationErrorMessage(null);
    setAppliedFilePaths([]);
    setLiveStatus("Finishing implementation…");
    try {
      const { jobId } = await startAgentJob({
        messages: [
          {
            role: "user",
            content: buildImplementationPrompt({
              targetComponentId: resolvedPreviewTarget.id,
              targetComponentLabel: targetEntry?.title ?? resolvedPreviewTarget.label,
              targetReason: resolvedPreviewTarget.reason,
              changeIntent: analysis.changeIntent,
              selectedSolutions,
              sources,
              context: baseContext,
              selectedSkillIds,
              taskFolder,
            }),
          },
        ],
      });
      setImplementationJobId(jobId);
      setImplementationJobStatus("queued");
      setImplementationStreamOffset(-1);
      safeWriteSession(ACTIVE_JOB_KEY, jobId);
      await consumeImplementationJob(jobId, -1);
    } catch (error) {
      setImplementationJobId(null);
      setImplementationJobStatus("error");
      setImplementationErrorMessage(toReadableAgentError(error));
      setHasAppliedImplementation(false);
      setState("implementationReady");
      setIsApplyingConfirmedChanges(false);
      setIsBusy(false);
    }
  };

  const runImplementationStepAtIndex = (taskIds: string[], index: number) => {
    if (index >= taskIds.length) {
      implementationTimerRef.current = null;
      void runImplementationApply();
      return;
    }
    const runningTaskId = taskIds[index]!;
    setSelectedSolutionIndex(index);
    setImplementationTasks((current) =>
      current.map((task) => (task.id === runningTaskId ? { ...task, status: "doing" } : task)),
    );
    const runningTask = analysisTasks.filter((task) => task.active)[index];
    if (mockDataTest && runningTask) {
      appendStream({ kind: "status", text: `Implementing ${runningTask.label}…` });
    }
    implementationTimerRef.current = window.setTimeout(() => {
      setImplementationTasks((current) =>
        current.map((task) => (task.id === runningTaskId ? { ...task, status: "done" } : task)),
      );
      if (mockDataTest && runningTask) {
        appendStream({ kind: "status", text: `${runningTask.label} implemented.` });
      }
      runImplementationStepAtIndex(taskIds, index + 1);
    }, 220);
  };

  const handleStartImplementation = () => {
    if (analysisTasks.length === 0) return;
    if (implementationTimerRef.current !== null) {
      window.clearTimeout(implementationTimerRef.current);
      implementationTimerRef.current = null;
    }
    const tasksForRun = analysisTasks
      .filter((task) => task.active)
      .map((task, index) => ({
        id: `impl-${index + 1}-${slugify(task.label, `task-${index + 1}`)}`,
        title: task.label,
        status: "to-do" as const,
      }));
    setImplementationTasks(tasksForRun);
    setSelectedSolutionIndex(0);
    setImplementationErrorMessage(null);
    setHasAppliedImplementation(false);
    setImplementationJobId(null);
    setImplementationJobStatus(null);
    setImplementationStreamOffset(-1);
    setAppliedFilePaths([]);
    setState("implementing");
    setIsBusy(true);
    runImplementationStepAtIndex(
      tasksForRun.map((task) => task.id),
      0,
    );
  };

  const stopImplementationRun = async () => {
    implementationAbortRef.current?.abort("manual-stop");
    if (implementationTimerRef.current !== null) {
      window.clearTimeout(implementationTimerRef.current);
      implementationTimerRef.current = null;
    }
    if (implementationJobId && (implementationJobStatus === "running" || implementationJobStatus === "queued")) {
      try {
        await cancelAgentJob(implementationJobId);
      } catch {
        // best effort
      }
    }
    clearPersistence();
    setImplementationJobId(null);
    setImplementationJobStatus("cancelled");
    setImplementationStreamOffset(-1);
    setIsApplyingConfirmedChanges(false);
    setIsBusy(false);
    setHasAppliedImplementation(false);
    setImplementationErrorMessage("Implementation was stopped. You can retry the run.");
    setState("implementationReady");
  };

  const handleConfirmImplementationChanges = async () => {
    if (isApplyingConfirmedChanges) return;
    if (hasAppliedImplementation) {
      safeRemoveSession(ACTIVE_JOB_KEY);
      setState("implementationSuccess");
      return;
    }
    if (implementationTasks.length > 0 && implementationTasks.every((task) => task.status === "done")) {
      await runImplementationApply();
      return;
    }
    handleStartImplementation();
  };

  const handleStopAnalysis = () => {
    if (isBusy) analysisAbortRef.current?.abort();
  };

  const handleSolutionStep = (direction: "next" | "prev") => {
    setSelectedSolutionIndex((current) => {
      const max = Math.max(0, activeSolutions.length - 1);
      if (direction === "next") return current >= max ? 0 : current + 1;
      return current <= 0 ? max : current - 1;
    });
  };

  const handleBackHome = () => {
    analysisAbortRef.current?.abort();
    implementationAbortRef.current?.abort();
    if (implementationTimerRef.current !== null) window.clearTimeout(implementationTimerRef.current);
    setState("intake");
    setPrimaryFigma("");
    setPrimaryTicket("");
    setBaseContext("");
    setSources([]);
    setSelectedSkillIds([]);
    setSkillsDropdownOpen(false);
    setAnalysis(null);
    setAnalysisTasks([]);
    setImplementationTasks([]);
    setStreamItems([]);
    setIsBusy(false);
    setErrorMessage(null);
    setIntakeErrorMessage(null);
    setLiveStatus("Idle");
    setImplementationErrorMessage(null);
    setHasAppliedImplementation(false);
    setImplementationJobId(null);
    setImplementationJobStatus(null);
    setImplementationStreamOffset(-1);
    setAppliedFilePaths([]);
    setIsApplyingConfirmedChanges(false);
    setSelectedSolutionIndex(0);
    clearPersistence();
    streamedTaskKeysRef.current = new Set();
  };

  const toggleSkill = (skillId: string, next: boolean) => {
    setSelectedSkillIds((current) =>
      next ? Array.from(new Set([...current, skillId])) : current.filter((id) => id !== skillId),
    );
  };

  const toggleAnalysisTask = (taskId: string, next: boolean) => {
    setAnalysisTasks((current) =>
      current.map((candidate) => (candidate.id === taskId ? { ...candidate, active: next } : candidate)),
    );
  };

  const removeSource = (sourceId: string) => {
    setSources((current) => current.filter((source) => source.id !== sourceId));
  };

  return {
    state,
    baseContext,
    sources,
    selectedSkillIds,
    mockDataTest,
    setMockDataTest,
    skillsDropdownOpen,
    setSkillsDropdownOpen,
    analysis,
    analysisTasks,
    implementationTasks,
    streamItems,
    errorMessage,
    intakeErrorMessage,
    implementationErrorMessage,
    hasAppliedImplementation,
    isApplyingConfirmedChanges,
    appliedFilePaths,
    taskListOpen,
    setTaskListOpen,
    analysisStreamRef,
    implementationStreamRef,
    skillsDropdownRef,
    resolvedPreviewTarget,
    activeSolutions,
    selectedSolution,
    selectedSolutionName,
    solutionCountLabel,
    canStartImplementation,
    blockedByUnknownTarget,
    blockedByLowConfidence,
    inImplementationFlow,
    implementationProgressLabel,
    showBackHomeArrow,
    runStatusLabel,
    handleAiAgentInputSend,
    handleStopAnalysis,
    handleStartImplementation,
    stopImplementationRun,
    handleConfirmImplementationChanges,
    handleSolutionStep,
    handleBackHome,
    toggleSkill,
    toggleAnalysisTask,
    removeSource,
  };
}

export type DsAcceleratorToolViewModel = ReturnType<typeof useDsAcceleratorTool>;
