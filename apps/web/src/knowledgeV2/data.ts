import {
  BookOpenCheck,
  ChartColumn,
  ClipboardList,
  FileText,
  FlaskConical,
  Frame,
  GitCompareArrows,
  History,
  Lightbulb,
  ListOrdered,
  Megaphone,
  MessagesSquare,
  Route,
  Target,
  TrendingDown,
  UserRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/*
 * Fixture data for the v2 Product Knowledge Base. There is no knowledge
 * backend or agent runtime yet, so everything the agents "found" lives here.
 * Source ids match ../knowledge/sources.ts so logos come from the same place.
 */

export type SourceId = string;

// ── Tracked metrics ─────────────────────────────────────────────────────────

export type Metric = {
  id: string;
  label: string;
  value: string;
  /** Change over `period`, already formatted (e.g. "+4.2%"). */
  delta: string;
  period: string;
  /** Whether the change is good news — a falling churn rate is "up". */
  trend: "up" | "down";
  /** Last 12 data points, oldest first, for the sparkline. */
  series: number[];
  source: SourceId;
  /** The roadmap goal this metric is tracked against, if any. */
  goal?: string;
};

export const METRICS: Metric[] = [
  {
    id: "wau",
    label: "Weekly active users",
    value: "12,480",
    delta: "+4.2%",
    period: "week on week",
    trend: "up",
    series: [9.8, 10.1, 10.0, 10.4, 10.9, 10.7, 11.2, 11.5, 11.4, 11.9, 12.0, 12.48],
    source: "amplitude",
    goal: "Roadmap goal: +5% WoW through Q4",
  },
  {
    id: "csat",
    label: "Customer satisfaction",
    value: "3.9 / 5",
    delta: "−0.5",
    period: "in 30 days",
    trend: "down",
    series: [4.4, 4.4, 4.3, 4.4, 4.3, 4.2, 4.2, 4.1, 4.0, 4.0, 3.9, 3.9],
    source: "zendesk",
  },
  {
    id: "activation",
    label: "First-week activation",
    value: "41%",
    delta: "+1.8 pts",
    period: "month on month",
    trend: "up",
    series: [36, 37, 37, 38, 38, 39, 38, 39, 40, 40, 41, 41],
    source: "amplitude",
    goal: "Roadmap goal: 45% by end of Q4",
  },
  {
    id: "checkout",
    label: "Checkout conversion",
    value: "62.4%",
    delta: "−2.1 pts",
    period: "month on month",
    trend: "down",
    series: [65, 64.8, 64.9, 64.5, 64.6, 64.0, 63.8, 63.5, 63.1, 62.9, 62.6, 62.4],
    source: "mixpanel",
  },
  {
    id: "time-on-page",
    label: "Time on pricing page",
    value: "1m 48s",
    delta: "+22s",
    period: "month on month",
    trend: "down",
    series: [80, 82, 85, 84, 88, 92, 95, 97, 99, 102, 105, 108],
    source: "hotjar",
  },
];

/** Metrics shown on Start until the user customizes the dashboard. */
export const DEFAULT_TRACKED_METRICS = ["wau", "csat", "activation"];

// ── Initiatives ─────────────────────────────────────────────────────────────

export type InitiativeStage = "proposed" | "exploring" | "brief" | "prototype" | "validating";

export const STAGES: { id: InitiativeStage; label: string; action?: string }[] = [
  { id: "proposed", label: "Proposed", action: "Start exploring" },
  { id: "exploring", label: "Exploring", action: "Extract brief" },
  { id: "brief", label: "Brief ready", action: "Prototype in Figma" },
  { id: "prototype", label: "Prototyping", action: "Share for validation" },
  { id: "validating", label: "Validating" },
];

export type Evidence = { source: SourceId; summary: string };

export type Initiative = {
  id: string;
  title: string;
  summary: string;
  stage: InitiativeStage;
  /** Which agent proposed it, or "You". */
  origin: string;
  /** Roadmap theme it lines up with. */
  theme: string;
  /** RICE inputs — see rice.ts. Confidence isn't stored: it's derived from `evidence`. */
  rice: RiceInputs;
  evidence: Evidence[];
  updated: string;
  /** Set once the initiative is sent to Jira Product Discovery, e.g. "PD-142". */
  jpdKey?: string;
};

/** The parts of a RICE score a person estimates; each carries its reasoning. */
export type RiceInputs = {
  /** People or accounts affected per quarter. */
  reach: number;
  reachUnit: string;
  reachNote: string;
  /** RICE's impact scale: 3 massive, 2 high, 1 medium, 0.5 low, 0.25 minimal. */
  impact: 3 | 2 | 1 | 0.5 | 0.25;
  /** The key result it moves (see OKRS). */
  okr: string;
  impactNote: string;
  /** Person-weeks. */
  effort: number;
  effortNote: string;
};

// ── OKRs ────────────────────────────────────────────────────────────────────

export type KeyResult = { id: string; objective: string; text: string };

/** The company's current objectives and key results; impact is judged against these. */
export const OKRS: KeyResult[] = [
  { id: "KR 1.1", objective: "Grow revenue from existing customers", text: "Upgrade completion back to 70% (now 62%)" },
  { id: "KR 1.2", objective: "Grow revenue from existing customers", text: "Net revenue retention at 110%" },
  { id: "KR 2.1", objective: "Customers trust us with billing", text: "Customer satisfaction back to 4.4 / 5" },
  { id: "KR 3.1", objective: "New teams get value in week one", text: "First-week activation at 45%" },
  { id: "KR 4.1", objective: "Win more enterprise customers", text: "Close the 9 deals blocked on SSO" },
];

export function keyResult(id: string): KeyResult | undefined {
  return OKRS.find((kr) => kr.id === id);
}

export const INITIAL_INITIATIVES: Initiative[] = [
  {
    id: "plan-upgrades",
    title: "Simplify mid-cycle plan upgrades",
    summary:
      "Upgrading mid-cycle shows a prorated charge most customers don't understand. Billing tickets about it are up 63% this month and upgrade completion fell 9 points.",
    stage: "proposed",
    origin: "Roadmap alignment agent",
    theme: "Monetization",
    rice: {
      reach: 2300,
      reachUnit: "accounts a quarter",
      reachNote: "Accounts that changed plan mid-cycle last quarter (Mixpanel).",
      impact: 2,
      okr: "KR 1.1",
      impactNote: "Removes the step where upgrade completion drops — moves KR 1.1 directly.",
      effort: 6,
      effortNote: "Billing squad: proration explainer, invoice preview and copy changes (~3 people × 2 weeks).",
    },
    evidence: [
      { source: "zendesk", summary: "148 tickets mention prorated charges (+63%)" },
      { source: "mixpanel", summary: "Upgrade completion 71% → 62% in 30 days" },
      { source: "jira", summary: "BILL-412 open since March, never prioritized" },
      { source: "dovetail", summary: "4 of 6 interviews flagged invoice confusion" },
    ],
    updated: "Today, 07:40",
  },
  {
    id: "support-quality",
    title: "Recover customer satisfaction on billing",
    summary:
      "CSAT dropped from 4.4 to 3.9 in 30 days, driven almost entirely by billing conversations with long first-response times.",
    stage: "proposed",
    origin: "Voice of customer agent",
    theme: "Customer trust",
    rice: {
      reach: 4100,
      reachUnit: "customers a quarter",
      reachNote: "Customers who contacted support about billing last quarter (Zendesk, Intercom).",
      impact: 1,
      okr: "KR 2.1",
      impactNote: "Billing is the main drag on satisfaction — a medium lift towards KR 2.1.",
      effort: 8,
      effortNote: "Support tooling, macros and a billing triage rota (~2 people × 4 weeks).",
    },
    evidence: [
      { source: "zendesk", summary: "Billing CSAT 3.2 vs 4.3 for other topics" },
      { source: "intercom", summary: "First response on billing: 9h (target 2h)" },
      { source: "slack", summary: "#support-escalations: 31 billing threads this month" },
    ],
    updated: "Yesterday",
  },
  {
    id: "pricing-clarity",
    title: "Clarify plan differences on the pricing page",
    summary:
      "Visitors spend 22s longer on pricing than last month and scroll back to the comparison table repeatedly before leaving.",
    stage: "proposed",
    origin: "KPI watcher agent",
    theme: "Monetization",
    rice: {
      reach: 3600,
      reachUnit: "trial starts a quarter",
      reachNote: "Visitors who reach the pricing page and then start a trial (Google Analytics).",
      impact: 0.5,
      okr: "KR 1.1",
      impactNote: "Clearer plan differences help buyers choose — an indirect, low lift to KR 1.1.",
      effort: 3,
      effortNote: "Pricing page comparison and FAQ updates (~1 designer + 1 engineer × 1.5 weeks).",
    },
    evidence: [
      { source: "hotjar", summary: "38% of sessions scroll back to the plan table 3+ times" },
      { source: "google-analytics", summary: "Pricing exit rate up from 41% to 47%" },
    ],
    updated: "2 days ago",
  },
  {
    id: "onboarding-checklist",
    title: "Guided onboarding checklist",
    summary: "A first-week checklist tied to the three actions that best predict retention.",
    stage: "exploring",
    origin: "You",
    theme: "Activation",
    rice: {
      reach: 1400,
      reachUnit: "new accounts a quarter",
      reachNote: "New accounts created last quarter (Amplitude).",
      impact: 2,
      okr: "KR 3.1",
      impactNote: "Targets the three actions that best predict retention — a high lift to KR 3.1.",
      effort: 5,
      effortNote: "Checklist component, tracking and in-app copy (~2 people × 2.5 weeks).",
    },
    evidence: [
      { source: "amplitude", summary: "Users who invite a teammate in week 1 retain 2.3× better" },
      { source: "dovetail", summary: "New admins don't know what to set up first" },
    ],
    updated: "3 days ago",
  },
  {
    id: "checkout-wallets",
    title: "Add wallet payments to checkout",
    summary: "Checkout conversion is down 2.1 points; mobile users abandon at the card form.",
    stage: "brief",
    origin: "KPI watcher agent",
    theme: "Conversion",
    rice: {
      reach: 2600,
      reachUnit: "mobile buyers a quarter",
      reachNote: "Mobile sessions that reach the card form each quarter (Mixpanel).",
      impact: 1,
      okr: "KR 1.2",
      impactNote: "Recovers part of the mobile checkout drop — a medium lift to KR 1.2.",
      effort: 7,
      effortNote: "Payment provider integration for Apple Pay and Google Pay (~2 people × 3.5 weeks).",
    },
    evidence: [
      { source: "mixpanel", summary: "Mobile drop-off at card entry: 34%" },
      { source: "app-store-reviews", summary: "12 reviews this month ask for Apple Pay" },
    ],
    updated: "Last week",
  },
  {
    id: "saved-searches",
    title: "Saved searches for power users",
    summary: "Power users rebuild the same filters daily; saved searches would cut repeat work.",
    stage: "prototype",
    origin: "You",
    theme: "Retention",
    rice: {
      reach: 900,
      reachUnit: "power users a quarter",
      reachNote: "The most active 10% of users (FullStory).",
      impact: 1,
      okr: "KR 1.2",
      impactNote: "Saves heavy users daily repeat work; they drive 44% of expansion revenue.",
      effort: 4,
      effortNote: "Saved filters, naming and sharing (~2 people × 2 weeks).",
    },
    evidence: [
      { source: "fullstory", summary: "Top 10% of users apply the same 3 filters 4× a day" },
      { source: "productboard", summary: "Most-voted feature request this quarter (212 votes)" },
    ],
    updated: "Last week",
  },
  {
    id: "sso-setup",
    title: "Self-serve SSO setup",
    summary: "Enterprise trials stall waiting on support to configure SSO.",
    stage: "validating",
    origin: "Research synthesizer agent",
    theme: "Enterprise",
    rice: {
      reach: 120,
      reachUnit: "enterprise trials a quarter",
      reachNote: "Enterprise trials that need SSO (Salesforce).",
      impact: 3,
      okr: "KR 4.1",
      impactNote: "Unblocks deals that can't close without it — massive for KR 4.1.",
      effort: 6,
      effortNote: "Self-serve SAML setup and verification flow (~2 people × 3 weeks).",
    },
    evidence: [
      { source: "salesforce", summary: "9 enterprise deals list SSO as a blocker" },
      { source: "figma", summary: "Prototype v2 tested with 5 admins — 4 completed setup" },
    ],
    updated: "2 weeks ago",
  },
];

// ── Signals ─────────────────────────────────────────────────────────────────

/** Something an agent noticed that isn't an initiative yet. */
export type Signal = {
  id: string;
  /** warning = needs attention, positive = opportunity, info = trend. */
  tone: "warning" | "positive" | "info";
  category: "Customer voice" | "Product usage" | "Revenue" | "Research" | "Market";
  title: string;
  /** One or two sentences — what the Start card shows. */
  body: string;
  /** The fuller explanation on the Insights page. */
  detail: string;
  sources: SourceId[];
  evidence: Evidence[];
  /** The metric it moves, with recent history for a sparkline. */
  impact?: { label: string; value: string; delta: string; trend: "up" | "down"; series: number[] };
  /** Which agent found it (see AGENTS). */
  agentId: string;
  /** The initiative it led to, if the agents proposed one. */
  initiativeId?: string;
  found: string;
  /** Not seen yet — the Start card shows these. */
  isNew?: boolean;
};

export const SIGNAL_TONES: { id: Signal["tone"]; label: string }[] = [
  { id: "warning", label: "Needs attention" },
  { id: "positive", label: "Opportunities" },
  { id: "info", label: "Trends" },
];

export const SIGNALS: Signal[] = [
  {
    id: "voc-drop",
    tone: "warning",
    category: "Customer voice",
    title: "Voice of customer is dropping",
    body: "Negative sentiment about invoices rose 63% in 30 days. “I can't tell what I'm being charged for” is the most repeated phrase.",
    detail:
      "Billing conversations now make up 41% of all support contacts, up from 24% a month ago, and they score far lower than anything else. Most mention mid-cycle upgrades or seat changes, and first responses on billing take 9 hours against a 2-hour target. The drop lines up with the invoice redesign shipped on 2 September.",
    sources: ["zendesk", "intercom", "app-store-reviews"],
    evidence: [
      { source: "zendesk", summary: "148 tickets mention invoices or prorated charges (+63% in 30 days)" },
      { source: "intercom", summary: "First response on billing conversations: 9h (target 2h)" },
      { source: "app-store-reviews", summary: "7 one-star reviews this month cite confusing charges" },
    ],
    impact: { label: "Customer satisfaction", value: "3.9 / 5", delta: "−0.5 in 30 days", trend: "down", series: [4.4, 4.4, 4.3, 4.4, 4.3, 4.2, 4.2, 4.1, 4.0, 4.0, 3.9, 3.9] },
    agentId: "voc",
    initiativeId: "support-quality",
    found: "Found 2h ago",
    isNew: true,
  },
  {
    id: "invite-retention",
    tone: "positive",
    category: "Product usage",
    title: "Team invites predict retention",
    body: "Accounts that invite a teammate in their first week retain 2.3× better — the strongest predictor found so far.",
    detail:
      "Across 4,200 accounts created this year, inviting at least one teammate in the first seven days is the single strongest predictor of being active at day 90 — stronger than connecting an integration or finishing setup. Only 31% of new accounts invite anyone in week one, and interviews suggest new admins don't realise they can.",
    sources: ["amplitude", "dovetail"],
    evidence: [
      { source: "amplitude", summary: "Day-90 retention: 58% with a week-1 invite vs 25% without" },
      { source: "amplitude", summary: "31% of new accounts invite a teammate in week 1" },
      { source: "dovetail", summary: "4 of 6 new-admin interviews didn't know inviting was possible during setup" },
    ],
    impact: { label: "Week-1 invite rate", value: "31%", delta: "+2 pts month on month", trend: "up", series: [26, 27, 27, 28, 28, 29, 28, 29, 30, 30, 31, 31] },
    agentId: "research",
    initiativeId: "onboarding-checklist",
    found: "Found yesterday",
    isNew: true,
  },
  {
    id: "upgrade-completion",
    tone: "warning",
    category: "Revenue",
    title: "Fewer customers finish plan upgrades",
    body: "Upgrade completion fell from 71% to 62% in 30 days, mostly at the step that shows the prorated charge.",
    detail:
      "People start upgrades at the usual rate but abandon at the confirmation step, where the prorated amount is shown without explanation. The drop is concentrated in mid-cycle upgrades; upgrades at renewal are unchanged. At current volumes this is roughly 140 lost upgrades a month.",
    sources: ["mixpanel", "zendesk", "jira"],
    evidence: [
      { source: "mixpanel", summary: "Upgrade completion 71% → 62% in 30 days; drop is at the confirm step" },
      { source: "zendesk", summary: "52 tickets ask why the upgrade price differs from the plan price" },
      { source: "jira", summary: "BILL-412 (explain prorated charges) open since March" },
    ],
    impact: { label: "Upgrade completion", value: "62%", delta: "−9 pts in 30 days", trend: "down", series: [72, 71, 71, 70, 70, 69, 67, 66, 65, 64, 63, 62] },
    agentId: "kpi",
    initiativeId: "plan-upgrades",
    found: "Found today, 07:40",
  },
  {
    id: "pricing-hesitation",
    tone: "info",
    category: "Product usage",
    title: "Visitors hesitate on the pricing page",
    body: "Time on the pricing page is up 22 seconds, and 38% of visitors scroll back to the plan table three or more times.",
    detail:
      "Session recordings show visitors comparing plans repeatedly, hovering over seat and storage limits, and leaving without choosing. Exit rate from pricing rose from 41% to 47%. The questions customers ask sales before buying — mixed seats, downgrades, prorating — aren't answered on the page.",
    sources: ["hotjar", "google-analytics", "intercom"],
    evidence: [
      { source: "hotjar", summary: "38% of sessions scroll back to the plan table 3+ times" },
      { source: "google-analytics", summary: "Pricing exit rate 41% → 47% month on month" },
      { source: "intercom", summary: "Top pre-sales questions aren't covered on the pricing page" },
    ],
    impact: { label: "Time on pricing page", value: "1m 48s", delta: "+22s month on month", trend: "down", series: [80, 82, 85, 84, 88, 92, 95, 97, 99, 102, 105, 108] },
    agentId: "kpi",
    initiativeId: "pricing-clarity",
    found: "Found 2 days ago",
  },
  {
    id: "wallet-demand",
    tone: "info",
    category: "Customer voice",
    title: "Requests for Apple Pay are climbing",
    body: "Wallet payments are now the most-requested checkout feature in app reviews and sales notes.",
    detail:
      "Mentions of Apple Pay or Google Pay tripled over the quarter, mostly from mobile buyers. Two enterprise renewals lost last month both listed payment options among their reasons. Mobile users who reach the card form leave at twice the desktop rate.",
    sources: ["app-store-reviews", "salesforce", "mixpanel"],
    evidence: [
      { source: "app-store-reviews", summary: "12 reviews this month ask for Apple Pay (4 last quarter)" },
      { source: "salesforce", summary: "2 lost renewals cite payment options" },
      { source: "mixpanel", summary: "Mobile drop-off at the card form: 34% (desktop 17%)" },
    ],
    agentId: "voc",
    initiativeId: "checkout-wallets",
    found: "Found last week",
  },
  {
    id: "power-filters",
    tone: "positive",
    category: "Product usage",
    title: "Power users rebuild the same filters daily",
    body: "The most active 10% of users apply the same three filters about four times a day.",
    detail:
      "Heavy users spend an average of 6 minutes a day re-creating identical filter combinations. Saved searches is the most-voted request on the feedback board this quarter, and these users account for 44% of expansion revenue.",
    sources: ["fullstory", "productboard"],
    evidence: [
      { source: "fullstory", summary: "Top 10% of users apply the same 3 filters ~4× a day" },
      { source: "productboard", summary: "Saved searches: 212 votes, most-voted this quarter" },
    ],
    agentId: "kpi",
    initiativeId: "saved-searches",
    found: "Found last week",
  },
  {
    id: "sso-blocker",
    tone: "warning",
    category: "Revenue",
    title: "SSO setup is stalling enterprise trials",
    body: "Nine enterprise deals list SSO as a blocker; trials wait an average of 6 days for support to configure it.",
    detail:
      "Enterprise trials that need SSO convert at half the rate of those that don't, and almost all of the gap is time spent waiting for support. The self-serve SSO prototype tested well: 4 of 5 admins completed setup without help.",
    sources: ["salesforce", "zendesk", "figma"],
    evidence: [
      { source: "salesforce", summary: "9 open enterprise deals list SSO as a blocker" },
      { source: "zendesk", summary: "Average wait for SSO configuration: 6 days" },
      { source: "figma", summary: "Self-serve prototype: 4 of 5 admins finished setup unaided" },
    ],
    agentId: "research",
    initiativeId: "sso-setup",
    found: "Found 2 weeks ago",
  },
  {
    id: "activation-up",
    tone: "positive",
    category: "Product usage",
    title: "First-week activation is climbing",
    body: "Activation rose 1.8 points this month, the fourth monthly rise in a row.",
    detail:
      "The gains come mostly from accounts that started with a template, which now activate at 52% compared with 36% for blank workspaces. Templates are shown to only a third of new accounts today.",
    sources: ["amplitude"],
    evidence: [
      { source: "amplitude", summary: "First-week activation 41% (+1.8 pts month on month)" },
      { source: "amplitude", summary: "Template starts activate at 52% vs 36% for blank workspaces" },
    ],
    impact: { label: "First-week activation", value: "41%", delta: "+1.8 pts month on month", trend: "up", series: [36, 37, 37, 38, 38, 39, 38, 39, 40, 40, 41, 41] },
    agentId: "kpi",
    found: "Found 3 days ago",
  },
  {
    id: "competitor-annual",
    tone: "info",
    category: "Market",
    title: "A competitor cut annual pricing by 20%",
    body: "A direct competitor dropped its annual plan price and now highlights it against ours.",
    detail:
      "The change went live two weeks ago, together with a comparison page naming our product. Sales has logged three conversations this month where the price gap came up. Win rate against this competitor hasn't changed yet.",
    sources: ["notion", "salesforce"],
    evidence: [
      { source: "notion", summary: "Competitor changelog: annual plan −20%, new comparison page" },
      { source: "salesforce", summary: "3 deals this month mention the price gap" },
    ],
    agentId: "competitors",
    found: "Found 2 weeks ago",
  },
];

// ── Previous work ───────────────────────────────────────────────────────────

export type WorkItem = {
  id: string;
  title: string;
  kind: "Brief" | "Prototype" | "Chat" | "Research";
  status: string;
  updated: string;
  /** Chat to reopen, when the work came from one. */
  chatId?: string;
};

export const RECENT_WORK: WorkItem[] = [
  { id: "w1", title: "Checkout wallets — initiative brief", kind: "Brief", status: "Draft · 70%", updated: "2 days ago", chatId: "chat-checkout" },
  { id: "w2", title: "Saved searches prototype", kind: "Prototype", status: "In review in Figma", updated: "4 days ago" },
  { id: "w3", title: "Onboarding persona research", kind: "Research", status: "6 interviews synthesized", updated: "Last week", chatId: "chat-persona" },
];

// ── Agents ──────────────────────────────────────────────────────────────────

export type Agent = {
  id: string;
  name: string;
  job: string;
  schedule: string;
  sources: SourceId[];
  status: "running" | "idle" | "paused";
  lastFinding: string;
};

export const AGENTS: Agent[] = [
  {
    id: "voc",
    name: "Voice of customer",
    job: "Reads every new ticket, review and survey answer, and groups them into themes.",
    schedule: "Every hour",
    sources: ["zendesk", "intercom", "app-store-reviews", "typeform"],
    status: "running",
    lastFinding: "Invoice confusion is now the #1 theme (148 mentions).",
  },
  {
    id: "kpi",
    name: "KPI watcher",
    job: "Tracks the metrics you pinned and flags changes beyond their usual range.",
    schedule: "Daily, 07:00",
    sources: ["amplitude", "mixpanel", "hotjar", "google-analytics"],
    status: "idle",
    lastFinding: "Checkout conversion has fallen for 6 weeks in a row.",
  },
  {
    id: "roadmap",
    name: "Roadmap alignment",
    job: "Connects new evidence to roadmap themes and proposes initiatives that move them.",
    schedule: "Daily, 07:30",
    sources: ["jira", "productboard", "confluence"],
    status: "idle",
    lastFinding: "Proposed “Simplify mid-cycle plan upgrades” for the Monetization theme.",
  },
  {
    id: "research",
    name: "Research synthesizer",
    job: "Summarizes new interviews and usability tests and links findings to open initiatives.",
    schedule: "When new research lands",
    sources: ["dovetail", "maze", "granola"],
    status: "idle",
    lastFinding: "Linked 4 interviews to “Simplify mid-cycle plan upgrades”.",
  },
  {
    id: "competitors",
    name: "Competitor scan",
    job: "Watches competitors' changelogs and pricing pages for moves worth reacting to.",
    schedule: "Weekly, Monday",
    sources: ["notion"],
    status: "paused",
    lastFinding: "Paused — no new competitor changes last week.",
  },
];

export type AgentRun = {
  id: string;
  agentId: string;
  state: "running" | "done" | "scheduled";
  when: string;
  summary: string;
  /** Initiative the run proposed or updated. */
  initiativeId?: string;
  /** 0–100, only while running. */
  progress?: number;
};

export const AGENT_RUNS: AgentRun[] = [
  { id: "r1", agentId: "voc", state: "running", when: "Now", summary: "Scanning 412 new Zendesk tickets", progress: 64 },
  { id: "r2", agentId: "kpi", state: "done", when: "2h ago", summary: "Flagged a 0.5 drop in customer satisfaction", initiativeId: "support-quality" },
  { id: "r3", agentId: "roadmap", state: "done", when: "Today, 07:40", summary: "Proposed 1 initiative for Monetization", initiativeId: "plan-upgrades" },
  { id: "r4", agentId: "research", state: "done", when: "Yesterday", summary: "Synthesized 6 onboarding interviews", initiativeId: "onboarding-checklist" },
  { id: "r5", agentId: "kpi", state: "done", when: "2 days ago", summary: "Spotted longer time on the pricing page", initiativeId: "pricing-clarity" },
  { id: "r6", agentId: "kpi", state: "scheduled", when: "Tomorrow, 07:00", summary: "Daily metrics check" },
  { id: "r7", agentId: "competitors", state: "scheduled", when: "Paused", summary: "Weekly competitor scan" },
];

export function agentById(id: string): Agent {
  return AGENTS.find((a) => a.id === id) ?? AGENTS[0]!;
}

// ── Connected sources (Search) ──────────────────────────────────────────────

export type ConnectedSource = {
  id: SourceId;
  items: string;
  synced: string;
  /** One line on what's in there right now. */
  highlight: string;
};

export const CONNECTED_SOURCES: ConnectedSource[] = [
  { id: "jira", items: "3,214 issues", synced: "5 min ago", highlight: "Billing has the most open bugs (212)" },
  { id: "figma", items: "48 files", synced: "12 min ago", highlight: "Checkout v3 designs updated yesterday" },
  { id: "zendesk", items: "18,902 tickets", synced: "2 min ago", highlight: "Invoices are the top topic this week" },
  { id: "amplitude", items: "126 events", synced: "1h ago", highlight: "Weekly active users at an all-time high" },
  { id: "confluence", items: "1,140 pages", synced: "30 min ago", highlight: "Q4 roadmap last edited 3 days ago" },
  { id: "dovetail", items: "86 interviews", synced: "Yesterday", highlight: "6 new onboarding interviews tagged" },
  { id: "slack", items: "24 channels", synced: "1 min ago", highlight: "#support-escalations is busier than usual" },
  { id: "intercom", items: "6,410 conversations", synced: "4 min ago", highlight: "Pre-sales questions up 18% this month" },
  { id: "mixpanel", items: "94 events", synced: "1h ago", highlight: "Checkout conversion down 2.1 points" },
  { id: "hotjar", items: "2,380 recordings", synced: "3h ago", highlight: "Rage clicks spiking on the pricing page" },
  { id: "productboard", items: "540 requests", synced: "Today", highlight: "Saved searches is the most-voted request" },
  { id: "miro", items: "37 boards", synced: "Yesterday", highlight: "Onboarding journey map updated" },
  { id: "salesforce", items: "1,920 accounts", synced: "20 min ago", highlight: "9 enterprise deals list SSO as a blocker" },
  { id: "github", items: "12 repos", synced: "8 min ago", highlight: "Checkout service had 14 merges this week" },
];

/** How many sources are connected — used in copy across v2. */
export const CONNECTED_COUNT = CONNECTED_SOURCES.length;

export const TRENDING_TOPICS = ["Invoices", "Plan upgrades", "SSO", "Mobile checkout", "Onboarding"];

export const KNOWLEDGE_TOTALS = [
  { label: "Sources connected", value: String(CONNECTED_COUNT) },
  { label: "Items indexed", value: "23.5k" },
  { label: "New this week", value: "1,312" },
];

// ── Templates (Create) ──────────────────────────────────────────────────────

export type Template = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "brief",
    label: "Initiative brief",
    description: "Problem, evidence, goals and open questions on one page.",
    icon: FileText,
    prompt: "Draft an initiative brief for [problem or opportunity]: the problem, who it affects, supporting evidence, success metrics and open questions.",
  },
  {
    id: "opportunity",
    label: "Opportunity assessment",
    description: "Size it, score it and say what it would cost.",
    icon: Target,
    prompt: "Assess the opportunity for [initiative]: users affected, metrics it could move, rough effort and the assumptions behind each estimate.",
  },
  {
    id: "prd",
    label: "Product requirements",
    description: "Scope, user stories and acceptance criteria.",
    icon: ClipboardList,
    prompt: "Write product requirements for [initiative]: scope, out of scope, user stories with acceptance criteria and open technical questions.",
  },
  {
    id: "experiment",
    label: "Experiment plan",
    description: "Hypothesis, variants, metrics and sample size.",
    icon: FlaskConical,
    prompt: "Plan an experiment to test [hypothesis]: variants, primary and guardrail metrics, audience, sample size and how long to run it.",
  },
  {
    id: "prototype",
    label: "Figma prototype",
    description: "Turn a brief into flows and screens to test.",
    icon: Frame,
    prompt: "Turn the brief for [initiative] into a Figma prototype plan: key flows, screens for each step and what to test with users.",
  },
  {
    id: "persona",
    label: "User persona",
    description: "Built from research, tickets and analytics.",
    icon: UserRound,
    prompt: "Build a persona for [user segment] from our research, support tickets and analytics: goals, pain points, behaviours and quotes.",
  },
  {
    id: "update",
    label: "Stakeholder update",
    description: "Where things stand, in a format leaders read.",
    icon: Megaphone,
    prompt: "Write a stakeholder update on [initiative]: progress, evidence so far, decisions needed and next steps.",
  },
];

