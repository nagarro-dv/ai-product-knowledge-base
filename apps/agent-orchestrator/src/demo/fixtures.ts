import type { StorybookComponent } from '../integrations/storybook/StorybookIntegration.js';
import type { TicketDetail } from '../integrations/types.js';

/**
 * DEMO_MODE swaps every real integration (Storybook, Jira, the workspace
 * repository, the AI provider) for fixture-backed equivalents, so the DS
 * Accelerator flow can be demoed end-to-end with no credentials, no live
 * design system, and no network calls.
 *
 * Read via a function, never a module-level constant: server.ts calls
 * dotenv.config() at its own top level, which — under ESM import hoisting —
 * runs AFTER every statically-imported module (this one included) has
 * already executed its top-level code. A `const` computed here at import
 * time would freeze on whatever `process.env.DEMO_MODE` was before the
 * .env file loaded. Every other env-gated check in this codebase reads
 * `process.env` inside a function/constructor body for the same reason.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === 'true';
}

/**
 * Two components have a genuine, wired-up demo scenario — deliberately
 * different shapes of component, so a presenter can show two different
 * things:
 *   - Credit Score (DS-042): a read-only display component. Drives the
 *     "Improve component" story end-to-end (analysis + two real generated
 *     directions to compare) — see UNDERSTANDING_OUTPUT, PROPOSAL_OUTPUT,
 *     and the DIRECTION_A / DIRECTION_B exports below.
 *   - Button (DS-051): a real interactive component (hover/active/focus/
 *     disabled states, keyboard-operable) — nothing to compare directions
 *     on, but exactly the shape "Test Component" needs to demo something
 *     genuinely testable. Drives the QA story — see DemoAdapter.ts's
 *     buildButtonQaPreview and buildButtonQaOutput.
 * The rest are the same kind of lightweight filler as DEMO_TICKETS below:
 * real component names from apps/web/src/components/ds, grouped under
 * `path` the way a real Storybook groups stories into categories, so the
 * component picker's folder drilldown (see ComponentPicker.tsx) has more
 * than one flat level to demo instead of a single bucket of everything —
 * picking one of those gets the generic chat fallback, not a mismatched
 * scripted response.
 */
