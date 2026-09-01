import type { CriterionWithState } from "@ds-starter/standards";
import type { SourceEntry, SourceRole, UnderstandingBrief } from "./types";

/**
 * A compact, decision-only summary of the phase-1 checkpoint, for reuse in
 * phase-2 prompts — deliberately NOT the full raw brief. The raw text also
 * carries Interpretation prose, Sources Reviewed, Assumptions, Open
 * Questions, and Risks: exploratory reasoning written for the human at the
 * checkpoint, not a directive the second pass needs to re-read verbatim.
 * Re-sending all of that on every direction-generation call was the single
 * largest block of duplicated tokens in the pipeline — this keeps only what
 * phase 2 must actually honor: what changes, what doesn't, and the settled
 * change intent. Dropping the rest doesn't risk re-litigating scope, since
 * none of it was ever a constraint on the second pass.
 */
function buildConfirmedBriefSummary(brief: UnderstandingBrief): string {
  const lines: string[] = [];
  if (brief.summary.trim()) lines.push(`Summary: ${brief.summary.trim()}`);
  if (brief.inScope.length > 0) lines.push("In scope:", ...brief.inScope.map((item) => `- ${item}`));
  if (brief.outOfScope.length > 0) lines.push("Out of scope:", ...brief.outOfScope.map((item) => `- ${item}`));
  const ci = brief.changeIntent;
  if (ci.targetComponent && ci.targetComponent !== "unknown") {
    lines.push(
      `Target component: ${ci.targetComponent}`,
      `Change type: ${ci.changeType}`,
      ...(ci.stateCondition.trim() ? [`Condition: ${ci.stateCondition.trim()}`] : []),
      ...(ci.proposedRule.trim() ? [`Rule: ${ci.proposedRule.trim()}`] : []),
    );
  }
  // The one exploratory-phase detail worth carrying forward verbatim: phase 1
  // already found the exact file(s) — repeating that discovery from scratch
  // in phase 2 was the largest avoidable chunk of wall-clock time in the run.
  if (ci.codeTargets.length > 0) {
    lines.push(
      "Known file(s) from phase 1 — read these directly, do not re-search the repository for them:",
      ...ci.codeTargets.map((path) => `- ${path}`),
    );
  }
  return lines.length > 0 ? lines.join("\n") : brief.summary.trim();
}