// ── Prompt starters ─────────────────────────────────────────────────────────

export type Starter = { label: string; prompt: string; icon: { source: SourceId } | LucideIcon };

export const START_STARTERS: Starter[] = [
  {
    label: "Explain how a feature works",
    prompt: "Explain how [feature] works today — the business rules behind it, known edge cases, and the decisions that shaped it.",
    icon: Workflow,
  },
  {
    label: "Why did a metric change?",
    prompt: "Why did [metric] change over the last [period]? Connect the change to releases, incidents and customer feedback.",
    icon: TrendingDown,
  },
  {
    label: "Check what's planned in Jira",
    prompt: "What's in progress or planned for [area] in Jira? Group the tickets by epic and flag anything blocked.",
    icon: { source: "jira" },
  },
  {
    label: "Rank top customer pain points",
    prompt: "What are the top customer pain points in [area]? Rank them by how often they come up and their business impact, with evidence for each.",
    icon: ListOrdered,
  },
  {
    label: "Review the latest Figma designs",
    prompt: "Walk me through the latest Figma designs for [feature]. What changed from what's live today, and what's still open?",
    icon: { source: "figma" },
  },
  {
    label: "Map the current user journey",
    prompt: "Map the current user journey for [flow], step by step: what users see, what they do, and where they get stuck.",
    icon: Route,
  },
];

