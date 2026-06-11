import { ChevronLeft, ChevronRight, LoaderCircle, TriangleAlert } from "lucide-react";
import type { RefObject } from "react";
import { AiAgentInput } from "../components/custom/AiAgentInput";
import { AiAttachment } from "../components/custom/AiAttachment";
import { AiTask } from "../components/custom/AiTask";
import { DsBadge } from "../components/ds/Badge";
import { DsButton } from "../components/ds/Button";
import { DsCheckbox } from "../components/ds/Checkbox";
import { DsTypography } from "../components/ds/DsTypography";
import { ComponentPreview } from "./ComponentPreview";
import { ACCELERATOR_SKILLS } from "./skills-catalog";
import { UNKNOWN_TARGET, streamItemLabel } from "./tool-utils";
import { useDsAcceleratorTool } from "./useDsAcceleratorTool";
import "./DsAcceleratorTool.css";

function ImplementationTaskPopover({
  open,
  tasks,
}: {
  open: boolean;
  tasks: { id: string; title: string; status: "to-do" | "doing" | "done" }[];
}) {
  if (!open) return null;
  return (
    <div className="accelerator__implTaskPopover" role="status" aria-live="polite">
      {tasks.map((task) => (
        <AiTask key={task.id} context="implementation" status={task.status} title={task.title} />
      ))}
    </div>
  );
}

