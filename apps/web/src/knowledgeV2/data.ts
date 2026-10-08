import {
  BookOpenCheck,
  ChartColumn,
  ClipboardList,
  FileText,
  FlaskConical,
  Frame,
  History,
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
  /** 0–100: how strongly the evidence supports it. */
  confidence: number;
  evidence: Evidence[];
  updated: string;
};

export const INITIAL_INITIATIVES: Initiative[] = [
  {
    id: "plan-upgrades",
    title: "Simplify mid-cycle plan upgrades",
    summary:
      "Upgrading mid-cycle shows a prorated charge most customers don't understand. Billing tickets about it are up 63% this month and upgrade completion fell 9 points.",
    stage: "proposed",
    origin: "Roadmap alignment agent",
    theme: "Monetization",
    confidence: 82,
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
    confidence: 74,
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
    confidence: 61,
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
    confidence: 68,
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
    confidence: 77,
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
    confidence: 70,
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
    confidence: 80,
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
  tone: "warning" | "positive" | "info";
  title: string;
  body: string;
  sources: SourceId[];
  /** The initiative it led to, if the agents proposed one. */
  initiativeId?: string;
  found: string;
};

export const SIGNALS: Signal[] = [
  {
    id: "voc-drop",
    tone: "warning",
    title: "Voice of customer is dropping",
    body: "Negative sentiment about invoices rose 63% in 30 days. “I can't tell what I'm being charged for” is the most repeated phrase.",
    sources: ["zendesk", "intercom", "app-store-reviews"],
    initiativeId: "support-quality",
    found: "Found 2h ago",
  },
  {
    id: "invite-retention",
    tone: "positive",
    title: "Team invites predict retention",
    body: "Accounts that invite a teammate in their first week retain 2.3× better — the strongest predictor found so far.",
    sources: ["amplitude", "dovetail"],
    initiativeId: "onboarding-checklist",
    found: "Found yesterday",
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
];

export const TRENDING_TOPICS = ["Invoices", "Plan upgrades", "SSO", "Mobile checkout", "Onboarding"];

export const KNOWLEDGE_TOTALS = [
  { label: "Sources connected", value: "7" },
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

export const SEARCH_STARTERS: Starter[] = [
  { label: "Find past decisions on a topic", prompt: "What decisions have we made about [topic], when, and why? Link the tickets, docs or meeting notes behind each one.", icon: History },
  { label: "Summarize recent customer feedback", prompt: "Summarize what customers have said about [feature or area] in the last 3 months, grouped into themes with quotes.", icon: MessagesSquare },
  { label: "Look up a key metric", prompt: "What's the current [metric] for [feature or flow], and how has it trended over the last 6 months?", icon: ChartColumn },
  { label: "Recap past research findings", prompt: "What has past user research told us about [topic]? Summarize the key findings and where each one came from.", icon: BookOpenCheck },
];

// ── Chats ───────────────────────────────────────────────────────────────────

export type ContextRef = { id: string; label: string; kind: "initiative" | "metric" | "signal" | "template" | "agent" };

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: SourceId[];
  context?: ContextRef[];
  /** A canned reply generated in the browser, not by a model. */
  demo?: boolean;
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
      },
      { id: "m3", role: "user", text: "Draft an initiative brief for adding wallet payments." },
      {
        id: "m4",
        role: "assistant",
        text: "Brief drafted: “Add wallet payments to checkout”. Problem: card entry is the biggest mobile drop-off point. Goal: lift mobile checkout conversion back to 58%. Evidence: funnel data, 12 reviews, 2 lost enterprise renewals citing payment options. Open question: does the payments provider support wallets in all 4 regions?",
        sources: ["mixpanel", "app-store-reviews", "salesforce"],
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
      },
    ],
  },
];
