import type { Direction } from "./types";

/**
 * Independent, deterministic check on whether two generated directions are
 * actually a real comparison — the enforcement gate the prompt alone can't
 * provide. The model is asked (in prompts.ts) to name a genuine axis of
 * difference and avoid padding to a fixed count; this module is what
 * actually verifies it did, instead of trusting the prose instruction.
 *
 * Deliberately dependency-free: word-overlap (Jaccard-style) similarity on
 * normalized short text is enough to catch "same idea, different wording" —
 * a full NLP/embedding pipeline would be solving a much harder problem than
 * the one this product actually has.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "with", "for", "this", "that",
  "on", "in", "is", "are", "it", "its", "as", "be", "will", "when", "than",
  "vs", "via", "using", "use", "not", "but", "so", "if", "into", "onto",
  "your", "our", "you", "we", "which", "how", "do", "does", "at", "by",
]);

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * |A∩B| / min(|A|,|B|) rather than Jaccard's union-based ratio. Axis labels
 * and highlight chips are SHORT phrases (2-6 words / 2-4 chips) by design —
 * Jaccard's union penalty means one extra, genuinely distinguishing word
 * ("direct CSS property" vs "CSS custom property") drags the score below
 * any reasonable threshold even though the phrases are near-synonyms. The
 * overlap coefficient asks "how much of the smaller phrase is contained in
 * the other," which is the actually-relevant question for short controlled
 * phrases and is what makes this detector catch this session's own earlier
 * near-duplicate ("Direct CSS hover scale" vs "Shared hover-motion utility
 * class") — see the module-level test fixture for the worked example.
 */
function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function normalizeItems(items: string[]): Set<string> {
  return new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean));
}

/**
 * Catches the failure mode word-overlap alone can't: two axes that don't
 * textually overlap with EACH OTHER at all, but are both implementation
 * language rather than a design difference — e.g. "container-level hit-slop"
 * vs "per-thumb dedicated hit targets". Both are real, non-overlapping
 * engineering approaches; neither describes anything a person would see on
 * screen. The prompt (see prompts.ts) now explicitly bans this category, but
 * a model can still slip into it, so this is the deterministic backstop.
 *
 * Deliberately scoped to the axis field alone, not full prose — axis is
 * asked for as a short, controlled-vocabulary phrase (2-6 words), so a single
 * matched term is a much stronger signal there than it would be inside free
 * text, where an incidental technical word doesn't imply the AXIS itself is
 * implementation-flavored.
 */
const IMPLEMENTATION_AXIS_TERMS = [
  "css", "dom", "architecture", "refactor", "refactoring", "abstraction",
  "state management", "component-level", "container-level", "markup",
  "selector", "hook", "hooks", "prop", "props", "api surface", "codebase",
  "implementation", "same architecture", "hit-slop", "code diff",
  "class name", "html structure", "render", "rendering",
];

function isImplementationFlavoredAxis(axis: string): boolean {
  const normalized = axis.trim().toLowerCase();
  if (!normalized) return false;
  return IMPLEMENTATION_AXIS_TERMS.some((term) => normalized.includes(term));
}

// Axis and highlights are short, structured, and deliberately asked for as
// controlled-vocabulary trade-off labels (see prompts.ts) — they're the
// authoritative signal and get a moderate bar. Full summary/reasoning text
// is long, unconstrained prose that will naturally share domain vocabulary
// ("hover", "scale", "Button") between two GENUINELY different directions
// solving the same feature — word overlap there is corroborating evidence
// at best, never sufficient on its own except at a near-verbatim bar.
const AXIS_OVERLAP_THRESHOLD = 0.5;
const HIGHLIGHT_OVERLAP_THRESHOLD = 0.4;
const TEXT_COROBORATING_THRESHOLD = 0.25;
const TEXT_ALONE_THRESHOLD = 0.85;

export type DuplicatePairResult = {
  directionA: Direction;
  directionB: Direction;
  /** Human-readable, specific reasons this pair was flagged — fed straight into the correction prompt, not a generic message. */
  reasons: string[];
};

