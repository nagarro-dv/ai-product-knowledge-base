/*
 * Which sources to offer as one-click chips under the prompt box, based on
 * what the prompt is about. A plain keyword table — no model — scored per
 * source; the best two are shown, falling back to Jira and Figma when nothing
 * in the prompt points anywhere in particular. Source ids match
 * ../knowledge/sources.ts.
 */

type Rule = { source: string; pattern: RegExp; weight: number; topic: string };

const RULES: Rule[] = [
  // Work tracking
  { source: "jira", pattern: /\b(jira|tickets?|epics?|backlog|sprints?|bugs?|planned|in progress|stor(y|ies)|issues?)\b/i, weight: 3, topic: "planned work" },
  { source: "productboard", pattern: /\b(feature requests?|votes?|prioriti[sz]\w*|roadmap)\b/i, weight: 2, topic: "prioritisation" },
  { source: "github", pattern: /\b(code|repo\w*|pull requests?|implementation|engineering|api|technical)\b/i, weight: 3, topic: "code" },

  // Design and research
  { source: "figma", pattern: /\b(designs?|figma|mock-?ups?|prototypes?|screens?|ui|visuals?|layouts?|components?)\b/i, weight: 3, topic: "designs" },
  { source: "miro", pattern: /\b(flows?|journeys?|diagrams?|maps?|workshops?|brainstorm\w*|whiteboard|process(es)?)\b/i, weight: 3, topic: "flows and diagrams" },
  { source: "dovetail", pattern: /\b(research|interviews?|personas?|usability|pain points?|findings|segments?)\b/i, weight: 3, topic: "research" },
  { source: "maze", pattern: /\b(usability tests?|test with users|validat\w*|experiments?|hypothes[ie]s)\b/i, weight: 2, topic: "testing with users" },

  // Analytics
  { source: "amplitude", pattern: /\b(metrics?|activation|retention|funnels?|conversion|usage|active users|adoption|cohorts?|trend\w*)\b/i, weight: 3, topic: "product metrics" },
  { source: "hotjar", pattern: /\b(friction|heatmaps?|sessions?|recordings?|rage clicks?|drop[- ]?offs?|abandon\w*|hesitat\w*|time on|stuck|struggl\w*)\b/i, weight: 3, topic: "behaviour on the page" },
  { source: "power-bi", pattern: /\b(reports?|dashboards?|revenue|kpis?|business impact|forecast\w*)\b/i, weight: 2, topic: "business reporting" },
  { source: "mixpanel", pattern: /\b(checkout|events?|steps?)\b/i, weight: 1, topic: "funnel events" },
  { source: "google-analytics", pattern: /\b(traffic|page ?views?|pricing page|landing pages?|exit rate|seo)\b/i, weight: 2, topic: "web traffic" },

  // Customer voice
  { source: "zendesk", pattern: /\b(support|complaints?|pain points?|customer feedback|satisfaction|csat)\b/i, weight: 3, topic: "customer support" },
  { source: "intercom", pattern: /\b(customers? (ask|said|say)|conversations?|pre-?sales|feedback)\b/i, weight: 2, topic: "customer conversations" },
  { source: "app-store-reviews", pattern: /\b(reviews?|app store|ratings?|mobile app)\b/i, weight: 2, topic: "app reviews" },

  // Knowledge and discussion
  { source: "confluence", pattern: /\b(docs?|documentation|specs?|decisions?|requirements|business rules|how .{1,40} works)\b/i, weight: 2, topic: "docs and decisions" },
  { source: "slack", pattern: /\b(discussions?|threads?|channels?|escalations?|the team said)\b/i, weight: 1, topic: "team discussions" },
  { source: "notion", pattern: /\b(notes|wiki|competitors?)\b/i, weight: 1, topic: "notes" },

  // Revenue
  { source: "salesforce", pattern: /\b(deals?|sales|enterprise|renewals?|churn\w*|crm|accounts?)\b/i, weight: 2, topic: "sales and accounts" },
  { source: "stripe", pattern: /\b(billing|payments?|invoices?|pricing|upgrades?|subscriptions?|prorat\w*)\b/i, weight: 2, topic: "billing" },
];

const FALLBACK = ["jira", "figma"];

export type SourceSuggestion = { source: string; reason?: string };

/**
 * The `count` sources that best fit `prompt`, skipping ones already attached.
 * Ties keep the table's order, so suggestions don't shuffle while typing.
 */
export function suggestSources(prompt: string, exclude: ReadonlySet<string>, count = 2): SourceSuggestion[] {
  const scores = new Map<string, { score: number; topic: string; order: number }>();
  RULES.forEach((rule, order) => {
    const matches = prompt.match(new RegExp(rule.pattern.source, "gi"));
    if (!matches) return;
    const current = scores.get(rule.source);
    const score = (current?.score ?? 0) + rule.weight * matches.length;
    scores.set(rule.source, { score, topic: current?.topic ?? rule.topic, order: current?.order ?? order });
  });

  const ranked: SourceSuggestion[] = [...scores.entries()]
    .filter(([source]) => !exclude.has(source))
    .sort((a, b) => b[1].score - a[1].score || a[1].order - b[1].order)
    .map(([source, { topic }]) => ({ source, reason: `Suggested for ${topic}` }));

  // Top up with the defaults so there are always `count` chips.
  for (const source of FALLBACK) {
    if (ranked.length >= count) break;
    if (!exclude.has(source) && !ranked.some((s) => s.source === source)) ranked.push({ source });
  }
  return ranked.slice(0, count);
}
