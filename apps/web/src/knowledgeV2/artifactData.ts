/*
 * Work items produced alongside a conversation — briefs, decks, charts, and
 * links out to Figma and Jira. Documents and decks live inside the knowledge
 * base and can be edited in the side drawer; Figma and Jira items are links
 * with a preview. All fixture data, like the rest of v2.
 */

export type DocBlock = { id: string; type: "h2" | "p" | "li"; text: string };
export type Slide = { id: string; title: string; bullets: string[] };

type Base = { id: string; chatId: string; title: string; updated: string };

export type DocArtifact = Base & { kind: "doc"; blocks: DocBlock[] };
export type DeckArtifact = Base & { kind: "deck"; slides: Slide[] };
export type ChartArtifact = Base & {
  kind: "chart";
  caption: string;
  unit: string;
  bars: { label: string; value: number }[];
};
export type FigmaArtifact = Base & {
  kind: "figma";
  url: string;
  frames: string[];
  /** Accent colour for the mock screens in the preview. */
  accent: string;
};
export type JiraArtifact = Base & {
  kind: "jira";
  url: string;
  key: string;
  status: "To do" | "In progress" | "Done";
  issueType: "Bug" | "Story" | "Epic";
  assignee: string;
  summary: string;
};

export type Artifact = DocArtifact | DeckArtifact | ChartArtifact | FigmaArtifact | JiraArtifact;

/** Internal items open in the editor; links open a preview with a way out. */
export function isExternal(artifact: Artifact): artifact is FigmaArtifact | JiraArtifact {
  return artifact.kind === "figma" || artifact.kind === "jira";
}

export const KIND_LABELS: Record<Artifact["kind"], string> = {
  doc: "Document",
  deck: "Presentation",
  chart: "Chart",
  figma: "Figma file",
  jira: "Jira issue",
};

// Demo links point at the products' own sites, not at real files.
const FIGMA_URL = "https://www.figma.com/";
const JIRA_URL = "https://www.atlassian.com/software/jira";

let blockId = 0;
const b = (type: DocBlock["type"], text: string): DocBlock => ({ id: `b${blockId++}`, type, text });