export const CREATE_STARTERS: Starter[] = [
  {
    label: "Turn an insight into an initiative",
    prompt: "Turn the insight [insight] into an initiative: the problem, who it affects, the evidence behind it, and a first success metric.",
    icon: Lightbulb,
  },
  {
    label: "Draft a brief from Jira epics",
    prompt: "Draft an initiative brief from the Jira epic [epic key]: summarize the scope, the open questions and the evidence behind it.",
    icon: { source: "jira" },
  },
  {
    label: "Plan a prototype in Figma",
    prompt: "Plan a Figma prototype for [initiative]: the key flows, the screens for each step, and what to test with users.",
    icon: { source: "figma" },
  },
  {
    label: "Compare two initiative options",
    prompt: "Compare [option A] and [option B]: expected impact, effort, risks and the evidence for each. Recommend one and say why.",
    icon: GitCompareArrows,
  },
  {
    label: "Plan an experiment to validate",
    prompt: "Plan an experiment to validate [initiative]: hypothesis, variants, primary and guardrail metrics, audience, and how long to run it.",
    icon: FlaskConical,
  },
  {
    label: "Write a stakeholder update",
    prompt: "Write a stakeholder update on [initiative]: progress, evidence so far, decisions needed and next steps.",
    icon: Megaphone,
  },
];