function formatSourceLabel(source: SourceEntry): string {
  if (source.kind === "note") return source.value.trim();
  if (source.kind === "ticket" && source.taskFolder) {
    return `Ticket (${source.ticketKey}) → docs/tasks/${source.taskFolder}`;
  }
  if (source.kind === "component") {
    if (source.storybook) {
      return `Component from the team's Storybook: ${source.storybook.componentPath}${
        source.storybook.importPath
          ? ` — stories file: ${source.storybook.importPath} (read it to locate the component's real source)`
          : ""
      }`;
    }
    return `Component: ${source.value}`;
  }
  if (source.kind === "doc") {
    return `Reference doc: ${source.value}`;
  }
  return `Figma: ${source.value}`;
}

function formatSourceBullet(source: SourceEntry): string[] {
  const label = formatSourceLabel(source);
  const lines = [`- ${label}`];
  // A note's own text IS the label above — an identical context line under it
  // would just repeat the same sentence, so only show context when it adds
  // something the label didn't already say.
  if (source.context.trim() && source.context.trim() !== source.value.trim()) {
    lines.push(`  - Context attached to this source: ${source.context.trim()}`);
  }
  return lines;
}

/**
 * Headed blocks by ROLE, not a flat undifferentiated list — this is the
 * fix for sources carrying provenance ("where did this come from") but never
 * telling the model what it's actually FOR. A requirement and a reference no
 * longer sit as two interchangeable bullets in one pile.
 */
const ROLE_HEADINGS: Record<SourceRole, string> = {
  subject: "## The component you are changing",
  requirement: "## Requirements this must satisfy",
  reference: "## References to draw from (do not copy verbatim)",
  constraint: "## Constraints you must comply with",
  "watch-out": "## The requester specifically flagged",
};

const ROLE_ORDER: SourceRole[] = ["subject", "requirement", "reference", "constraint", "watch-out"];

/**
 * Builds the request body from typed sources plus the project's enabled
 * quality criteria. Criteria feed the SAME "Constraints" section a
 * constraint-role source would — this is what makes unchecking a criterion
 * in the standards checklist genuinely remove it from the prompt, instead of
 * the four hardcoded "Follow DS constraints" bullets this used to be.
 */
function buildRoleSections(sources: SourceEntry[], criteria: CriterionWithState[]): string[] {
  const lines: string[] = [];
  for (const role of ROLE_ORDER) {
    const roleSources = sources.filter((source) => source.role === role);
    const criterionLines = role === "constraint" ? criteria.filter((c) => c.enabled).map((c) => `- ${c.promptLine}`) : [];
    if (roleSources.length === 0 && criterionLines.length === 0) continue;
    lines.push(ROLE_HEADINGS[role], "");
    for (const source of roleSources) lines.push(...formatSourceBullet(source));
    lines.push(...criterionLines);
    lines.push("");
  }
  return lines.length > 0 ? lines : ["## Requirements this must satisfy", "", "- (none provided)", ""];
}

/**
 * Instructions for actually inspecting a Figma frame via the `figma` MCP
 * server, instead of treating the pasted link as inert text. Only include
 * this block when the resolved auth method has real Figma MCP wiring
 * (see AgentAuthMethod.mcpServers) — otherwise the model has no such tool
 * and should not be told it does.
 */
function buildFigmaMcpLines(figmaMcpAvailable: boolean): string[] {
  if (!figmaMcpAvailable) return [];
  return [
    "You have access to a `figma` MCP server for the Figma link(s) listed under References below.",
    "Use its `get_design_context` tool (and `get_screenshot` / `get_variable_defs` / `get_metadata` as needed) with the exact Figma link as input to actually inspect the frame — do not rely on the URL text alone or guess at its contents.",
    "Figma MCP tools take a `fileKey` and a `nodeId` — extract both from the Figma URL itself (for `https://www.figma.com/design/<fileKey>/<name>?node-id=<a>-<b>` the fileKey is the path segment after /design/ and the nodeId is `<a>:<b>`). Never guess or invent a nodeId; if the URL has no node-id parameter, say so instead of fabricating one.",
    "If a Figma MCP tool call reports that the server needs authentication, say so explicitly in your output (do not silently skip it or claim no Figma MCP is available) — the fix is a one-time `claude mcp login figma` run in a terminal on this machine.",
    "",
  ];
}

/**
 * Phase 1 — analysis only, no implementation. The output is a decision
 * document the user reviews before any code is generated: what the AI
 * understood, why, what it will and won't change, and what it's unsure about.
 * For agentic engines this may READ the repository; it must never write.
 */
export function buildUnderstandingPrompt(args: {
  sources: SourceEntry[];
  criteria: CriterionWithState[];
  selectedComponentId?: string;
  selectedComponentLabel?: string;
  /** True for agentic engines that can read repository files during analysis. */
  canReadRepo: boolean;
  /** True when a Figma link is present AND the resolved auth method has real Figma MCP wiring. */
  figmaMcpAvailable?: boolean;
}): string {
  return [
    "Analyze this design-system change request and explain your understanding — DO NOT implement anything yet.",
    "",
    "This is a review checkpoint: a designer will read your analysis and either correct it or approve it before any code is generated. Write for that designer — plain language, honest about uncertainty.",
    "",
    "Think like a senior product designer throughout: weigh user outcome, clarity, and information hierarchy. Note accessibility and design-token/consistency concerns as part of your analysis, not as an afterthought.",
    "",
    ...(args.canReadRepo
      ? [
          "You MAY read repository files (component source, tokens, docs) to ground your analysis.",
          "You MUST NOT create, modify, write, or delete ANY file in this phase. Read-only. No exceptions.",
        ]
      : ["Work only from the sources listed below — you have no repository access in this phase."]),
    "",
    ...buildFigmaMcpLines(args.figmaMcpAvailable ?? false),
    ...(args.selectedComponentId && args.selectedComponentLabel
      ? [`Selected component: ${args.selectedComponentLabel} (${args.selectedComponentId})`, ""]
      : []),
    "Your output is rendered inside a product UI, not read as a document. Every bullet is a CAPTION: a short fragment, not a sentence with justification. Hard budgets below are enforced by the UI — anything over budget gets truncated, so keep it tight yourself.",
    "",
    "WRITING STYLE — applies to every section below, no exceptions:",
    "- Write the way you'd explain this out loud to a colleague: professional, direct, plain. They're smart, but they are not a specialist in accessibility standards, this codebase's internals, or design-token systems — don't assume that vocabulary.",
    "- Never cite a standard bare (\"WCAG 2.5.7\", \"WCAG 2.2 AA\"). If a rule from one matters, say what it actually requires in plain words instead — e.g. \"must also work without dragging\", not \"per WCAG 2.5.7\".",
    "- Never use unexplained implementation jargon (\"polar form\", \"token family\", \"component-set\", \"linear control\") in Summary, Interpretation, In Scope, or Out of Scope — say what it means in ordinary words instead, or drop the detail if it's not essential at this level.",
    "- Short, concrete sentences. One idea per bullet. If a bullet needs a parenthetical aside to make sense, it's doing too much — split it or simplify it.",
    "",
    "Return exactly these sections:",
    "## Summary",
    "- ONE or TWO plain-language sentences, 35 words max total: not a vague label — say concretely what changes, where, and what someone will actually be able to see or do differently once it's built. This is the FIRST and most prominent thing a reader sees, so it has to stand alone: someone reading only this sentence should understand exactly what you're about to build, not just the general idea.",
    "## Interpretation",
    "- 1 to 3 sentences: WHY you interpreted it that way (which words/sources led you there), in the same plain style as Summary",
    "## Sources Reviewed",
    "- one bullet per source you actually used (requirement, reference, constraint, the component itself, repository file, the prompt itself) and what it contributed",
    "## In Scope",
    "- max 5 bullets, each 10 words or fewer, no trailing justification, no parenthetical jargon: what you will change, worded so someone outside this codebase can picture it (say what it does, not just its internal name)",
    "## Out of Scope",
    "- max 5 bullets, each 10 words or fewer, no parenthetical jargon: what you will NOT change (no explanations here — put reasoning in Interpretation)",
    "## Assumptions",
    '- max 4 bullets, each 12 words or fewer; write "None" if none',
    "## Open Questions",
    '- max 4 bullets, each a single direct question of 15 words or fewer. This section is not optional filler — if the request leaves ANY real ambiguity, gap, or decision the designer should weigh in on, put it here. Only write "None" when you are genuinely confident nothing needs asking; do not skip a real question just to keep this section short.',
    "## Risks",
    '- max 4 bullets, each 12 words or fewer, plain language, no bare standard citations (breaking changes, accessibility, token drift, API churn); write "None" if none',
    "## Change Intent JSON",
    "- return exactly one fenced json block with this schema and no extra keys:",
    "```json",
    "{",
    '  "targetComponent": "a short name ONLY — 1 to 4 words, e.g. \\"CircularSlider\\" or \\"New: CircularSlider\\". NEVER a sentence, a list of precedents, or an explanation (do not write things like \\"None — new component; closest precedents: X, Y\\"). If nothing matches and this is genuinely new, still give it one short proposed name — put the ambiguity/precedent reasoning in Interpretation instead, never here.",',
    '  "changeType": "style-rule | behavior-rule | layout-rule | content-rule | unknown",',
    '  "stateCondition": "when/if condition in plain language",',
    '  "codeTargets": ["apps/web/src/components/ds/..."],',
    '  "proposedRule": "the precise technical rule this change follows, 1-2 sentences — this feeds code generation later, so precision matters more here than anywhere else in this document, but still spell out any standard you rely on instead of citing it bare",',
    '  "confidence": 0.0,',
    '  "assumptions": ["..."],',
    '  "followUpQuestions": ["..."]',
    "}",
    "```",
    "",
    ...buildRoleSections(args.sources, args.criteria),
  ].join("\n");
}

/**
 * Phase 2 fallback for text-only engines (no repo access): descriptive
 * directions seeded with the user-confirmed analysis. Parsed by
 * parseAnalysisOutput's "Planning Tasks" contract.
 */
export function buildTextDirectionsPrompt(args: {
  sources: SourceEntry[];
  criteria: CriterionWithState[];
  selectedComponentId?: string;
  selectedComponentLabel?: string;
  /** Confirmed understanding brief from phase 1 — see buildConfirmedBriefSummary for why this is the parsed object, not the raw text. */
  confirmedBrief: UnderstandingBrief;
  /** True when a Figma link is present AND the resolved auth method has real Figma MCP wiring. */
  figmaMcpAvailable?: boolean;
  /** Present only on an automatic regeneration attempt — see directionQuality.ts. Names the specific overlap detected in the previous attempt so the model can actually fix it, not just "try again." */
  correctionNote?: string;
}): string {
  return [
    "Generate practical solution alternatives for the connected design system based on the CONFIRMED analysis below.",
    "",
    ...buildFigmaMcpLines(args.figmaMcpAvailable ?? false),
    ...(args.correctionNote
      ? ["--- CORRECTION FROM YOUR PREVIOUS ATTEMPT ---", args.correctionNote, "--- END CORRECTION ---", ""]
      : []),
    "The designer has already reviewed and approved this analysis — do not re-litigate or contradict it:",
    "--- CONFIRMED ANALYSIS ---",
    buildConfirmedBriefSummary(args.confirmedBrief),
    "--- END CONFIRMED ANALYSIS ---",
    "",
    "- Produce 2 or 3 genuinely different DESIGN DIRECTIONS for this request — never just one. Think like a senior product designer exploring concepts with another designer, not an engineer comparing implementation strategies. A design direction is a different way a PERSON would experience the result (layout, interaction model, hierarchy, navigation, density, workflow, progressive disclosure, emphasis, content presentation) — never a different way of building the same on-screen result, and never only a code-level choice. Even when the request looks narrow (a sizing, spacing, contrast, or targeted accessibility fix), do not stop at the first obvious fix — deliberately think of at least one structurally different way to solve the same underlying problem (a different mechanism, a different visual treatment, a different interaction pattern) before settling on your final set. Apply this test: a person looking at the solutions for three seconds with no text must be able to immediately say how they differ, because they genuinely look and behave differently — not because they were built differently under the hood.",
    ...(args.selectedComponentId && args.selectedComponentLabel
      ? [`- Selected component for alternatives: ${args.selectedComponentLabel} (${args.selectedComponentId})`]
      : []),
    "",
    "Return exactly these sections:",
    "## Summary",
    "- 1 to 2 short bullets, plain language, each 15 words max",
    "## Planning Tasks",
    "- each line must start with a dash, exactly like this: `- [ ] Solution title — what it changes. Axis: <the real design axis this solution sits on, 2-6 words>. Why: how this follows from the confirmed analysis`",
    "- every solution MUST include both Axis and Why, not only the what",
    '- Axis must name a genuine design axis — something a person would perceive on screen: layout, hierarchy, workflow, density, disclosure, interaction model, navigation, emphasis, content presentation. For example: "guided step-by-step" vs "compact single view", "cards dashboard" vs "conversational timeline". NEVER an implementation detail — CSS architecture, DOM structure, refactoring strategy, internal abstractions, component reuse, state management, a variable/selector/token name, or filler like "different approach" are not valid axes and must never be the reason two solutions exist.',
    "- this list MUST contain at least 2 solutions (3 when the request supports it), and no two may share the same Axis — if your first two axes overlap, keep brainstorming a genuinely different DESIGN axis (not an engineering one) rather than settling for one solution",
    '- if one solution is clearly your strongest recommendation, append " (recommended)" to the end of that one line only — omit it entirely if you have no real preference',
    "## Responsive Behaviour",
    "- exactly one bullet per solution above, in the SAME ORDER, no title needed",
    "- plain language: how does this solution actually behave from mobile width to desktop width? Does it wrap, stack, truncate, hide content, or change layout at any point — or does it stay visually identical regardless of width? Say which, specifically.",
    "- if a solution introduces no new responsive behavior beyond what the component already does today, say that plainly instead of inventing something",
    "## Change Intent JSON",
    "- return exactly one fenced json block with this schema and no extra keys:",
    "```json",
    "{",
    '  "targetComponent": "a short name ONLY — 1 to 4 words. NEVER a sentence or a list of precedents. If nothing matches and this is genuinely new, still give it one short proposed name.",',
    '  "changeType": "style-rule | behavior-rule | layout-rule | content-rule | unknown",',
    '  "stateCondition": "when/if condition in plain language",',
    '  "codeTargets": ["apps/web/src/components/ds/..."],',
    '  "proposedRule": "the precise technical rule, 1-2 sentences — spell out any standard you rely on instead of citing it bare",',
    '  "confidence": 0.0,',
    '  "assumptions": ["..."],',
    '  "followUpQuestions": ["..."]',
    "}",
    "```",
    "",
    ...buildRoleSections(args.sources, args.criteria),
  ].join("\n");
}

/**
 * Phase 2 for agentic engines — runs only AFTER the user confirmed the phase-1
 * understanding at the checkpoint. Requires the agent to actually read the
 * current component, write a full working variant per direction into an
 * isolated staging directory (never the real file), and describe what it
 * built. Nothing here touches the live repo; that only happens later, via the
 * deterministic (non-AI) promote step once the user picks one direction.
 */
export function buildProposalPrompt(args: {
  runId: string;
  sources: SourceEntry[];
  criteria: CriterionWithState[];
  selectedComponentId?: string;
  selectedComponentLabel?: string;
  directionCount?: number;
  /** Confirmed phase-1 understanding brief the user reviewed and approved — see buildConfirmedBriefSummary for why this is the parsed object, not the raw text. */
  confirmedBrief?: UnderstandingBrief;
  /** True when a Figma link is present AND the resolved auth method has real Figma MCP wiring. */
  figmaMcpAvailable?: boolean;
  /** Present only on an automatic regeneration attempt — see directionQuality.ts. Names the specific overlap detected in the previous attempt so the model can actually fix it, not just "try again." */
  correctionNote?: string;
}): string {
  const stagingDir = `apps/web/src/accelerator/.generated/${args.runId}`;
  // A naming-convention reference only — NOT a target count. See step 2: the
  // model decides how many directions actually exist for this request.
  const letters = Array.from({ length: Math.max(args.directionCount ?? 2, 3) }, (_, i) => String.fromCharCode(97 + i));
  const knownCodeTargets = (args.confirmedBrief?.changeIntent.codeTargets ?? []).filter((path) => path.trim());

  return [
    "Generate REAL, working alternative implementations for a design-system component — not descriptions of them.",
    "",
    ...buildFigmaMcpLines(args.figmaMcpAvailable ?? false),
    ...(args.correctionNote
      ? ["--- CORRECTION FROM YOUR PREVIOUS ATTEMPT ---", args.correctionNote, "--- END CORRECTION ---", ""]
      : []),
    ...(args.confirmedBrief
      ? [
          "The designer has already reviewed and APPROVED the analysis below at a checkpoint. Treat it as settled: do not re-analyze, re-scope, or contradict it. Anything it marks out of scope stays out of scope.",
          "--- CONFIRMED ANALYSIS ---",
          buildConfirmedBriefSummary(args.confirmedBrief),
          "--- END CONFIRMED ANALYSIS ---",
          "",
        ]
      : []),
    "You must actually build each direction as real code before describing it. Follow these steps in order:",
    "",
    ...(knownCodeTargets.length > 0
      ? [
          `1. The target file(s) are already known from the confirmed analysis: ${knownCodeTargets.join(", ")}. Read them directly, in full. Do not re-search the repository to rediscover them — only look further if something inside those files points you to another file you genuinely need.`,
        ]
      : [
          "1. Identify the target component from the sources below. Find and read its current source file(s) in full before proposing anything — do not guess its structure or props.",
          ...(args.selectedComponentId && args.selectedComponentLabel
            ? [`   Selected component: ${args.selectedComponentLabel} (${args.selectedComponentId})`]
            : []),
        ]),
    "2. Produce 2 or 3 genuinely different DESIGN DIRECTIONS for this request — never just one. Think like a senior product designer sketching multiple concepts to bring to another designer, not like an engineer converging on the single best implementation.",
    "",
    "   A design direction is a different way a PERSON would experience and interact with the result: a different layout, interaction model, visual or information hierarchy, navigation, density, component composition, emphasis, progressive disclosure, content presentation, animation/feedback, or workflow. It is NEVER a different way of building the same on-screen result — CSS architecture, DOM structure, refactoring strategy, internal abstractions, component reuse, state management, or any other code-level choice must NEVER be the reason a second direction exists, and must never be the only thing that differs between two directions. Pick whichever implementation approach is objectively best and apply it consistently across every direction you build; implementation quality never varies between directions, only the design does.",
    "",
    "   The bar: a person looking at the live previews side by side for three seconds, with no text, must be able to immediately say how they differ — not by hunting for a subtle spacing difference, but because the directions genuinely look and behave differently from each other. If your first two ideas would look the same to a user and only differ in code, that is not two directions yet — keep brainstorming until you find a second one that clears this bar.",
    "",
    "   Even when a request looks narrow (a sizing, spacing, contrast, or targeted accessibility fix), do not stop at the first obvious fix and call it done. Deliberately think of at least one structurally different way to solve the same underlying problem before picking your final set — a different mechanism (e.g. resize the control itself, vs. add invisible touch padding around it, vs. change the surrounding layout so targets are naturally larger or fewer), a different visual treatment, or a different interaction pattern. Then build whichever 2 (or 3) are strongest and most clearly distinguishable. Never pad with a token, half-hearted option just to hit a count — every direction you build must be something you'd honestly recommend — but stopping at one is never an acceptable outcome, no matter how narrow the request seems.",
    "",
    '   When a request is open enough to support a third direction (typically a new screen, a new flow, or a substantial component redesign), each direction should read as a different product idea solving the same problem. For example: one direction compact, fast, and minimal in a single flat view, versus one guided, with richer explanations and more progressive disclosure; or one built around cards in a side-by-side dashboard layout, versus one built around a conversational, step-by-step timeline. Both would be equally well-built — the difference is the experience, not the code quality.',
    "",
    `   Name each direction's real design axis in the "differentiationAxis" field below — it must describe something a person would perceive by looking at the screen (layout, hierarchy, workflow, density, disclosure, interaction model, navigation, emphasis, content presentation), never an implementation choice. No two directions may share an axis. Use consecutive letters for their ids/staging folders (e.g. ${letters.slice(0, 3).join(", ")}).`,
    `3. For EACH direction you decided on in step 2, build a real, complete variant. Note how it behaves at different widths as you write its CSS — you'll report this in step 4, grounded in what you actually wrote, not guessed.`,
    `   a. For every real file it would change, write a FULL replacement copy of that file's content to:`,
    `      ${stagingDir}/direction-{letter}/real/{the file's normal repo-relative path, e.g. apps/web/src/components/ds/CreditScore.tsx}`,
    "      This must be the complete file content (not a diff/snippet) — it will later be copied verbatim onto the real path if this direction is chosen, so it must be correct and complete on its own.",
    `   b. Write a preview harness to ${stagingDir}/direction-{letter}/Preview.tsx:`,
    "      - Default-exports a React function component that takes NO required props.",
    "      - Imports the modified component from its own staged copy using a relative import, e.g. `import { Thing } from \"./real/apps/web/src/components/ds/Thing\";` (match whatever export style the real file actually uses).",
    "      - Renders it with realistic example data — check for an existing `*Showcase.tsx` file for this component and reuse the same kind of example props/data it uses.",
    "      - Must render correctly in isolation: only import from existing paths under apps/web/src/components/ds/*, apps/web/src/components/custom/*, or React itself — never invent new dependencies.",
    "      - Use only var(--ds-*) tokens, never raw hex/px colors.",
    "   c. Do NOT edit any file outside the staging directory. The real component file must be left untouched by you.",
    "4. After building all directions, output exactly one fenced json block titled \"Directions JSON\" (see schema below) describing what you actually built — every field must be true of the code you wrote, not aspirational.",
    "",
    "Return exactly these sections:",
    "## Summary",
    "- 2 to 4 bullet points max, plain language, describing the problem you addressed",
    "## Change Intent JSON",
    "- return exactly one fenced json block with this schema and no extra keys:",
    "```json",
    "{",
    '  "targetComponent": "a short name ONLY — 1 to 4 words. NEVER a sentence or a list of precedents. If nothing matches and this is genuinely new, still give it one short proposed name.",',
    '  "changeType": "style-rule | behavior-rule | layout-rule | content-rule | unknown",',
    '  "stateCondition": "when/if condition in plain language",',
    '  "codeTargets": ["apps/web/src/components/ds/..."],',
    '  "proposedRule": "the precise technical rule, 1-2 sentences — spell out any standard you rely on instead of citing it bare",',
    '  "confidence": 0.0,',
    '  "assumptions": ["..."],',
    '  "followUpQuestions": ["..."]',
    "}",
    "```",
    "## Directions JSON",
    "- return exactly one fenced json block: an array with one entry per direction you actually built, this schema and no extra keys:",
    "```json",
    "[",
    "  {",
    `    "id": "direction-a",`,
    '    "title": "short direction name, 4 words max",',
    '    "summary": "one short sentence, 15 words max, plain language",',
    '    "highlights": ["3 or 4 comparison chips, EACH 2-4 words, naming what a PERSON would see or do differently — e.g. \\"Single page\\", \\"Guided steps\\", \\"Denser layout\\" — never an implementation detail like \\"CSS-only\\" or \\"No API changes\\". This is the at-a-glance identity of this direction vs the others."],',
    '    "differentiationAxis": "2-6 words naming the real DESIGN axis this direction sits on (see step 2 above) — something visible on screen, e.g. \\"guided step-by-step\\", \\"compact single view\\", \\"card-based comparison\\". Never an implementation choice (CSS/DOM/architecture/state).",',
    '    "reasoning": "WHY this approach is being suggested, 1-3 sentences — must connect back to the confirmed analysis (its scope, assumptions, or risks) and plainly state the axis this direction differs on from the other one(s), never just restate the summary",',
    '    "responsiveNotes": "1-3 sentences on how this direction actually behaves from mobile to desktop width, grounded in the real CSS you wrote for it — wrapping, stacking, truncation, hidden content, or explicitly no change. Never invent behavior the code doesn\'t have.",',
    '    "tradeoffs": ["max 3 trade-offs, each 10 words or fewer"],',
    '    "complexity": "low | medium | high",',
    '    "affectedFiles": ["apps/web/src/components/ds/Thing.tsx"],',
    '    "confidence": 0.0,',
    '    "recommended": false,',
    '    "previewFile": "direction-a/Preview.tsx"',
    "  }",
    "]",
    "```",
    '- "affectedFiles" lists the REAL repo paths this direction would change if chosen (not the staging paths).',
    '- Only ONE direction may have "recommended": true, and only if you have a genuine preference — otherwise leave every direction false.',
    '- "highlights" must differentiate: if two directions would share a chip, drop it from both and pick sharper ones. A shared chip is a signal the two directions aren\'t actually different enough yet — fix the underlying approach, not just the label.',
    '- This array MUST contain at least 2 directions (3 when the request supports it), each with a different "differentiationAxis". A single direction, or two directions sharing an axis, is treated as an error downstream, not a valid result.',
    "",
    ...buildRoleSections(args.sources, args.criteria),
  ].join("\n");
}

/**
 * QA mode's judgment pass — runs against a staged, same-origin copy of the
 * subject (see qaCriteriaRunner.ts for why staging is required at all: a
 * hosted Storybook is cross-origin and can't be read into by anything, DOM
 * checks included). This prompt handles ONLY criteria whose
 * verification === "judgment" — automated/assisted criteria are decided by
 * real runners, never by asking the model to grade its own homework.
 */
export function buildQaPrompt(args: {
  runId: string;
  sources: SourceEntry[];
  judgmentCriteria: CriterionWithState[];
  selectedComponentId?: string;
  selectedComponentLabel?: string;
}): string {
  const stagingDir = `apps/web/src/accelerator/.generated/${args.runId}/qa`;
  return [
    "Stage the component below for a quality check, then judge it against a short list of criteria — do not implement or fix anything.",
    "",
    ...(args.selectedComponentId && args.selectedComponentLabel
      ? [`Selected component: ${args.selectedComponentLabel} (${args.selectedComponentId})`, ""]
      : []),
    "Follow these steps in order:",
    "1. Find and read the component's current source file(s) in full.",
    `2. Write a preview harness to ${stagingDir}/Preview.tsx: default-exports a React function component with NO required props, imports the REAL component directly from its actual repo path using a correct relative import from ${stagingDir}/ back to that file (do not copy the file — QA reads the real, unmodified source, and never edits it), and renders it with realistic example data. Check for an existing \`*Showcase.tsx\` file for this component and reuse the same kind of example props/data it uses. Use only var(--ds-*) tokens for anything you write yourself.`,
    "3. For EACH criterion listed below, judge the actual component you just read — never guess, never assume a pass. Ground every verdict in something specific: a prop, a class, a line of code, a piece of copy.",
    "",
    "WRITING STYLE — same rules as everywhere else in this product: plain language, no bare standard citations, short concrete sentences, one idea per bullet.",
    "",
    "Return exactly these sections:",
    "## Files Read JSON",
    "- return exactly one fenced json block: an array of every real repo-relative file path you read for this component in step 1 (not the staging path) — e.g. [\"apps/web/src/components/ds/CreditScore.tsx\"]",
    "## QA Judgment JSON",
    "- return exactly one fenced json block: an array with exactly one entry per criterion id below, this schema and no extra keys:",
    "```json",
    "[",
    "  {",
    '    "criterionId": "the exact id from the list below",',
    '    "status": "pass | fail | warning | not-applicable | needs-review",',
    '    "detail": "1-2 plain-language sentences grounded in the actual code — what you saw, not a generic restatement of the requirement",',
    '    "suggestedFix": "one concrete sentence, or omit the key entirely if status is pass"',
    "  }",
    "]",
    "```",
    "",
    "## Criteria to judge",
    ...args.judgmentCriteria.map((c) => `- id: "${c.id}" — ${c.title}. ${c.requirement}`),
    "",
    ...buildRoleSections(args.sources, []),
  ].join("\n");
}