export const INITIAL_ARTIFACTS: Artifact[] = [
  // ── Checkout wallets brief ──
  {
    id: "a-checkout-funnel",
    chatId: "chat-checkout",
    kind: "chart",
    title: "Mobile checkout funnel",
    updated: "2 days ago",
    caption: "Share of mobile sessions reaching each checkout step, last 30 days.",
    unit: "%",
    bars: [
      { label: "Cart", value: 100 },
      { label: "Shipping", value: 81 },
      { label: "Card form", value: 74 },
      { label: "Review", value: 49 },
      { label: "Paid", value: 52 },
    ],
  },
  {
    id: "a-chk-221",
    chatId: "chat-checkout",
    kind: "jira",
    title: "Card form autofill broken on iOS",
    updated: "Fixed in 4.19",
    url: JIRA_URL,
    key: "CHK-221",
    status: "Done",
    issueType: "Bug",
    assignee: "Priya Natarajan",
    summary:
      "Since release 4.18 the card number field ignores iOS autofill, so users have to type card details by hand. Fixed in 4.19 by restoring the autocomplete attributes.",
  },
  {
    id: "a-wallet-brief",
    chatId: "chat-checkout",
    kind: "doc",
    title: "Add wallet payments to checkout",
    updated: "2 days ago",
    blocks: [
      b("h2", "Problem"),
      b("p", "Card entry is the biggest drop-off point in mobile checkout: 34% of mobile users who reach the card form leave, twice the desktop rate."),
      b("h2", "Who it affects"),
      b("p", "Mobile shoppers on iOS and Android — 62% of checkout sessions last quarter."),
      b("h2", "Evidence"),
      b("li", "Funnel data: mobile conversion fell from 58% to 52% over six weeks (Mixpanel)."),
      b("li", "12 App Store reviews this month ask for Apple Pay."),
      b("li", "2 enterprise renewals lost, both citing payment options (Salesforce)."),
      b("h2", "Goal"),
      b("p", "Lift mobile checkout conversion back to 58% within one quarter of launch."),
      b("h2", "Open questions"),
      b("li", "Does our payments provider support wallets in all 4 regions?"),
      b("li", "Do we show wallets first, or alongside the card form?"),
    ],
  },
  {
    id: "a-wallet-figma",
    chatId: "chat-checkout",
    kind: "figma",
    title: "Checkout v3 — wallet buttons",
    updated: "Edited yesterday",
    url: FIGMA_URL,
    frames: ["Cart", "Payment — wallets first", "Payment — card fallback", "Confirmation"],
    accent: "#6d3fe8",
  },
  {
    id: "a-wallet-deck",
    chatId: "chat-checkout",
    kind: "deck",
    title: "Wallet payments — leadership readout",
    updated: "Yesterday",
    slides: [
      { id: "s1", title: "Wallet payments in checkout", bullets: ["Leadership sync", "Proposal and evidence"] },
      { id: "s2", title: "The problem", bullets: ["Mobile conversion down 6 points in six weeks", "34% leave at the card form"] },
      { id: "s3", title: "What customers say", bullets: ["12 reviews ask for Apple Pay", "2 renewals lost over payment options"] },
      { id: "s4", title: "The ask", bullets: ["One squad for one quarter", "Target: 58% mobile conversion"] },
    ],
  },

  // ── New admin persona ──
  {
    id: "a-persona-doc",
    chatId: "chat-persona",
    kind: "doc",
    title: "Persona — Setup-first Sam",
    updated: "Last week",
    blocks: [
      b("h2", "Who they are"),
      b("p", "An operations lead who is handed the tool rather than the one who bought it. Measured on how fast the team is up and running."),
      b("h2", "Goals"),
      b("li", "Get the team working within a week."),
      b("li", "Avoid permission mistakes that need support to undo."),
      b("h2", "Pain points"),
      b("li", "Unclear first steps after sign-up."),
      b("li", "Permissions jargon."),
      b("li", "No way to preview what teammates will see."),
      b("h2", "In their words"),
      b("p", "“I didn't know what I was supposed to set up first.”"),
    ],
  },
  {
    id: "a-onboarding-figma",
    chatId: "chat-persona",
    kind: "figma",
    title: "Onboarding checklist explorations",
    updated: "Edited 4 days ago",
    url: FIGMA_URL,
    frames: ["Welcome", "Checklist — collapsed", "Checklist — expanded", "Invite teammates"],
    accent: "#0f9d6b",
  },

  // ── Pricing page questions ──
  {
    id: "a-presales-chart",
    chatId: "chat-pricing",
    kind: "chart",
    title: "Top pre-sales questions",
    updated: "Last week",
    caption: "Share of pre-sales Intercom conversations by topic, last 90 days.",
    unit: "%",
    bars: [
      { label: "Mixed seats", value: 31 },
      { label: "Downgrades", value: 22 },
      { label: "Prorating", value: 18 },
      { label: "SSO", value: 11 },
      { label: "Other", value: 18 },
    ],
  },
  {
    id: "a-pricing-jira",
    chatId: "chat-pricing",
    kind: "jira",
    title: "Explain prorated upgrades on the pricing page",
    updated: "Updated 3 days ago",
    url: JIRA_URL,
    key: "BILL-412",
    status: "To do",
    issueType: "Story",
    assignee: "Unassigned",
    summary: "Add a short explainer and an example invoice to the pricing page so customers understand mid-cycle upgrade charges before buying.",
  },
];

/** A starter document from a template, for replies to template prompts. */
export function draftFromTemplate(chatId: string, title: string, headings: string[]): DocArtifact {
  return {
    id: `a-${Date.now().toString(36)}`,
    chatId,
    kind: "doc",
    title,
    updated: "Just now",
    blocks: headings.flatMap((heading) => [b("h2", heading), b("p", "")]),
  };
}

export const TEMPLATE_OUTLINES: Record<string, string[]> = {
  brief: ["Problem", "Who it affects", "Evidence", "Goal", "Open questions"],
  opportunity: ["Opportunity", "Users affected", "Metrics it could move", "Effort", "Assumptions"],
  prd: ["Scope", "Out of scope", "User stories", "Acceptance criteria", "Open technical questions"],
  experiment: ["Hypothesis", "Variants", "Metrics", "Audience and sample size", "Duration"],
  prototype: ["Flows", "Screens", "What to test"],
  persona: ["Who they are", "Goals", "Pain points", "In their words"],
  update: ["Where things stand", "Evidence so far", "Decisions needed", "Next steps"],
};
