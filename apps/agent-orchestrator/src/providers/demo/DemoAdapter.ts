import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiProviderAdapter, NormalizedEvent, ProviderHealth, RunJobInput, RunJobResult } from '../types.js';
import {
  DIRECTION_A_CSS,
  DIRECTION_A_COMPONENT_TSX,
  DIRECTION_A_PREVIEW_TSX,
  DIRECTION_B_CSS,
  DIRECTION_B_COMPONENT_TSX,
  DIRECTION_B_PREVIEW_TSX,
} from '../../demo/fixtures.js';

/**
 * DEMO_MODE's stand-in AI provider — implements the same AiProviderAdapter
 * contract as the real adapters (see providers/types.ts) but never makes a
 * network call. It recognizes which phase of the DS Accelerator flow it was
 * called for (analysis, direction generation, or QA judgment) by matching
 * the distinctive opening line each prompt builder in
 * apps/web/src/accelerator/prompts.ts produces, and returns a canned
 * response written specifically for the DS-042 / Credit Score demo scenario
 * (see demo/fixtures.ts). For direction generation and QA it also performs
 * the same real filesystem writes an agentic engine would — Preview.tsx
 * harnesses and staged component files — so the live preview, promote, and
 * QA static-check steps all work against genuine files, not just text.
 */
export class DemoAdapter implements AiProviderAdapter {
  readonly id = 'demo:demo';
  readonly providerId = 'demo';
  readonly providerLabel = 'Demo';
  readonly label = 'Demo (offline)';
  readonly authMethod = {
    id: 'demo',
    label: 'Demo mode',
    kind: 'api-key',
    source: 'organisation',
    description: 'Canned, offline demo data enabled by DEMO_MODE — no network calls, no API key required.',
  } as const;
  readonly capabilities = { localRepoEdits: true, streaming: true, mcp: false } as const;

  async initialize(): Promise<void> {
    // Nothing to validate — there is no real credential.
  }

  health(): ProviderHealth {
    return { ok: true, model: 'demo' };
  }

