import { METRICS, SIGNALS, TRENDING_TOPICS, type Initiative } from "./data";

/*
 * Prompts with fill-in parts. Starter and template prompts mark the parts the
 * user should replace with [brackets]; in the prompt box each becomes a chip
 * ("slot") that opens a list of the matching things the knowledge base
 * already knows about, so nobody has to remember and type exact names.
 */

export type PromptSegment =
  | { type: "text"; text: string }
  | {
      type: "slot";
      id: string;
      /** What goes here, e.g. "feature" or "option A" — shown until filled. */
      label: string;
      value?: string;
      /** The list group the value came from (e.g. "Flows"); unset for typed-in values. */
      group?: string;
      /** Extra detail about the value, e.g. a metric's current reading. */
      hint?: string;
    };

let slotId = 0;

/** "Explain how [feature] works" → text, slot("feature"), text. */
export function parsePrompt(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const pattern = /\[([^\]]+)\]/g;
  let last = 0;
  for (const match of prompt.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", text: prompt.slice(last, index) });
    segments.push({ type: "slot", id: `slot-${slotId++}`, label: match[1]! });
    last = index + match[0].length;
  }
  if (last < prompt.length) segments.push({ type: "text", text: prompt.slice(last) });
  return segments;
}

/** Plain text to send: filled slots become their value, empty ones stay bracketed. */
export function promptText(segments: PromptSegment[]): string {
  return segments.map((s) => (s.type === "text" ? s.text : (s.value ?? `[${s.label}]`))).join("");
}

