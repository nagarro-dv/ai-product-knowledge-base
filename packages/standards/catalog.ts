import type { Criterion } from "./types";

const ALL_MODES: Criterion["appliesTo"] = ["create", "improve", "qa"];

/**
 * The shipped, DS-agnostic default checklist. On by default; the four
 * accessibility criteria are locked (see the plan's flagged decision —
 * contrast, accessible name, keyboard operability, and target size cannot be
 * silently unchecked before shipping). Everything else, including every
 * judgment criterion, is freely uncheckable.
 *
 * Order intentionally matches verification honesty: automated/assisted
 * ("measured") criteria are never visually indistinguishable from judgment
 * ("assessed, not measured") ones in the UI — see CriterionWithState +
 * QaFinding.verifiedBy.
 */
export const BASELINE_CRITERIA: Criterion[] = [
  // --- Accessibility (4, all locked) ---
  {
    id: "a11y.contrast-text",
    group: "accessibility",
    title: "Text is readable against its background",
    requirement:
      "Body text needs at least a 4.5:1 contrast ratio against its background; large text (18pt+, or 14pt+ bold) needs at least 3:1.",
    verification: "automated",
    severity: "blocker",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: true,
    promptLine: "Every piece of text must stay clearly readable against its background at every size — check contrast, don't guess it.",
    checkId: "a11y-contrast",
    origin: "builtin",
  },
  {
    id: "a11y.accessible-name",
    group: "accessibility",
    title: "Every control has a name",
    requirement:
      "Buttons, links, and inputs must have an accessible name (visible label, aria-label, or aria-labelledby) — an icon alone is not a name.",
    verification: "automated",
    severity: "blocker",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: true,
    promptLine: "Every interactive control needs a real accessible name — a visible label or an aria-label, never an icon alone.",
    checkId: "a11y-accessible-name",
    origin: "builtin",
  },
  {
    id: "a11y.keyboard-operable",
    group: "accessibility",
    title: "Everything works with a keyboard",
    requirement:
      "Every interactive element must be reachable and operable by keyboard alone, with a visible focus state — no mouse-only interaction.",
    verification: "assisted",
    severity: "blocker",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: true,
    promptLine: "Every interaction must also work with a keyboard alone, with a visible focus state — never mouse-only.",
    checkId: "a11y-keyboard-operable",
    origin: "builtin",
  },
  {
    id: "a11y.target-size",
    group: "accessibility",
    title: "Controls are big enough to tap",
    requirement: "Interactive targets should be at least 24×24 CSS pixels, or have enough spacing that mis-taps are unlikely.",
    verification: "automated",
    severity: "major",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: true,
    promptLine: "Keep every tappable control at least 24×24px, or give it enough surrounding space that a mis-tap is unlikely.",
    checkId: "a11y-target-size",
    origin: "builtin",
  },

  // --- Design system (3) ---
  {
    id: "ds.token-usage",
    group: "design-system",
    title: "Uses your tokens, not raw colours",
    requirement: "Colour, spacing, and typography values should come from the connected design system's tokens, not hardcoded hex/px values.",
    verification: "automated",
    severity: "major",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine: "Use the design system's existing tokens for colour, spacing, and typography — never a hardcoded hex or raw pixel value.",
    checkId: "static-token-usage",
    origin: "builtin",
  },
  {
    id: "ds.component-reuse",
    group: "design-system",
    title: "Reuses existing components",
    requirement: "Prefer an existing design-system component over hand-rolled UI wherever one already covers the need.",
    verification: "judgment",
    severity: "minor",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine: "Reuse an existing design-system component instead of building custom UI wherever one already fits.",
    origin: "builtin",
  },
  {
    id: "ds.no-branding",
    group: "design-system",
    title: "No client-specific branding",
    requirement: "The change should stay generic to the design system — no one client's colours, logos, or copy baked in.",
    verification: "judgment",
    severity: "minor",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine: "Keep the result generic to the design system — never introduce one client's branding, colours, or copy.",
    origin: "builtin",
  },

  // --- Responsive (2) ---
  {
    id: "responsive.behavior",
    group: "responsive",
    title: "Behaves sensibly from mobile to desktop",
    requirement: "The layout should wrap, stack, or adapt sensibly across widths — not just visually survive at one size.",
    verification: "judgment",
    severity: "major",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine: "Make sure the result behaves sensibly from mobile width to desktop width — wrap, stack, or adapt, don't just leave it at one size.",
    origin: "builtin",
  },
  {
    id: "responsive.no-horizontal-overflow",
    group: "responsive",
    title: "Never scrolls sideways by accident",
    requirement: "Nothing should force horizontal scrolling on the page at any viewport width the component supports.",
    verification: "automated",
    severity: "major",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine: "Never let the result force horizontal scrolling at any supported width.",
    checkId: "dom-horizontal-overflow",
    origin: "builtin",
  },

  // --- Code health (2) ---
  {
    id: "code.layout-collapse",
    group: "code-health",
    title: "No collapsed layout boxes",
    requirement:
      "A wrapper sized purely by a percentage, with only absolutely-positioned children, must still get an explicit non-percentage width and height as a hard floor — otherwise it can silently collapse to zero.",
    verification: "automated",
    severity: "major",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine:
      "Never size a wrapper purely with a percentage when every one of its own children is taken out of normal flow (absolute/fixed positioning) — give it an explicit non-percentage width and height as a hard floor, or it can silently collapse to zero.",
    checkId: "dom-layout-collapse",
    origin: "builtin",
  },
  {
    id: "code.inline-style-leakage",
    group: "code-health",
    title: "No stray inline styles",
    requirement: "Styling should live in the design system's stylesheet/token layer, not scattered inline style attributes.",
    verification: "automated",
    severity: "minor",
    appliesTo: ALL_MODES,
    defaultEnabled: true,
    locked: false,
    promptLine: "Keep styling in the stylesheet/token layer — avoid scattering raw inline style attributes through the markup.",
    checkId: "static-inline-style",
    origin: "builtin",
  },
];