  async runJob(input: RunJobInput): Promise<RunJobResult> {
    const { prompt, onEvent, signal } = input;
    const startMs = Date.now();

    if (signal.aborted) {
      return { runId: '', status: 'cancelled', model: 'demo' };
    }

    try {
      const phase = detectPhase(prompt);
      onEvent({ kind: 'status', status: 'running', message: 'Working from demo fixture data (DEMO_MODE)…' });

      let output: string;
      if (phase === 'understanding') {
        output = await this.runUnderstanding(onEvent, signal);
      } else if (phase === 'proposal') {
        output = await this.runProposal(prompt, onEvent, signal);
      } else if (phase === 'qa') {
        output = await this.runQa(prompt, onEvent, signal);
      } else {
        output = await this.runChat(onEvent, signal);
      }

      if (signal.aborted) {
        return { runId: '', status: 'cancelled', model: 'demo', durationMs: Date.now() - startMs };
      }

      return { runId: '', status: 'finished', durationMs: Date.now() - startMs, output, model: 'demo' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected demo adapter error.';
      onEvent({ kind: 'error', message } satisfies NormalizedEvent);
      return { runId: '', status: 'error', model: 'demo', durationMs: Date.now() - startMs };
    }
  }

  private async runUnderstanding(onEvent: RunJobInput['onEvent'], signal: AbortSignal): Promise<string> {
    await streamThinking(onEvent, signal, 'Reading the Credit Score component and the DS-042 ticket…');
    onEvent({ kind: 'tool', name: 'read_file', status: 'completed', argsPreview: 'apps/web/src/components/ds/CreditScore.tsx' });
    const output = UNDERSTANDING_OUTPUT;
    await streamText(onEvent, signal, output);
    return output;
  }

  private async runProposal(prompt: string, onEvent: RunJobInput['onEvent'], signal: AbortSignal): Promise<string> {
    const generatedStagingRoot = extractStagingRoot(prompt);
    const runId = extractRunId(prompt);

    await streamThinking(onEvent, signal, 'Building two genuinely different directions for the Credit Score card…');

    if (generatedStagingRoot && runId) {
      onEvent({ kind: 'tool', name: 'write_file', status: 'in_progress', argsPreview: 'direction-a/real/.../CreditScore.tsx' });
      await writeDirection(generatedStagingRoot, runId, 'direction-a', {
        componentTsx: DIRECTION_A_COMPONENT_TSX,
        cssFileName: 'CreditScoreDirectionA.css',
        css: DIRECTION_A_CSS,
        previewTsx: DIRECTION_A_PREVIEW_TSX,
      });
      onEvent({ kind: 'tool', name: 'write_file', status: 'in_progress', argsPreview: 'direction-b/real/.../CreditScore.tsx' });
      await writeDirection(generatedStagingRoot, runId, 'direction-b', {
        componentTsx: DIRECTION_B_COMPONENT_TSX,
        cssFileName: 'CreditScoreDirectionB.css',
        css: DIRECTION_B_CSS,
        previewTsx: DIRECTION_B_PREVIEW_TSX,
      });
      onEvent({ kind: 'tool', name: 'write_file', status: 'completed', argsPreview: '2 directions staged' });
    } else {
      onEvent({ kind: 'error', message: 'Demo adapter could not find the staging directory in the prompt — directions were not written to disk.' });
    }

    const output = PROPOSAL_OUTPUT;
    await streamText(onEvent, signal, output);
    return output;
  }

  private async runQa(prompt: string, onEvent: RunJobInput['onEvent'], signal: AbortSignal): Promise<string> {
    const generatedStagingRoot = extractStagingRoot(prompt);
    const runId = extractRunId(prompt);
    const criteriaIds = extractCriteriaIds(prompt);
    const target = detectQaTarget(prompt);

    await streamThinking(
      onEvent,
      signal,
      target === 'button'
        ? 'Staging a preview and judging the Button component against the checklist…'
        : 'Staging a preview and judging the Credit Score card against the checklist…',
    );

    if (generatedStagingRoot && runId) {
      const qaDir = path.join(generatedStagingRoot, runId, 'qa');
      await mkdir(qaDir, { recursive: true });
      const previewAbsPath = path.join(qaDir, 'Preview.tsx');
      const srcRoot = path.resolve(generatedStagingRoot, '..', '..'); // .../apps/web/src
      if (target === 'button') {
        const realComponentAbsPath = path.join(srcRoot, 'components/ds/Button.tsx');
        const importSpec = toImportSpecifier(path.relative(path.dirname(previewAbsPath), realComponentAbsPath));
        await writeFile(previewAbsPath, buildButtonQaPreview(importSpec), 'utf8');
      } else {
        const realComponentAbsPath = path.join(srcRoot, 'components/ds/CreditScore.tsx');
        const importSpec = toImportSpecifier(path.relative(path.dirname(previewAbsPath), realComponentAbsPath));
        await writeFile(
          previewAbsPath,
          `import { DsCreditScore } from "${importSpec}";\n\nexport default function Preview() {\n  return <DsCreditScore />;\n}\n`,
          'utf8',
        );
      }
      onEvent({ kind: 'tool', name: 'write_file', status: 'completed', argsPreview: 'qa/Preview.tsx' });
    } else {
      onEvent({ kind: 'error', message: 'Demo adapter could not find the staging directory in the prompt — QA preview was not written to disk.' });
    }

    const output = target === 'button' ? buildButtonQaOutput(criteriaIds) : buildQaOutput(criteriaIds);
    await streamText(onEvent, signal, output);
    return output;
  }

  private async runChat(onEvent: RunJobInput['onEvent'], signal: AbortSignal): Promise<string> {
    const output =
      "This is DS Accelerator's demo mode — every response here is canned fixture data, not a live model call. " +
      "Try the \"Improve component\" flow on the Credit Score component (optionally attaching ticket DS-042) for the full scripted walkthrough.";
    await streamText(onEvent, signal, output);
    return output;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Emits a short burst of thinking_delta events, respecting cancellation between chunks. */
async function streamThinking(onEvent: RunJobInput['onEvent'], signal: AbortSignal, text: string): Promise<void> {
  onEvent({ kind: 'thinking', text: '' });
  for (const chunk of chunkText(text, 24)) {
    if (signal.aborted) return;
    onEvent({ kind: 'thinking_delta', text: chunk });
    await sleep(60);
  }
  onEvent({ kind: 'thinking_done' });
}

/** Emits the final output as a sequence of text_delta events, for a realistic streaming feel. */
async function streamText(onEvent: RunJobInput['onEvent'], signal: AbortSignal, text: string): Promise<void> {
  for (const chunk of chunkText(text, 80)) {
    if (signal.aborted) return;
    onEvent({ kind: 'text_delta', text: chunk });
    await sleep(20);
  }
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks.length > 0 ? chunks : [text];
}

type Phase = 'understanding' | 'proposal' | 'qa' | 'chat';

function detectPhase(prompt: string): Phase {
  if (prompt.includes('Analyze this design-system change request')) return 'understanding';
  if (prompt.includes('Generate REAL, working alternative implementations')) return 'proposal';
  if (prompt.includes('Stage the component below for a quality check')) return 'qa';
  return 'chat';
}

/**
 * Every prompt reaching an adapter is wrapped by server.ts's basePrompt,
 * which names the ABSOLUTE staging root once so generated/direction files
 * always land where Vite serves them from, regardless of the connected
 * repo's cwd. See server.ts's `generatedStagingRoot` comment.
 */
function extractStagingRoot(prompt: string): string | null {
  // The path itself may contain spaces (this repo's own checkout does), so
  // capture to end-of-line rather than to the next whitespace.
  const match = /never to your current working directory:\s*(.+)/.exec(prompt);
  return match?.[1]?.trim() ?? null;
}

/** The run id is embedded verbatim in the staging path prompts.ts writes into the prompt text (e.g. ".../.generated/<runId>/..."). */
function extractRunId(prompt: string): string | null {
  const match = /\.generated\/([A-Za-z0-9_-]+)\//.exec(prompt);
  return match?.[1] ?? null;
}

/** Parses "- id: "..." — Title. Requirement" lines from buildQaPrompt's "## Criteria to judge" section. */
function extractCriteriaIds(prompt: string): string[] {
  const ids: string[] = [];
  const re = /^-\s*id:\s*"([^"]+)"/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt))) ids.push(match[1]);
  return ids;
}

/**
 * QA is the one phase that runs against whichever component the presenter
 * actually picked (Improve/analysis stay hardcoded to Credit Score — see
 * fixtures.ts's header comment), so it has to know which of the two wired
 * demo components it's looking at. formatSourceLabel (prompts.ts) puts the
 * Storybook stories path and import path straight into the prompt text for
 * any Storybook-backed source, so a plain substring check is exactly as
 * reliable as extractStagingRoot/extractRunId's own regex parsing below.
 */
function detectQaTarget(prompt: string): 'button' | 'credit-score' {
  return /components\/ds\/Button\.tsx|Actions\/Button/.test(prompt) ? 'button' : 'credit-score';
}

/**
 * Unlike the Credit Score QA preview (one default render), Button's whole
 * point in this demo is to be genuinely interactive — several real,
 * clickable/tabbable states side by side, including the inverse variant on
 * a dark surface where DS-051 flags its focus ring as low-contrast, so a
 * presenter can actually tab through and show what QA is judging instead of
 * describing it.
 */
function buildButtonQaPreview(importSpec: string): string {
  return `import { DsButton } from "${importSpec}";

export default function Preview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <DsButton variant="primary">Primary</DsButton>
        <DsButton variant="secondary">Secondary</DsButton>
        <DsButton variant="ghost">Ghost</DsButton>
        <DsButton variant="destructive">Destructive</DsButton>
        <DsButton variant="primary" disabled>
          Disabled
        </DsButton>
      </div>
      <div style={{ display: "flex", gap: 12, padding: 16, background: "#111827", borderRadius: 8 }}>
        <DsButton variant="inverse">Inverse (tab to me)</DsButton>
      </div>
    </div>
  );
}
`;
}

/**
 * Button's QA judgment. Note this only ever shows up for the handful of
 * criteria QaReport.tsx has no client-measured finding for (ds.token-usage,
 * ds.component-reuse, ds.no-branding, responsive.behavior,
 * code.inline-style-leakage) — a11y.*, responsive.no-horizontal-overflow,
 * and code.layout-collapse all run for real against the staged preview (see
 * previewFrameEntry.tsx's runQaChecks) and a measured finding always wins
 * over the model's opinion for the same criterion id (QaReport.tsx). That's
 * deliberate: Button is real and actually accessible, so the honest,
 * measured "everything works with a keyboard" result is the more convincing
 * demo than a scripted failure would be.
 */
function buildButtonQaOutput(criteriaIds: string[]): string {
  const ids = criteriaIds.length > 0 ? criteriaIds : ['ds.component-reuse', 'ds.no-branding', 'responsive.behavior'];
  const findings = ids.map(
    (id) =>
      `  {\n    "criterionId": "${id}",\n    "status": "pass",\n    "detail": "Reuses the existing DsButton primitive with no new markup or one-off styling — variant/size are driven entirely by the existing token set."\n  }`,
  );
  return `## Files Read JSON
\`\`\`json
["apps/web/src/components/ds/Button.tsx", "apps/web/src/components/ds/Button.css"]
\`\`\`
## QA Judgment JSON
\`\`\`json
[
${findings.join(',\n')}
]
\`\`\`
`;
}

function toImportSpecifier(relativePath: string): string {
  const posix = relativePath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
  return posix.startsWith('.') ? posix : `./${posix}`;
}

async function writeDirection(
  generatedStagingRoot: string,
  runId: string,
  directionId: string,
  files: { componentTsx: string; cssFileName: string; css: string; previewTsx: string },
): Promise<void> {
  const directionDir = path.join(generatedStagingRoot, runId, directionId);
  const realDir = path.join(directionDir, 'real', 'apps', 'web', 'src', 'components', 'ds');
  await mkdir(realDir, { recursive: true });
  await writeFile(path.join(realDir, 'CreditScore.tsx'), files.componentTsx, 'utf8');
  await writeFile(path.join(realDir, files.cssFileName), files.css, 'utf8');
  await writeFile(path.join(directionDir, 'Preview.tsx'), files.previewTsx, 'utf8');
}

const UNDERSTANDING_OUTPUT = `## Summary
The Credit Score card leads with a large number and a semicircular gauge, but users fixate on the score without understanding what it means or what to do next.

## Interpretation
The ticket and the component's own source agree on the problem: the status badge and trend line sit visually secondary to the gauge, so the score reads as a decontextualized number instead of an explained one.

## Sources Reviewed
- Ticket (DS-042) → docs/tasks/ds-042-credit-score-clarity: confirmed the problem, constraints, and success criteria
- Component from the team's Storybook: Data Display/Credit Score — stories file: apps/web/src/components/ds/CreditScore.tsx (read it to locate the component's real source): confirmed the current DsCreditScore prop API

## In Scope
- Reorder the card to lead with status and plain-language guidance
- Keep the arc gauge available for anyone who wants the exact number
- Stay within the existing var(--ds-*) tokens
- Preserve the current DsCreditScore prop API

## Out of Scope
- Removing or replacing the baseline arc gauge component
- Changing the credit-score data source or calculation
- Any client-specific branding or copy

## Assumptions
- The existing badge tiers (Excellent, Good, Fair, Poor) stay the source of truth for guidance copy
- No new props are required beyond the current DsCreditScoreProps

## Open Questions
- Should the plain-language guidance copy vary per credit bureau, or is one generic set fine for all four?
- Must the numeric score always stay the single largest element on the card, or can it become secondary?

## Risks
- A denser card could reduce the arc gauge's visual prominence more than intended
- Guidance copy reads as financial advice and would need a compliance pass before shipping for real

## Change Intent JSON
\`\`\`json
{
  "targetComponent": "Credit Score",
  "changeType": "layout-rule",
  "stateCondition": "When the Credit Score card renders for any badge tier (Excellent, Good, Fair, Poor)",
  "codeTargets": ["apps/web/src/components/ds/CreditScore.tsx"],
  "proposedRule": "Lead the card with the status badge and a one-sentence plain-language guidance line derived from the badge tier, and keep the arc gauge as a secondary, still-visible element — never remove it.",
  "confidence": 0.78,
  "assumptions": ["Existing badge tiers stay the source of truth for guidance copy"],
  "followUpQuestions": ["Should guidance copy vary per credit bureau, or stay generic?"]
}
\`\`\`
`;

const PROPOSAL_OUTPUT = `## Summary
- Built two directions that both lead with what the score means, not just the number
- Direction A puts status and guidance first; Direction B keeps the gauge as the hero and adds context below it

## Change Intent JSON
\`\`\`json
{
  "targetComponent": "Credit Score",
  "changeType": "layout-rule",
  "stateCondition": "When the Credit Score card renders for any badge tier (Excellent, Good, Fair, Poor)",
  "codeTargets": ["apps/web/src/components/ds/CreditScore.tsx"],
  "proposedRule": "Lead the card with the status badge and a one-sentence plain-language guidance line derived from the badge tier, and keep the arc gauge as a secondary, still-visible element — never remove it.",
  "confidence": 0.78,
  "assumptions": ["Existing badge tiers stay the source of truth for guidance copy"],
  "followUpQuestions": ["Should guidance copy vary per credit bureau, or stay generic?"]
}
\`\`\`

## Directions JSON
\`\`\`json
[
  {
    "id": "direction-a",
    "title": "Status-first hierarchy",
    "summary": "Leads with the badge and a plain-language guidance line, before the gauge.",
    "highlights": ["Guidance first", "Compact gauge", "Smaller score number"],
    "differentiationAxis": "status-first vs. gauge-first hierarchy",
    "reasoning": "The confirmed analysis flags that the badge and trend compete with the score instead of explaining it — this direction resolves that by making status and guidance the first thing read, demoting the gauge to a supporting role.",
    "responsiveNotes": "The lead badge/guidance block and gauge both stay in a single column at every width — nothing wraps or hides, the gauge is simply drawn at a smaller fixed scale than the baseline.",
    "tradeoffs": ["Score number is less visually dominant than today"],
    "complexity": "low",
    "affectedFiles": ["apps/web/src/components/ds/CreditScore.tsx"],
    "confidence": 0.75,
    "recommended": true,
    "previewFile": "direction-a/Preview.tsx"
  },
  {
    "id": "direction-b",
    "title": "Context band under the arc",
    "summary": "Keeps the gauge as the hero and adds a short guidance band beneath it.",
    "highlights": ["Gauge unchanged", "New guidance band", "Same card height"],
    "differentiationAxis": "gauge-first with an added explanation band",
    "reasoning": "For users who already read the gauge fine, this direction preserves that mental model entirely and answers 'what does this mean' immediately below it, rather than restructuring the card.",
    "responsiveNotes": "The gauge behaves exactly as the baseline does at every width; the new band below it is a single line of text that wraps normally on narrow cards, adding one row of height.",
    "tradeoffs": ["Guidance sits below the gauge, so it's a beat slower to reach than in Direction A"],
    "complexity": "low",
    "affectedFiles": ["apps/web/src/components/ds/CreditScore.tsx"],
    "confidence": 0.7,
    "recommended": false,
    "previewFile": "direction-b/Preview.tsx"
  }
]
\`\`\`
`;

function buildQaOutput(criteriaIds: string[]): string {
  const ids = criteriaIds.length > 0 ? criteriaIds : ['ds.component-reuse', 'ds.no-branding', 'responsive.behavior'];
  const findings = ids.map((id, index) => {
    if (index % 3 === 2) {
      return `  {\n    "criterionId": "${id}",\n    "status": "warning",\n    "detail": "The card doesn't reflow at narrow widths yet — it stays visually identical from mobile to desktop.",\n    "suggestedFix": "Add a narrower single-column layout below roughly 360px."\n  }`;
    }
    return `  {\n    "criterionId": "${id}",\n    "status": "pass",\n    "detail": "Reuses DsProgressArc and DsTypography rather than introducing new primitives, and stays generic to the design system with no client-specific copy or branding."\n  }`;
  });
  return `## Files Read JSON
\`\`\`json
["apps/web/src/components/ds/CreditScore.tsx"]
\`\`\`
## QA Judgment JSON
\`\`\`json
[
${findings.join(',\n')}
]
\`\`\`
`;
}
