import { sourceById } from "../knowledge/sources";
import { keyResult, type Initiative } from "./data";

/*
 * RICE: Reach × Impact × Confidence ÷ Effort — the scoring Jira Product
 * Discovery uses, so a score here means the same thing once an initiative is
 * sent there. Reach, impact and effort are estimates with their reasoning
 * (data.ts); confidence is never typed in — it's derived from the evidence
 * behind the initiative, using RICE's standard tiers.
 */

/** Sources that give hard numbers (usage, volumes, revenue). */
const DATA_SOURCES = new Set([
  "amplitude",
  "mixpanel",
  "hotjar",
  "google-analytics",
  "fullstory",
  "pendo",
  "salesforce",
  "hubspot",
  "stripe",
  "zendesk",
  "productboard",
  "power-bi",
  "snowflake",
]);

/** Sources that give reasons (what people say and do in research). */
const RESEARCH_SOURCES = new Set([
  "dovetail",
  "maze",
  "usertesting",
  "app-store-reviews",
  "intercom",
  "typeform",
  "surveymonkey",
  "qualtrics",
  "figma",
  "granola",
  "slack",
]);

export type ConfidenceLevel = { label: "High" | "Medium" | "Low"; percent: 100 | 80 | 50; reason: string };

/**
 * High (100%): four or more sources, with both hard data and research.
 * Medium (80%): two or more sources.
 * Low (50%): a single source.
 */
export function confidenceFor(initiative: Initiative): ConfidenceLevel {
  const sources = [...new Set(initiative.evidence.map((e) => e.source))];
  const hasData = sources.some((s) => DATA_SOURCES.has(s));
  const hasResearch = sources.some((s) => RESEARCH_SOURCES.has(s));
  const kinds = [hasData && "data", hasResearch && "research"].filter(Boolean).join(" and ");
  const count = `${sources.length} source${sources.length === 1 ? "" : "s"}`;
  if (sources.length >= 4 && hasData && hasResearch) {
    return { label: "High", percent: 100, reason: `${count}, with both data and research` };
  }
  if (sources.length >= 2) {
    const missing = !hasData ? "no hard data yet" : !hasResearch ? "no research yet" : "fewer than 4 sources";
    return { label: "Medium", percent: 80, reason: `${count}${kinds ? ` (${kinds})` : ""} — ${missing}` };
  }
  return { label: "Low", percent: 50, reason: `Only ${count}` };
}

export const IMPACT_LABELS: Record<Initiative["rice"]["impact"], string> = {
  3: "Massive",
  2: "High",
  1: "Medium",
  0.5: "Low",
  0.25: "Minimal",
};

export type RiceBreakdown = {
  score: number;
  /** 0–100, see impactScore. */
  impactScore: number;
  reach: number;
  impact: number;
  confidence: ConfidenceLevel;
  effort: number;
};

export function riceFor(initiative: Initiative): RiceBreakdown {
  const { reach, impact, effort } = initiative.rice;
  const confidence = confidenceFor(initiative);
  const score = Math.round((reach * impact * (confidence.percent / 100)) / effort);
  return { score, impactScore: impactScore(score), reach, impact, confidence, effort };
}

/**
 * RICE has no upper limit, so for the 0–100 "impact score" shown on cards
 * (and sent to Jira Product Discovery) it's eased onto a fixed scale:
 * RICE ÷ (RICE + 250) × 100. A RICE of 250 scores 50; higher RICE gets ever
 * closer to 100 without reaching it. Fixed, so a new idea doesn't change
 * anyone else's score, and it keeps exactly the same order as RICE.
 */
export const RICE_MIDPOINT = 250;

export function impactScore(rice: number): number {
  return Math.round((100 * rice) / (rice + RICE_MIDPOINT));
}

/** Jira Product Discovery's colour bands for impact scores: green 80+, yellow 50–79, grey below 50. */
export type ImpactBand = "high" | "medium" | "low";

export function impactBand(score: number): ImpactBand {
  return score >= 80 ? "high" : score >= 50 ? "medium" : "low";
}

const fmt = (n: number) => n.toLocaleString("en-GB");

/** "2,300 × 2 × 100% ÷ 6 = 767" */
export function riceEquation(initiative: Initiative): string {
  const r = riceFor(initiative);
  return `${fmt(r.reach)} × ${r.impact} × ${r.confidence.percent}% ÷ ${r.effort} = ${fmt(r.score)}`;
}

/** The full reasoning as plain text, for sharing and for Jira Product Discovery. */
export function riceSummary(initiative: Initiative): string {
  const r = riceFor(initiative);
  const kr = keyResult(initiative.rice.okr);
  return [
    `Impact score: ${r.impactScore} / 100  (from RICE ${fmt(r.score)}: ${fmt(r.score)} ÷ (${fmt(r.score)} + ${RICE_MIDPOINT}) × 100)`,
    `RICE score: ${fmt(r.score)}  (${riceEquation(initiative)})`,
    `• Reach: ${fmt(r.reach)} ${initiative.rice.reachUnit} — ${initiative.rice.reachNote}`,
    `• Impact: ${r.impact} (${IMPACT_LABELS[initiative.rice.impact]})${kr ? ` — ${kr.id}: ${kr.text}` : ""}. ${initiative.rice.impactNote}`,
    `• Confidence: ${r.confidence.percent}% (${r.confidence.label}) — ${r.confidence.reason}`,
    `• Effort: ${r.effort} person-weeks — ${initiative.rice.effortNote}`,
    "",
    "Evidence:",
    ...initiative.evidence.map((e) => `• ${sourceById(e.source).label}: ${e.summary}`),
  ].join("\n");
}
