import type { Initiative, InitiativeStage } from "./data";
import { riceFor } from "./rice";

/*
 * How an initiative fills a Jira Product Discovery idea's fields. Values go
 * by field name; the agent server matches them to the project's own fields
 * and options (productDiscoveryRouter.ts), and anything that doesn't exist
 * there is left out. Defaults follow JPD's standard template: 1–5 ratings
 * for Impact, Reach, Effort and Value, a 0–100 Confidence slider, and the
 * template's Theme and Roadmap options.
 */

export type JpdFieldValue = {
  name: string;
  value: string | number | string[];
  /** How it reads in the send dialog. */
  kind: "rating" | "percent" | "text";
};

/** Initiative areas → the JPD template's themes. */
const THEMES: Record<string, string> = {
  Monetization: "Increase revenue",
  Conversion: "Increase revenue",
  Enterprise: "Win enterprise customers",
  "Customer trust": "Delight users",
  Retention: "Delight users",
  Activation: "Delight users",
};

/** Pipeline stage → roadmap column: work in progress is Now, what's being shaped is Next, ideas are Later. */
const ROADMAP: Record<InitiativeStage, string> = {
  proposed: "Later",
  exploring: "Next",
  brief: "Next",
  prototype: "Now",
  validating: "Now",
};

/** RICE's impact scale (3 massive … 0.25 minimal) → 1–5. */
const IMPACT_RATING: Record<Initiative["rice"]["impact"], number> = { 3: 5, 2: 4, 1: 3, 0.5: 2, 0.25: 1 };

/** A value → 1–5 by thresholds: below the first is 1, at or above the last is 5. */
const rate = (value: number, thresholds: [number, number, number, number]) => 1 + thresholds.filter((t) => value >= t).length;

export function jpdFieldsFor(initiative: Initiative): JpdFieldValue[] {
  const rice = riceFor(initiative);
  const fields: JpdFieldValue[] = [];
  const theme = THEMES[initiative.theme];
  if (theme) fields.push({ name: "Theme", value: [theme], kind: "text" });
  fields.push(
    { name: "Roadmap", value: ROADMAP[initiative.stage], kind: "text" },
    { name: "Impact", value: IMPACT_RATING[initiative.rice.impact], kind: "rating" },
    // People or accounts a quarter: <500, 500+, 1,000+, 2,500+, 5,000+.
    { name: "Reach", value: rate(rice.reach, [500, 1000, 2500, 5000]), kind: "rating" },
    // Person-weeks: ≤1, 2, 3–4, 5–8, more than 8.
    { name: "Effort", value: rate(rice.effort, [1.5, 2.5, 4.5, 8.5]), kind: "rating" },
    { name: "Confidence", value: rice.confidence.percent, kind: "percent" },
    // The 0–100 impact score in fifths.
    { name: "Value", value: Math.max(1, Math.ceil(rice.impactScore / 20)), kind: "rating" },
    { name: "Idea short description", value: initiative.summary, kind: "text" },
    { name: "Labels", value: ["ai-knowledge-base"], kind: "text" },
  );
  return fields;
}