export const DEMO_STORYBOOK_COMPONENTS: StorybookComponent[] = [
  {
    id: 'components-data-display-credit-score',
    title: 'Credit Score',
    path: 'Data Display/Credit Score',
    storyIds: ['components-creditscore--default', 'components-creditscore--poor'],
    storyNames: ['Default', 'Poor'],
    importPath: 'apps/web/src/components/ds/CreditScore.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-data-display-badge',
    title: 'Badge',
    path: 'Data Display/Badge',
    storyIds: ['components-badge--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/Badge.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-actions-button',
    title: 'Button',
    path: 'Actions/Button',
    storyIds: ['components-button--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/Button.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-actions-icon-button',
    title: 'Icon Button',
    path: 'Actions/Icon Button',
    storyIds: ['components-iconbutton--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/IconButton.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-feedback-tooltip',
    title: 'Tooltip',
    path: 'Feedback/Tooltip',
    storyIds: ['components-tooltip--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/Tooltip.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-feedback-progress-arc',
    title: 'Progress Arc',
    path: 'Feedback/Progress Arc',
    storyIds: ['components-progressarc--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/ProgressArc.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-forms-checkbox',
    title: 'Checkbox',
    path: 'Forms/Checkbox',
    storyIds: ['components-checkbox--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/Checkbox.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-forms-slider',
    title: 'Slider',
    path: 'Forms/Slider',
    storyIds: ['components-slider--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/Slider.tsx',
    tags: ['autodocs'],
  },
  {
    id: 'components-layout-accordion',
    title: 'Accordion',
    path: 'Layout/Accordion',
    storyIds: ['components-accordion--showcase'],
    storyNames: ['Showcase'],
    importPath: 'apps/web/src/components/ds/Accordion.tsx',
    tags: ['autodocs'],
  },
];

/**
 * DS-042 mirrors the real fixture ticket already resolved client-side by
 * apps/web/src/accelerator/task-docs.ts (docs/tasks/ds-042-credit-score-clarity) —
 * same problem, same constraints, restated as a Jira-shaped ticket so the
 * Jira picker has something real to search. The other two are lightweight
 * filler so the search dropdown doesn't look suspiciously empty.
 */
export const DEMO_TICKETS: TicketDetail[] = [
  {
    id: 'demo-1',
    key: 'DS-042',
    title: 'Credit Score card — lead with meaning, not just the number',
    type: 'Story',
    status: 'In Progress',
    statusCategory: 'in-progress',
    priority: 'High',
    url: 'https://demo.atlassian.net/browse/DS-042',
    description:
      'The Credit Score card shows a large numeric score and arc gauge, but usability tests found that many ' +
      'users fixate on the number without understanding what the score means or what action to take. The status ' +
      'badge and trend line compete visually with the score instead of explaining it.\n\n' +
      'Constraints: keep the baseline DsCreditScore component and its existing prop API; stay within var(--ds-*) ' +
      'tokens; meet WCAG 2.2 AA for contrast, focus, and readable text hierarchy.',
    descriptionIsEmpty: false,
    assignee: 'Priya Shah',
    reporter: 'Marcus Webb',
    project: { key: 'DS', name: 'Design System' },
    labels: ['credit-score', 'clarity', 'accessibility'],
    sprint: 'Sprint 14',
    acceptanceCriteria:
      'At least two comparable solution directions are documented. The baseline component remains available and ' +
      'untouched. Implementation stays within existing tokens.',
    linkedIssues: [],
    comments: [
      {
        author: 'Priya Shah',
        body: 'Research readout attached — 7 of 10 users could not explain their score after seeing the card for 5 seconds.',
        createdAt: '2026-08-12T09:14:00Z',
      },
    ],
    attachments: [],
  },
  {
    id: 'demo-2',
    key: 'DS-051',
    title: 'Button focus ring is too low-contrast on dark surfaces',
    type: 'Bug',
    status: 'To Do',
    statusCategory: 'todo',
    priority: 'Medium',
    url: 'https://demo.atlassian.net/browse/DS-051',
    description:
      'On dark surfaces, the default Button focus ring drops below the 3:1 non-text contrast minimum, making ' +
      'keyboard focus hard to see.',
    descriptionIsEmpty: false,
    project: { key: 'DS', name: 'Design System' },
    labels: ['accessibility', 'button'],
    linkedIssues: [],
    comments: [],
    attachments: [],
  },
  {
    id: 'demo-3',
    key: 'DS-077',
    title: 'Tooltip overflows the viewport on narrow mobile widths',
    type: 'Bug',
    status: 'To Do',
    statusCategory: 'todo',
    priority: 'Low',
    url: 'https://demo.atlassian.net/browse/DS-077',
    description:
      'Tooltip content longer than ~40 characters overflows the right edge of the viewport below 360px width ' +
      'instead of wrapping or repositioning.',
    descriptionIsEmpty: false,
    project: { key: 'DS', name: 'Design System' },
    labels: ['tooltip', 'responsive'],
    linkedIssues: [],
    comments: [],
    attachments: [],
  },
];

/** Repo-relative paths of the files the seeded demo repository ships with — see seedDemoRepo.ts. */
export const DEMO_SEED_COMPONENT_PATHS = [
  'apps/web/src/components/ds/CreditScore.tsx',
  'apps/web/src/components/ds/Button.tsx',
  'apps/web/src/components/ds/Button.css',
];

/**
 * Direction A — "Status-first hierarchy" (docs/tasks/ds-042-credit-score-clarity/solutions/solution-a.md):
 * badge and one-line guidance lead the card, above a smaller, secondary gauge.
 */
export const DIRECTION_A_COMPONENT_TSX = `import { DsProgressArc, type DsProgressArcVariant } from "./ProgressArc";
import { DsTypography } from "./DsTypography";
import "./CreditScore.css";
import "./CreditScoreDirectionA.css";

export type DsCreditScoreProps = {
  score?: number;
  maxScore?: number;
  label?: string;
  provider?: string;
  trend?: string;
  badge?: string;
  updatedOn?: string;
  className?: string;
};

function getCreditScoreVariant(badge: string): { arc: DsProgressArcVariant; badgeClass: string } {
  const normalized = badge.trim().toLowerCase();
  if (normalized.includes("poor")) {
    return { arc: "error", badgeClass: "ds-credit-score__badge--destructive" };
  }
  if (normalized.includes("fair")) {
    return { arc: "warning", badgeClass: "ds-credit-score__badge--warning" };
  }
  return { arc: "success", badgeClass: "ds-credit-score__badge--success" };
}

function getGuidance(badge: string): string {
  const normalized = badge.trim().toLowerCase();
  if (normalized.includes("excellent")) return "You qualify for the best available rates.";
  if (normalized.includes("poor")) return "Missed payments are hurting your score the most.";
  if (normalized.includes("fair")) return "Paying down balances could raise your score.";
  return "No action needed right now — keep doing what you're doing.";
}

/**
 * Direction A — status-first hierarchy. The badge and a plain-language
 * guidance line now lead the card, before the gauge, so the status reads
 * first — the arc stays available as a smaller, secondary element for
 * anyone who wants the exact number. Same public prop API as the baseline.
 */
export function DsCreditScore({
  score = 724,
  maxScore = 999,
  label = "Your credit score",
  provider = "Experian (UK)",
  trend = "↑ 12 pts this month",
  badge = "Good",
  updatedOn = "Updated on: 9 Mar 2026",
  className = "",
}: DsCreditScoreProps) {
  const value = Math.round((Math.max(0, Math.min(score, maxScore)) / maxScore) * 100);
  const { arc: arcVariant, badgeClass } = getCreditScoreVariant(badge);
  const guidance = getGuidance(badge);

  return (
    <div
      className={["ds-credit-score", "ds-credit-score--status-first", className].filter(Boolean).join(" ")}
      data-component="credit-score"
      data-direction="status-first-hierarchy"
    >
      <div className="ds-credit-score__inner">
        <div className="ds-credit-score__header">
          <div className="ds-credit-score__header-row">
            <div className="ds-credit-score__header-frame">
              <DsTypography as="span" variant="paragraph-small-medium" className="ds-credit-score__label">
                {label}
              </DsTypography>
            </div>
          </div>
          <div className="ds-credit-score__header-row">
            <DsTypography as="span" variant="paragraph-mini-bold" className="ds-credit-score__provider">
              {provider}
            </DsTypography>
          </div>
        </div>

        <div className="ds-credit-score-status-first__lead">
          <DsTypography as="span" variant="paragraph-mini-bold" className={\`ds-credit-score__badge \${badgeClass}\`}>
            {badge}
          </DsTypography>
          <DsTypography as="p" variant="paragraph-small-medium" className="ds-credit-score-status-first__guidance">
            {guidance}
          </DsTypography>
        </div>

        <div className="ds-credit-score__gauge ds-credit-score-status-first__gauge">
          <DsProgressArc
            className="ds-credit-score__progress-arc"
            value={value}
            variant={arcVariant}
            minLabel="0"
            maxLabel={String(maxScore)}
            width={278}
            height={155}
            aria-label={\`Credit score progress: \${value}%\`}
          />
          <div className="ds-credit-score-status-first__score-overlay" aria-hidden>
            <DsTypography as="span" variant="heading-2" className="ds-credit-score-status-first__number">
              {score}
            </DsTypography>
            <DsTypography as="span" variant="paragraph-mini-medium" className="ds-credit-score__trend">
              {trend}
            </DsTypography>
          </div>
        </div>

        <DsTypography as="p" variant="paragraph-mini-medium" className="ds-credit-score__updated">
          {updatedOn}
        </DsTypography>
      </div>
    </div>
  );
}
`;

export const DIRECTION_A_CSS = `.ds-credit-score-status-first__lead {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ds-general-gap-xs, 4px);
  margin-bottom: var(--ds-general-gap-md, 8px);
}

.ds-credit-score-status-first__guidance {
  margin: 0;
}

.ds-credit-score-status-first__gauge {
  transform: scale(0.82);
  transform-origin: top left;
}

.ds-credit-score-status-first__score-overlay {
  position: absolute;
  top: 46%;
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ds-general-gap-2xs, 2px);
}

.ds-credit-score-status-first__number {
  line-height: 1;
}
`;

export const DIRECTION_A_PREVIEW_TSX = `import { DsCreditScore } from "./real/apps/web/src/components/ds/CreditScore";

// One realistic example, not every badge state at once — a comparison
// preview should show what this direction looks like, not showcase the
// whole prop surface.
export default function Preview() {
  return (
    <div style={{ display: "flex", padding: 24 }}>
      <DsCreditScore score={724} badge="Good" trend="↑ 12 pts this month" provider="Experian (UK)" />
    </div>
  );
}
`;

/**
 * Direction B — "Context band under the arc" (docs/tasks/ds-042-credit-score-clarity/solutions/solution-b.md):
 * the gauge stays the untouched hero element; a new band beneath it pairs
 * the trend with one sentence of plain-language guidance.
 */
export const DIRECTION_B_COMPONENT_TSX = `import { DsProgressArc, type DsProgressArcVariant } from "./ProgressArc";
import { DsTypography } from "./DsTypography";
import "./CreditScore.css";
import "./CreditScoreDirectionB.css";

export type DsCreditScoreProps = {
  score?: number;
  maxScore?: number;
  label?: string;
  provider?: string;
  trend?: string;
  badge?: string;
  updatedOn?: string;
  className?: string;
};

function getCreditScoreVariant(badge: string): { arc: DsProgressArcVariant; badgeClass: string } {
  const normalized = badge.trim().toLowerCase();
  if (normalized.includes("poor")) {
    return { arc: "error", badgeClass: "ds-credit-score__badge--destructive" };
  }
  if (normalized.includes("fair")) {
    return { arc: "warning", badgeClass: "ds-credit-score__badge--warning" };
  }
  return { arc: "success", badgeClass: "ds-credit-score__badge--success" };
}

function getGuidance(badge: string): string {
  const normalized = badge.trim().toLowerCase();
  if (normalized.includes("excellent")) return "You qualify for the best available rates.";
  if (normalized.includes("poor")) return "Missed payments are hurting your score the most.";
  if (normalized.includes("fair")) return "Paying down balances could raise your score.";
  return "No action needed right now — keep doing what you're doing.";
}

/**
 * Direction B — context band under the arc. The gauge stays exactly as it
 * is today (same size, same position, still the hero element) — a new band
 * below it pairs the trend with one sentence of plain-language guidance.
 * Same public prop API as the baseline.
 */
export function DsCreditScore({
  score = 724,
  maxScore = 999,
  label = "Your credit score",
  provider = "Experian (UK)",
  trend = "↑ 12 pts this month",
  badge = "Good",
  updatedOn = "Updated on: 9 Mar 2026",
  className = "",
}: DsCreditScoreProps) {
  const value = Math.round((Math.max(0, Math.min(score, maxScore)) / maxScore) * 100);
  const { arc: arcVariant, badgeClass } = getCreditScoreVariant(badge);
  const guidance = getGuidance(badge);

  return (
    <div
      className={["ds-credit-score", "ds-credit-score--context-band", className].filter(Boolean).join(" ")}
      data-component="credit-score"
      data-direction="context-band-under-arc"
    >
      <div className="ds-credit-score__inner">
        <div className="ds-credit-score__header">
          <div className="ds-credit-score__header-row">
            <div className="ds-credit-score__header-frame">
              <DsTypography as="span" variant="paragraph-small-medium" className="ds-credit-score__label">
                {label}
              </DsTypography>
            </div>
          </div>
          <div className="ds-credit-score__header-row">
            <DsTypography as="span" variant="paragraph-mini-bold" className="ds-credit-score__provider">
              {provider}
            </DsTypography>
          </div>
        </div>

        <div className="ds-credit-score__gauge" data-figma-node="2033:70720">
          <DsProgressArc
            className="ds-credit-score__progress-arc"
            value={value}
            variant={arcVariant}
            minLabel="0"
            maxLabel={String(maxScore)}
            width={278}
            height={155}
            aria-label={\`Credit score progress: \${value}%\`}
          />
          <div className="ds-credit-score__trend-wrap" aria-hidden>
            <DsTypography as="span" variant="paragraph-mini-medium" className="ds-credit-score__trend">
              {trend}
            </DsTypography>
          </div>
          <div className="ds-credit-score__balance" aria-hidden>
            <div className="ds-credit-score__score-row">
              <DsTypography as="span" variant="heading-1" className="ds-credit-score__number">
                {score}
              </DsTypography>
            </div>
            <div className="ds-credit-score__badge-row">
              <DsTypography as="span" variant="paragraph-mini-bold" className={\`ds-credit-score__badge \${badgeClass}\`}>
                {badge}
              </DsTypography>
            </div>
          </div>
        </div>

        <div className="ds-credit-score-context-band">
          <DsTypography as="p" variant="paragraph-mini-medium" className="ds-credit-score-context-band__text">
            {guidance}
          </DsTypography>
        </div>

        <DsTypography as="p" variant="paragraph-mini-medium" className="ds-credit-score__updated">
          {updatedOn}
        </DsTypography>
      </div>
    </div>
  );
}
`;

export const DIRECTION_B_CSS = `.ds-credit-score-context-band {
  display: flex;
  align-items: center;
  padding: var(--ds-general-gap-sm, 6px) var(--ds-general-gap-md, 8px);
  border-radius: var(--ds-general-radius-rounded-md, 8px);
  background: var(--ds-general-color-background, rgba(127, 127, 127, 0.08));
  margin-top: var(--ds-general-gap-sm, 6px);
}

.ds-credit-score-context-band__text {
  margin: 0;
}
`;

// One realistic example, not every badge state at once — a comparison
// preview should show what this direction looks like, not showcase the
// whole prop surface.
export const DIRECTION_B_PREVIEW_TSX = `import { DsCreditScore } from "./real/apps/web/src/components/ds/CreditScore";

export default function Preview() {
  return (
    <div style={{ display: "flex", padding: 24 }}>
      <DsCreditScore score={724} badge="Good" trend="↑ 12 pts this month" provider="Experian (UK)" />
    </div>
  );
}
`;