export function DsAcceleratorTool() {
  const vm = useDsAcceleratorTool();

  const renderStream = (
    emptyLabel: string,
    streamRef: RefObject<HTMLDivElement | null>,
  ) => (
    <div
      className="accelerator__analysisStream"
      ref={streamRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Agent activity stream"
    >
      {vm.streamItems.length === 0 ? (
        <DsTypography as="p" variant="paragraph-regular">
          {emptyLabel}
        </DsTypography>
      ) : (
        vm.streamItems.map((item) => (
          <DsTypography key={item.id} as="p" variant="paragraph-small">
            {streamItemLabel(item)}
          </DsTypography>
        ))
      )}
    </div>
  );

  const gateMessage = !vm.analysisTasks.some((task) => task.active)
    ? "Select at least one solution to continue."
    : vm.blockedByUnknownTarget
      ? "Component could not be resolved from sources yet."
      : vm.blockedByLowConfidence
        ? "Waiting for higher confidence before implementation."
        : "Adjust sources or selections to continue.";

  return (
    <main className="accelerator" aria-label="DS Accelerator">
      <section
        className={`accelerator__window${vm.state === "intake" ? " accelerator__window--intake" : ""}`}
        aria-labelledby="accelerator-title"
      >
        {vm.state === "intake" ? (
          <section className="accelerator__startScreen" aria-label="DS Accelerator intake">
            <div className="accelerator__startContent">
              <section className="accelerator__startIntro" aria-label="DS Accelerator intro">
                <DsTypography as="h1" id="accelerator-title" variant="heading-2">
                  Welcome to DS Accelerator
                </DsTypography>
                <DsTypography as="p" variant="paragraph-regular" className="accelerator__startHint">
                  Add ticket, Figma, or component sources, describe the problem, and generate solution alternatives.
                </DsTypography>
              </section>
              <AiAgentInput
                className="accelerator__startInput"
                placeholder="Describe what should change and why…"
                onSend={vm.handleAiAgentInputSend}
              />
              <section className="accelerator__mockDataRow" aria-label="Mock data test">
                <label className="accelerator__skillsOption">
                  <DsCheckbox
                    checked={vm.mockDataTest}
                    interactive
                    onCheckedChange={(next) => vm.setMockDataTest(Boolean(next))}
                    aria-label="Mock data test"
                  />
                  <DsTypography as="span" variant="paragraph-regular">
                    Mock data test
                  </DsTypography>
                </label>
                <DsTypography as="p" variant="paragraph-small">
                  Loads sample DS-042 solutions and skips agent calls so you can polish layout and states.
                </DsTypography>
              </section>
              <section className="accelerator__skillsSelector" aria-label="Skill selection">
                <div className="accelerator__skillsHeader">
                  <DsTypography as="p" variant="paragraph-regular">
                    Skills (optional)
                  </DsTypography>
                  <DsButton variant="secondary" size="small" onClick={() => vm.setSkillsDropdownOpen((open) => !open)}>
                    {vm.selectedSkillIds.length === 0
                      ? "Select skills"
                      : `${vm.selectedSkillIds.length} skill${vm.selectedSkillIds.length === 1 ? "" : "s"} selected`}
                  </DsButton>
                </div>
                {vm.skillsDropdownOpen ? (
                  <div className="accelerator__skillsDropdown" ref={vm.skillsDropdownRef}>
                    {ACCELERATOR_SKILLS.map((skill) => (
                      <label key={skill.id} className="accelerator__skillsOption">
                        <DsCheckbox
                          checked={vm.selectedSkillIds.includes(skill.id)}
                          interactive
                          onCheckedChange={(next) => vm.toggleSkill(skill.id, Boolean(next))}
                          aria-label={skill.label}
                        />
                        <DsTypography as="span" variant="paragraph-small">
                          {skill.label}
                        </DsTypography>
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
            {vm.intakeErrorMessage ? (
              <DsTypography as="p" variant="paragraph-regular" role="alert">
                {vm.intakeErrorMessage}
              </DsTypography>
            ) : null}
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
              <DsTypography as="p" variant="heading-4">
                DS Accelerator
              </DsTypography>
            </div>
            <div className="accelerator__runStatus">
              <DsTypography as="p" variant="paragraph-regular">
                {vm.runStatusLabel}
              </DsTypography>
              {vm.state === "analyzing" ? (
                <DsButton variant="destructive" size="small" onClick={vm.handleStopAnalysis}>
                  Stop Analysis
                </DsButton>
              ) : null}
              {vm.state === "analysisReady" ? (
                <div className="accelerator__analysisAction">
                  <DsButton
                    variant="primary"
                    size="small"
                    onClick={vm.handleStartImplementation}
                    disabled={!vm.canStartImplementation}
                  >
                    Start Solution Implementation
                  </DsButton>
                  {!vm.canStartImplementation ? (
                    <DsTypography as="p" variant="paragraph-small">
                      {gateMessage}
                    </DsTypography>
                  ) : null}
                </div>
              ) : null}
              {vm.state === "implementing" || (vm.state === "implementationReady" && vm.isApplyingConfirmedChanges) ? (
                <div
                  className="accelerator__implTaskSummary"
                  onMouseEnter={() => vm.setTaskListOpen(true)}
                  onMouseLeave={() => vm.setTaskListOpen(false)}
                >
                  <DsButton variant="secondary" size="small">
                    {vm.implementationProgressLabel}
                  </DsButton>
                  <ImplementationTaskPopover open={vm.taskListOpen} tasks={vm.implementationTasks} />
                  <DsButton variant="destructive" size="small" onClick={() => void vm.stopImplementationRun()}>
                    Stop Implementation
                  </DsButton>
                </div>
              ) : null}
              {vm.state === "implementationReady" && !vm.isApplyingConfirmedChanges ? (
                <div
                  className="accelerator__implTaskSummary"
                  onMouseEnter={() => vm.setTaskListOpen(true)}
                  onMouseLeave={() => vm.setTaskListOpen(false)}
                >
                  <DsButton variant="secondary" size="small">
                    {vm.implementationProgressLabel}
                  </DsButton>
                  <ImplementationTaskPopover open={vm.taskListOpen} tasks={vm.implementationTasks} />
                  <DsButton variant="primary" size="small" onClick={() => void vm.handleConfirmImplementationChanges()}>
                    {vm.hasAppliedImplementation
                      ? "Confirm"
                      : vm.implementationTasks.every((task) => task.status === "done")
                        ? "Retry apply"
                        : "Retry implementation"}
                  </DsButton>
                  {vm.implementationErrorMessage ? (
                    <DsTypography as="p" variant="paragraph-small">
                      {vm.implementationErrorMessage}
                    </DsTypography>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>
        ) : null}

        {vm.state === "implementationSuccess" ? (
          <section className="accelerator__successScreen" aria-label="Implementation success">
            <DsTypography as="h2" variant="heading-4">
              {vm.resolvedPreviewTarget.label} solutions generated successfully
            </DsTypography>
            {vm.appliedFilePaths.length > 0 ? (
              <DsTypography as="p" variant="paragraph-regular">
                Changed files: {vm.appliedFilePaths.join(", ")}
              </DsTypography>
            ) : null}
            <DsButton variant="primary" size="small" onClick={vm.handleBackHome}>
              Start another run
            </DsButton>
          </section>
        ) : null}

        {vm.state !== "intake" && vm.state !== "implementationSuccess" && !vm.inImplementationFlow ? (
          <section className="accelerator__workspace accelerator__workspace--three" aria-label="Analysis workspace">
            <article className="accelerator__panel" aria-label="Sources panel">
              <header className="accelerator__panelHeader">
                <DsTypography as="h2" variant="heading-6">
                  Sources
                </DsTypography>
              </header>
              <div className="accelerator__panelBody">
                <div className="accelerator__inlineWarning">
                  <TriangleAlert size={16} aria-hidden />
                  <DsTypography as="p" variant="paragraph-small">
                    Sources reflect your intake. Start a new run from home to replace them.
                  </DsTypography>
                </div>
                <div className="accelerator__sources accelerator__sources--tiles">
                  {vm.sources.map((source) => (
                    <AiAttachment
                      key={source.id}
                      size="source"
                      kind={source.kind === "component" ? "component" : source.kind === "ticket" ? "ticket" : "figma"}
                      href={source.kind === "component" ? null : source.value}
                      value={source.value}
                      subtitle={
                        source.kind === "ticket"
                          ? "Ticket"
                          : source.kind === "figma"
                            ? "Original design"
                            : source.kind === "component"
                              ? "Current component"
                              : "Source"
                      }
                      description={source.context || null}
                      onRemove={() => vm.removeSource(source.id)}
                    />
                  ))}
                  {vm.baseContext.trim() ? (
                    <AiAttachment size="source" kind="comment" value={vm.baseContext.trim()} subtitle="Instruction" />
                  ) : null}
                  {vm.sources.length === 0 && !vm.baseContext.trim() ? (
                    <div className="accelerator__empty accelerator__empty--compact">
                      <DsTypography as="p" variant="paragraph-small">
                        No sources available.
                      </DsTypography>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>

            <article className="accelerator__panel" aria-label="Analysis panel">
              <header className="accelerator__panelHeader">
                <div className="accelerator__panelTitle accelerator__panelTitle--spread">
                  <DsTypography as="h2" variant="heading-6">
                    Analysis
                  </DsTypography>
                  {vm.state === "analysisReady" ? (
                    <DsBadge variant="success">Ready</DsBadge>
                  ) : null}
                </div>
              </header>
              <div className="accelerator__panelBody accelerator__panelBody--analysis">
                {renderStream(
                  vm.state === "analysisReady" ? "Analysis completed." : "Running analysis…",
                  vm.analysisStreamRef,
                )}
                {vm.state === "analyzing" ? (
                  <div className="accelerator__analysisRunningIndicator" aria-live="polite">
                    <LoaderCircle size={16} className="accelerator__spin" aria-hidden />
                    <DsTypography as="p" variant="paragraph-small">
                      Solution analysis running…
                    </DsTypography>
                  </div>
                ) : null}
                {vm.analysisTasks.length > 0 ? (
                  <div className="accelerator__taskList">
                    {vm.analysisTasks.map((task) => (
                      <AiTask
                        key={task.id}
                        context="analysis"
                        title={task.label}
                        description={task.description ?? "Generated from analysis."}
                        checked={task.active}
                        onCheckedChange={(next) => vm.toggleAnalysisTask(task.id, next)}
                      />
                    ))}
                  </div>
                ) : null}
                {vm.state === "analysisReady" && vm.analysis ? (
                  <section className="accelerator__artifactCard">
                    <DsTypography as="h3" variant="heading-6">
                      Selected component
                    </DsTypography>
                    <DsTypography as="p" variant="paragraph-regular">
                      {vm.resolvedPreviewTarget.label} — {vm.resolvedPreviewTarget.reason}
                    </DsTypography>
                    <DsTypography as="p" variant="paragraph-small">
                      {vm.analysis.summary}
                    </DsTypography>
                  </section>
                ) : null}
                {vm.state === "analysisStopped" || vm.state === "error" ? (
                  <section className="accelerator__artifactCard accelerator__artifactCard--warning">
                    <DsTypography as="p" variant="paragraph-regular">
                      {vm.state === "error" ? vm.errorMessage || "Analysis failed." : "Analysis was stopped."}
                    </DsTypography>
                  </section>
                ) : null}
              </div>
            </article>

            <article className="accelerator__panel" aria-label="Preview panel">
              <header className="accelerator__panelHeader">
                <div className="accelerator__panelTitle accelerator__panelTitle--spread">
                  <DsTypography as="h2" variant="heading-6">
                    Preview · {vm.resolvedPreviewTarget.label}
                  </DsTypography>
                  {vm.activeSolutions.length > 1 ? (
                    <div className="accelerator__variantNav">
                      <DsButton
                        variant="secondary"
                        size="small"
                        aria-label="Previous solution"
                        onClick={() => vm.handleSolutionStep("prev")}
                        leftIcon={<ChevronLeft size={16} aria-hidden />}
                      >
                        Prev
                      </DsButton>
                      <DsTypography as="span" variant="paragraph-small">
                        {vm.solutionCountLabel}
                      </DsTypography>
                      <DsButton
                        variant="secondary"
                        size="small"
                        aria-label="Next solution"
                        onClick={() => vm.handleSolutionStep("next")}
                        leftIcon={<ChevronRight size={16} aria-hidden />}
                      >
                        Next
                      </DsButton>
                    </div>
                  ) : null}
                </div>
              </header>
              <div className="accelerator__panelBody accelerator__variantPanelBody">
                <div className="accelerator__variantCanvas">
                  {vm.resolvedPreviewTarget.id !== UNKNOWN_TARGET ? (
                    <ComponentPreview componentId={vm.resolvedPreviewTarget.id} compact />
                  ) : (
                    <DsTypography as="p" variant="paragraph-regular">
                      Add a component source or mention a registry component to preview it here.
                    </DsTypography>
                  )}
                </div>
                {vm.selectedSolution ? (
                  <section className="accelerator__artifactCard">
                    <DsTypography as="h3" variant="heading-6">
                      {vm.selectedSolution.label}
                    </DsTypography>
                    <DsTypography as="p" variant="paragraph-regular">
                      {vm.selectedSolution.description ?? "No description returned for this solution."}
                    </DsTypography>
                  </section>
                ) : null}
              </div>
            </article>
          </section>
        ) : null}

        {vm.inImplementationFlow && vm.state !== "implementationSuccess" ? (
          <section
            className="accelerator__workspace accelerator__workspace--implementationV3"
            aria-label="Implementation workspace"
          >
            <article className="accelerator__panel" aria-label="Original component panel">
              <header className="accelerator__panelHeader">
                <DsTypography as="h2" variant="heading-6">
                  Original component
                </DsTypography>
              </header>
              <div className="accelerator__panelBody accelerator__variantPanelBody">
                <div className="accelerator__variantCollection">
                  <div className="accelerator__variantCollectionItem">
                    <DsTypography as="p" variant="paragraph-small">
                      Current · {vm.resolvedPreviewTarget.label}
                    </DsTypography>
                    <div className="accelerator__variantCanvas">
                      {vm.resolvedPreviewTarget.id !== UNKNOWN_TARGET ? (
                        <ComponentPreview componentId={vm.resolvedPreviewTarget.id} compact />
                      ) : (
                        <DsTypography as="p" variant="paragraph-regular">
                          Component preview unavailable.
                        </DsTypography>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="accelerator__panel" aria-label="Selected solution panel">
              <header className="accelerator__panelHeader">
                <div className="accelerator__panelTitle accelerator__panelTitle--spread">
                  <DsTypography as="h2" variant="heading-6">
                    New solution · {vm.selectedSolutionName}
                  </DsTypography>
                  {vm.activeSolutions.length > 1 ? (
                    <div className="accelerator__variantNav">
                      <DsButton
                        variant="secondary"
                        size="small"
                        aria-label="Previous solution"
                        onClick={() => vm.handleSolutionStep("prev")}
                        leftIcon={<ChevronLeft size={16} aria-hidden />}
                      >
                        Prev
                      </DsButton>
                      <DsTypography as="span" variant="paragraph-small">
                        {vm.solutionCountLabel}
                      </DsTypography>
                      <DsButton
                        variant="secondary"
                        size="small"
                        aria-label="Next solution"
                        onClick={() => vm.handleSolutionStep("next")}
                        leftIcon={<ChevronRight size={16} aria-hidden />}
                      >
                        Next
                      </DsButton>
                    </div>
                  ) : null}
                </div>
              </header>
              <div className="accelerator__panelBody accelerator__variantPanelBody accelerator__variantPanelBody--draft">
                <div className="accelerator__variantCanvas">
                  {vm.resolvedPreviewTarget.id !== UNKNOWN_TARGET ? (
                    <ComponentPreview componentId={vm.resolvedPreviewTarget.id} compact />
                  ) : (
                    <DsTypography as="p" variant="paragraph-regular">
                      Component preview unavailable.
                    </DsTypography>
                  )}
                </div>
                {vm.selectedSolution ? (
                  <section className="accelerator__artifactCard">
                    <DsTypography as="h3" variant="heading-6">
                      {vm.selectedSolution.label}
                    </DsTypography>
                    <DsTypography as="p" variant="paragraph-regular">
                      {vm.selectedSolution.description ?? "No description returned for this solution."}
                    </DsTypography>
                  </section>
                ) : null}
                {vm.state === "implementing" || vm.isApplyingConfirmedChanges ? (
                  <div className="accelerator__applyingOverlay accelerator__applyingOverlay--centered">
                    <LoaderCircle size={14} className="accelerator__spin" aria-hidden />
                    <DsTypography as="p" variant="paragraph-small">
                      Implementing solution…
                    </DsTypography>
                  </div>
                ) : null}
              </div>
            </article>

            <article
              className="accelerator__panel accelerator__implementationStreamPanel"
              aria-label="Agent thought stream panel"
            >
              <header className="accelerator__panelHeader">
                <DsTypography as="h2" variant="heading-6">
                  Thought stream
                </DsTypography>
              </header>
              <div className="accelerator__panelBody">
                {renderStream("Waiting for agent updates…", vm.implementationStreamRef)}
              </div>
            </article>
          </section>
        ) : null}
      </section>
    </main>
  );
}