function scorePair(a: Direction, b: Direction): DuplicatePairResult | null {
  const reasons: string[] = [];

  const axisA = a.differentiationAxis.trim();
  const axisB = b.differentiationAxis.trim();
  let axisSignal = false;
  if (axisA && axisB) {
    const axisSame = axisA.toLowerCase() === axisB.toLowerCase();
    const axisOverlap = overlapCoefficient(normalizeWords(axisA), normalizeWords(axisB));
    if (axisSame || axisOverlap >= AXIS_OVERLAP_THRESHOLD) {
      axisSignal = true;
      reasons.push(`Both reported near-identical axes of difference: "${axisA}" vs "${axisB}" — that's the same underlying trade-off worded two ways, not two trade-offs.`);
    }
  }

  // The gap word-overlap alone misses: two axes that DON'T overlap with each
  // other at all, but are each implementation language rather than a design
  // difference — e.g. "container-level hit-slop" vs "per-thumb dedicated hit
  // targets". Both real, both non-overlapping, neither visible on screen.
  const implA = isImplementationFlavoredAxis(axisA);
  const implB = isImplementationFlavoredAxis(axisB);
  if (implA || implB) {
    axisSignal = true;
    const offenders = [implA ? `"${axisA}"` : null, implB ? `"${axisB}"` : null].filter(Boolean).join(" and ");
    reasons.push(
      `${offenders} describe${implA && implB ? "" : "s"} an implementation/engineering choice (CSS, DOM, architecture, refactor, abstraction, state management, etc.), not something a user would see or feel on screen — that's never a valid axis for a second direction.`,
    );
  }

  const highlightOverlap = overlapCoefficient(normalizeItems(a.highlights), normalizeItems(b.highlights));
  const highlightSignal = a.highlights.length > 0 && b.highlights.length > 0 && highlightOverlap >= HIGHLIGHT_OVERLAP_THRESHOLD;
  if (highlightSignal) {
    const shared = [...normalizeItems(a.highlights)].filter((item) => normalizeItems(b.highlights).has(item));
    reasons.push(`Their highlighted differences overlapped heavily: ${shared.join(", ") || "most chips shared"}.`);
  }

  const textA = `${a.summary} ${a.reasoning}`.trim();
  const textB = `${b.summary} ${b.reasoning}`.trim();
  const textSimilarity = jaccard(normalizeWords(textA), normalizeWords(textB));
  // Full-sentence text is corroborating evidence, not standalone proof — two
  // genuinely different directions for the same feature request will still
  // share domain vocabulary. Only fires alongside another signal, or alone
  // at a near-verbatim bar.
  const textCorroborates = textSimilarity >= TEXT_COROBORATING_THRESHOLD;
  const textAlone = textSimilarity >= TEXT_ALONE_THRESHOLD;
  if (textAlone) reasons.push("Their descriptions are near-identical, not just similar.");

  const isDuplicate = axisSignal || (highlightSignal && textCorroborates) || textAlone;
  if (!isDuplicate) return null;

  return { directionA: a, directionB: b, reasons };
}

/**
 * Checks every pair in the run (not just the first two — future-proofed for
 * >2 directions) and returns the most similar offending pair, or null when
 * every pair represents a genuinely distinct approach.
 */
export function findNearDuplicatePair(directions: Direction[]): DuplicatePairResult | null {
  let worst: DuplicatePairResult | null = null;
  let worstScore = -1;
  for (let i = 0; i < directions.length; i += 1) {
    for (let j = i + 1; j < directions.length; j += 1) {
      const result = scorePair(directions[i]!, directions[j]!);
      if (result && result.reasons.length > worstScore) {
        worst = result;
        worstScore = result.reasons.length;
      }
    }
  }
  return worst;
}

/**
 * Turns a detected near-duplicate pair into a specific, actionable
 * correction fed back into a regeneration attempt — grounded in what was
 * actually detected, not a generic "try harder" instruction.
 */
export function buildDuplicateCorrectionNote(result: DuplicatePairResult): string {
  return [
    `Your previous attempt's directions "${result.directionA.title}" and "${result.directionB.title}" were not a real comparison:`,
    ...result.reasons.map((reason) => `- ${reason}`),
    "",
    "Remember: a direction is a DESIGN choice — layout, interaction model, hierarchy, navigation, density, workflow, progressive disclosure, emphasis, content presentation — never an implementation choice (CSS architecture, DOM structure, refactoring strategy, internal abstractions, component reuse, state management). Pick whichever implementation is best and use it consistently across every direction; only the design should differ between them.",
    "",
    "The product requires at least 2 genuinely different design directions for every request — never just one. Revise the weaker direction to use a genuinely different DESIGN axis — something a person would perceive by looking at the two live previews for three seconds with no text, not a different way of building the same on-screen result. If the request seemed narrow, think of a structurally different mechanism for solving the same problem (a different control behavior, a different surrounding layout, a different interaction pattern) rather than falling back to one solution.",
  ].join("\n");
}

/**
 * Correction fed back when a generation attempt returned fewer than 2
 * directions — the product's hard minimum. Distinct from
 * buildDuplicateCorrectionNote because there's nothing to compare yet; the
 * model needs to be told it under-delivered, not that its ideas overlapped.
 */
export function buildTooFewDirectionsCorrectionNote(count: number): string {
  return [
    `Your previous attempt returned only ${count} direction${count === 1 ? "" : "s"} — the product requires at least 2, ideally 3, genuinely different design directions for every request. Returning one is never an acceptable outcome, even for a request that looks narrow.`,
    "",
    'Brainstorm a second (and ideally third) structurally different way to solve the same underlying problem — a different mechanism, a different visual treatment, or a different interaction pattern, not a different way of writing the same code. Then build all of them for real, each with its own "differentiationAxis" a person could tell apart from a live preview alone within three seconds, with no text.',
  ].join("\n");
}