export const SEARCH_STARTERS: Starter[] = [
  { label: "Find past decisions on a topic", prompt: "What decisions have we made about [topic], when, and why? Link the tickets, docs or meeting notes behind each one.", icon: History },
  { label: "Summarize recent customer feedback", prompt: "Summarize what customers have said about [feature or area] in the last 3 months, grouped into themes with quotes.", icon: MessagesSquare },
  { label: "Look up a key metric", prompt: "What's the current [metric] for [feature or flow], and how has it trended over the last 6 months?", icon: ChartColumn },
  { label: "Recap past research findings", prompt: "What has past user research told us about [topic]? Summarize the key findings and where each one came from.", icon: BookOpenCheck },
];

// ── Chats ───────────────────────────────────────────────────────────────────

export type ContextRef = { id: string; label: string; kind: "initiative" | "metric" | "signal" | "template" | "agent" | "file" };

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: SourceId[];
  context?: ContextRef[];
  /** A canned reply generated in the browser, not by a model. */
  demo?: boolean;
  /** Work items (./artifactData.ts) this message produced or shared. */
  artifacts?: string[];
};

export type Chat = { id: string; title: string; updated: string; messages: Message[] };

export const INITIAL_CHATS: Chat[] = [
  {
    id: "chat-checkout",
    title: "Checkout wallets brief",
    updated: "2 days ago",
    messages: [
      { id: "m1", role: "user", text: "Why is mobile checkout conversion dropping?", sources: ["mixpanel", "app-store-reviews"] },
      {
        id: "m2",
        role: "assistant",
        text: "Mobile checkout conversion fell from 58% to 52% over six weeks. 34% of mobile users who start checkout leave at the card form — twice the desktop rate. App store reviews this month mention Apple Pay 12 times, and the card form's autofill broke in release 4.18 (JIRA CHK-221, fixed in 4.19).",
        sources: ["mixpanel", "app-store-reviews", "jira"],
        artifacts: ["a-checkout-funnel", "a-chk-221"],
      },
      { id: "m3", role: "user", text: "Draft an initiative brief for adding wallet payments." },
      {
        id: "m4",
        role: "assistant",
        text: "Brief drafted: “Add wallet payments to checkout”. Problem: card entry is the biggest mobile drop-off point. Goal: lift mobile checkout conversion back to 58%. Evidence: funnel data, 12 reviews, 2 lost enterprise renewals citing payment options. Open question: does the payments provider support wallets in all 4 regions?",
        sources: ["mixpanel", "app-store-reviews", "salesforce"],
        artifacts: ["a-wallet-brief"],
      },
      { id: "m5", role: "user", text: "Find the latest checkout designs and turn the brief into a short deck for the leadership sync." },
      {
        id: "m6",
        role: "assistant",
        text: "The latest designs are in “Checkout v3 — wallet buttons”: wallets shown first, with the card form as a fallback. I've turned the brief into a 4-slide readout — problem, what customers say, and the ask.",
        sources: ["figma"],
        artifacts: ["a-wallet-figma", "a-wallet-deck"],
      },
    ],
  },
  {
    id: "chat-persona",
    title: "New admin persona",
    updated: "Last week",
    messages: [
      { id: "m1", role: "user", text: "Build a persona for new workspace admins from the onboarding interviews." },
      {
        id: "m2",
        role: "assistant",
        text: "“Setup-first Sam” — an ops lead who is handed the tool, not the one who bought it. Goal: get the team working within a week. Pain points: unclear first steps, permissions jargon, no way to preview what teammates will see. Quote: “I didn't know what I was supposed to set up first.” Based on 6 interviews and 41 onboarding tickets.",
        sources: ["dovetail", "zendesk"],
        artifacts: ["a-persona-doc", "a-onboarding-figma"],
      },
    ],
  },
  {
    id: "chat-pricing",
    title: "Pricing page questions",
    updated: "Last week",
    messages: [
      { id: "m1", role: "user", text: "What do customers ask most about our plans before buying?", sources: ["intercom"] },
      {
        id: "m2",
        role: "assistant",
        text: "The top three pre-sales questions are: whether seats can be mixed across plans (31%), what happens to data on downgrade (22%), and how prorated upgrades are billed (18%). None of them are answered on the pricing page today.",
        sources: ["intercom", "hubspot"],
        artifacts: ["a-presales-chart", "a-pricing-jira"],
      },
    ],
  },
];
