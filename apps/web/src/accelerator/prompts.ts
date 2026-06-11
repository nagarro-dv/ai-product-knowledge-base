import type { SourceEntry } from "./types";
import { getSkillLabels } from "./skills-catalog";

function formatSourceLabel(source: SourceEntry): string {
  if (source.kind === "ticket" && source.taskFolder) {
    return `Ticket (${source.ticketKey}) → docs/tasks/${source.taskFolder}`;
  }
  if (source.kind === "component") {
    return `Component: ${source.value}${source.componentId ? ` (${source.componentId})` : ""}`;
  }
  if (source.kind === "internal-doc") {
    return `Internal doc: ${source.value}`;
  }
  return `Figma: ${source.value}`;
}

export function buildAnalysisPrompt(args: {
  primaryFigma: string;
  primaryTicket: string;
  baseContext: string;
  sources: SourceEntry[];
  selectedSkillIds: string[];
  selectedComponentId?: string;
  selectedComponentLabel?: string;
}): string {
  const sourceLines: string[] = [];
  if (args.primaryFigma.trim()) sourceLines.push(`- Primary Figma: ${args.primaryFigma.trim()}`);
  if (args.primaryTicket.trim()) sourceLines.push(`- Primary ticket: ${args.primaryTicket.trim()}`);
  if (args.baseContext.trim()) sourceLines.push(`- Base context: ${args.baseContext.trim()}`);
  for (const source of args.sources) {
    sourceLines.push(`- ${formatSourceLabel(source)}`);
    if (source.context.trim()) {
      sourceLines.push(`  - Why this source was added: ${source.context.trim()}`);
    }
  }

  const skillLabels = getSkillLabels(args.selectedSkillIds);

  return [
    "Analyze the problem and generate practical solution alternatives for the DS Starter Kit.",
    "",
    "Important behavior:",
    "- Inputs may include ticket, Figma, component, internal docs, or free-text only.",
    "- Focus on proposing implementation alternatives for the described problem.",
    "- Target component may be explicit or inferred from sources.",
    "- Default to 2 solution directions unless the user asks for more or fewer.",
    ...(args.selectedComponentId && args.selectedComponentLabel
      ? ["", `Selected component for alternatives: ${args.selectedComponentLabel} (${args.selectedComponentId})`]
      : []),
    ...(skillLabels.length > 0
      ? ["", "Preferred skills/rules to follow when relevant:", ...skillLabels.map((s) => `- ${s}`)]
      : []),
    "",
    "Return exactly these sections:",
    "## Summary",
    "- 2 to 4 bullet points max, plain language",
    "## Task Analysis",
    "- summarize the problem and list principles used to evaluate solutions",
    "## Planning Tasks",
    "- use format: [ ] Solution title — principle summary",
    "- default to 2 ideas",
    "## Suggested Implementation Steps",
    "- Step title | Why: reason | Output: files/folder artifacts for each solution",
    "## Need More Context",
    '- write "None" if not needed',
    "## Change Intent JSON",
    "- return exactly one fenced json block with this schema and no extra keys:",
    "```json",
    "{",
    '  "targetComponent": "component id from component-registry or best match",',
    '  "changeType": "style-rule | behavior-rule | layout-rule | content-rule | unknown",',
    '  "stateCondition": "when/if condition in plain language",',
    '  "codeTargets": ["apps/web/src/components/ds/..."],',
    '  "proposedRule": "general rule to apply in code",',
    '  "confidence": 0.0,',
    '  "assumptions": ["..."],',
    '  "followUpQuestions": ["..."]',
    "}",
    "```",
    "## Detailed Notes",
    "- include deeper details for optional expansion",
    "",
    "Follow DS constraints:",
    "- Reuse existing DS components before custom UI",
    "- Use var(--ds-*) tokens only",
    "- Meet WCAG 2.2 AA accessibility requirements",
    "",
    "Sources:",
    ...(sourceLines.length > 0 ? sourceLines : ["- (none provided)"]),
  ].join("\n");
}

export function buildImplementationPrompt(args: {
  targetComponentId: string;
  targetComponentLabel: string;
  targetReason: string;
  changeIntent: import("./types").ChangeIntent;
  selectedSolutions: { title: string }[];
  sources: SourceEntry[];
  context: string;
  selectedSkillIds: string[];
  taskFolder?: string | null;
}): string {
  const sourceLines = args.sources.map(
    (s) => `- ${formatSourceLabel(s)}${s.context ? ` | context: ${s.context}` : ""}`,
  );
  const solutionLines = args.selectedSolutions.map((s) => `- ${s.title}`);
  const codeTargets =
    args.changeIntent.codeTargets.length > 0 ? args.changeIntent.codeTargets : ["apps/web/src/components/ds"];
  const skillLabels = getSkillLabels(args.selectedSkillIds);

  return [
    "Create implementation-ready solution alternatives directly in repository files.",
    "",
    "Requirements:",
    "- Make real code edits in the repo (do not only describe them).",
    "- Keep edits scoped to apps/web and packages/tokens unless strictly needed.",
    "- Use existing DS components and var(--ds-*) tokens.",
    "- Do not replace the original component implementation.",
    "- For each selected solution, create separate TSX/CSS files (SolutionA, SolutionB, SolutionC naming).",
    "- Before creating new solutions, delete existing accelerator-generated solution files for this target if they exist.",
    "- Run targeted validation (lint/typecheck) and report results.",
    ...(args.taskFolder
      ? [
          `- Create or update solution markdown under docs/tasks/${args.taskFolder}/solutions/ (one file per solution).`,
          "- Use frontmatter: id, title, status, lead, playgroundImplemented.",
        ]
      : []),
    ...(skillLabels.length > 0 ? ["", "Preferred skills/rules:", ...skillLabels.map((s) => `- ${s}`)] : []),
    "",
    `Target component: ${args.targetComponentLabel} (${args.targetComponentId})`,
    `Reason target was selected: ${args.targetReason}`,
    `Base context: ${args.context || "None"}`,
    "",
    "Change intent:",
    `- Type: ${args.changeIntent.changeType}`,
    `- State condition: ${args.changeIntent.stateCondition}`,
    `- Proposed rule: ${args.changeIntent.proposedRule}`,
    `- Confidence: ${args.changeIntent.confidence}`,
    `- Suggested code targets: ${codeTargets.join(", ")}`,
    "",
    "Selected solutions to implement:",
    ...solutionLines,
    "",
    "Sources:",
    ...(sourceLines.length > 0 ? sourceLines : ["- (none)"]),
    "",
    "Return exactly these sections:",
    "## Apply Result",
    "- applied | blocked",
    "## Changed Files",
    "- one file path per line",
    "## Validation",
    "- command and outcome",
    "## Notes",
    "- concise notes or blockers",
  ].join("\n");
}