/** What each list group is, in the singular, for the chip's tooltip. */
const GROUP_NAMES: Record<string, string> = {
  Features: "Feature",
  "Product areas": "Product area",
  Flows: "Flow",
  Topics: "Topic",
  "Tracked metrics": "Tracked metric",
  "Time periods": "Time period",
  Segments: "User segment",
  Insights: "Insight",
  Initiatives: "Initiative",
  "Jira epics": "Jira epic",
  "Suggested from insights": "Hypothesis",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The tooltip for a slot chip: what kind of thing its value is, plus any
 * detail — "Tracked metric · 3.9 / 5 · −0.5", "Initiative (option A)".
 * Empty chips say what to pick.
 */
export function slotTooltip(slot: { label: string; value?: string; group?: string; hint?: string }): string {
  if (!slot.value) return `Choose a ${slot.label}`;
  const kind =
    slot.group === CREATED_GROUP
      ? `${slot.label} · added by your team`
      : slot.group
        ? (GROUP_NAMES[slot.group] ?? slot.group)
        : `Your own ${slot.label}`;
  // "Initiative (option A)" — typed-in values already say "Your own option A".
  const role = slot.group && /^option /i.test(slot.label) ? ` (${slot.label})` : "";
  return [`${capitalize(kind)}${role}`, slot.hint].filter(Boolean).join(" · ");
}

export const hasEmptySlots = (segments: PromptSegment[]) => segments.some((s) => s.type === "slot" && !s.value);

// ── What each slot offers ───────────────────────────────────────────────────

export type SlotOption = {
  value: string;
  group: string;
  hint?: string;
  /** For metrics: the recent change, and whether it's good ("up") or bad ("down") news. */
  change?: { delta: string; trend: "up" | "down" };
};

const FEATURES = [
  "Plan upgrades",
  "Checkout",
  "Invoices",
  "Saved searches",
  "SSO setup",
  "Onboarding checklist",
  "Team invites",
  "Pricing page",
  "Search filters",
  "Notifications",
];
const AREAS = ["Billing", "Checkout", "Onboarding", "Pricing", "Search", "Enterprise admin", "Mobile app"];
const FLOWS = ["Sign-up", "Checkout", "Plan upgrade", "Onboarding", "Invite teammates", "SSO setup", "Downgrade"];
const TOPICS = [...TRENDING_TOPICS, "Prorated charges", "Permissions", "Mobile performance"];
const PERIODS = ["7 days", "30 days", "quarter", "6 months", "year"];
const SEGMENTS = ["New workspace admins", "Power users", "Enterprise trials", "Mobile shoppers", "Self-serve teams", "Churned accounts"];
const EPICS = [
  { value: "BILL-400", hint: "Billing clarity" },
  { value: "CHK-200", hint: "Checkout v3" },
  { value: "ONB-120", hint: "Onboarding revamp" },
  { value: "SRCH-88", hint: "Saved searches" },
  { value: "ENT-51", hint: "Self-serve SSO" },
];
const HYPOTHESES = [
  "Explaining prorated charges at upgrade will lift completion",
  "A first-week checklist will raise activation",
  "Showing wallets first will lift mobile conversion",
  "Saved searches will cut repeat filtering for power users",
];

const list = (values: string[], group: string): SlotOption[] => values.map((value) => ({ value, group }));

/**
 * The choices for a slot, grouped. Unknown labels return none — the picker
 * then just offers to use whatever the user types.
 */
// ── Values people create ────────────────────────────────────────────────────

/** The list group for values someone created from a chip's menu. */
export const CREATED_GROUP = "Added by your team";

const CREATED_KEY = "kb2:created-slot-values";

/**
 * Chips that pick from the same list share created values: an initiative
 * created for "option A" is offered for "option B" and "initiative" too.
 */
function categoryOf(label: string): string {
  const key = label.toLowerCase();
  return key === "option a" || key === "option b" || key === "idea" ? "initiative" : key;
}

/*
 * Created values live in this browser's storage — the prototype has no
 * server, so colleagues won't see them yet. Swap these two functions for API
 * calls to make the lists shared.
 */
function readCreated(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(CREATED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

export function addCreatedValue(label: string, value: string): void {
  const all = readCreated();
  const category = categoryOf(label);
  const list = all[category] ?? [];
  if (list.some((v) => v.toLowerCase() === value.toLowerCase())) return;
  all[category] = [...list, value];
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked — the value still fills the chip, it just isn't remembered.
  }
}

/** Everything a slot offers: the built-in list, then what people have created. */
export function slotOptions(label: string, initiatives: Initiative[]): SlotOption[] {
  const created = (readCreated()[categoryOf(label)] ?? []).map((value) => ({ value, group: CREATED_GROUP }));
  return [...builtInOptions(label, initiatives), ...created];
}

function builtInOptions(label: string, initiatives: Initiative[]): SlotOption[] {
  const initiativeOptions = initiatives.map((i) => ({ value: i.title, group: "Initiatives", hint: i.theme }));
  const insightOptions = SIGNALS.map((s) => ({ value: s.title, group: "Insights", hint: s.category }));
  switch (label.toLowerCase()) {
    case "feature":
      return list(FEATURES, "Features");
    case "area":
      return list(AREAS, "Product areas");
    case "flow":
      return list(FLOWS, "Flows");
    case "feature or area":
      return [...list(FEATURES, "Features"), ...list(AREAS, "Product areas")];
    case "feature or flow":
      return [...list(FEATURES, "Features"), ...list(FLOWS, "Flows")];
    case "topic":
      return list(TOPICS, "Topics");
    case "metric":
      return METRICS.map((m) => ({ value: m.label, group: "Tracked metrics", hint: m.value, change: { delta: m.delta, trend: m.trend } }));
    case "period":
      return list(PERIODS, "Time periods");
    case "user segment":
      return list(SEGMENTS, "Segments");
    case "insight":
      return insightOptions;
    case "problem or opportunity":
      return [...insightOptions, ...initiativeOptions];
    case "initiative":
    case "option a":
    case "option b":
    case "idea":
      return initiativeOptions;
    case "epic key":
      return EPICS.map((e) => ({ ...e, group: "Jira epics" }));
    case "hypothesis":
      return list(HYPOTHESES, "Suggested from insights");
    default:
      return [];
  }
}
