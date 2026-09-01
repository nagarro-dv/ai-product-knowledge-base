import type { AcceleratorMode } from "@ds-starter/standards";
import type { ModeConfig } from "./types";

/**
 * The single source of truth for what each mode asks the user for and what
 * it does with it. The mode tab bar, the slot-based intake, and the run
 * phase list (GenerationProgress / AcceleratorTabs) all read from here —
 * there is deliberately nowhere else a mode's shape is hardcoded.
 */
export const MODE_CONFIGS: Record<AcceleratorMode, ModeConfig> = {
  improve: {
    mode: "improve",
    title: "Improve Component",
    provides: "The component + what should change",
    does: "Reads the real source, explains its plan for you to approve, then builds 2–3 working alternatives in a sandbox",
    gets: "Live previews to compare, then one click to apply to a branch",
    disabled: false,
    slots: [
      {
        id: "subject",
        label: "Component to change",
        hint: "Pick it from your Storybook",
        role: "subject",
        kinds: ["component"],
        max: 1,
        required: true,
        allowFreeText: false,
      },
      {
        id: "requirement",
        label: "What should change",
        hint: "Change something that already exists — describe what should change, or attach a ticket",
        role: "requirement",
        kinds: ["ticket", "note"],
        max: "many",
        required: true,
        allowFreeText: true,
      },
      {
        id: "reference",
        label: "References",
        hint: "Designs or components to draw from — not copied verbatim",
        role: "reference",
        kinds: ["figma", "component", "doc"],
        max: "many",
        required: false,
        allowFreeText: false,
      },
    ],
    phases: [
      { id: "analyze", label: "Analyzing" },
      { id: "checkpoint", label: "Your approval" },
      { id: "build", label: "Build" },
      { id: "compare", label: "Compare" },
    ],
  },
  qa: {
    mode: "qa",
    title: "Test Component",
    provides: "The component + which criteria matter",
    does: "Mounts it in a sandbox, runs automated checks, judges the rest",
    gets: "A pass/fail report with evidence, and one click to fix what failed",
    disabled: false,
    slots: [
      {
        id: "subject",
        label: "Component to check",
        hint: "Pick it from your Storybook",
        role: "subject",
        kinds: ["component"],
        max: 1,
        required: true,
        allowFreeText: false,
      },
      {
        id: "requirement",
        label: "What it was supposed to do",
        hint: "Check it meets the bar — describe what to check, or attach the ticket or spec",
        role: "requirement",
        kinds: ["ticket", "doc", "note"],
        max: "many",
        required: false,
        allowFreeText: true,
      },
    ],
    phases: [
      { id: "check", label: "Checking" },
      { id: "report", label: "Report" },
    ],
  },
  create: {
    mode: "create",
    title: "Create Component",
    provides: "Requirements + references",
    does: "Designed, not yet built — see the plan's open questions on file placement and story generation.",
    gets: "—",
    disabled: false,
    slots: [
      {
        id: "requirement",
        label: "Requirements",
        hint: "Build something new — describe what the component needs to do",
        role: "requirement",
        kinds: ["ticket", "doc", "note"],
        max: "many",
        required: true,
        allowFreeText: true,
      },
      {
        id: "reference",
        label: "References",
        hint: "Designs or similar components to draw from",
        role: "reference",
        kinds: ["figma", "component", "doc"],
        max: "many",
        required: false,
        allowFreeText: false,
      },
    ],
    phases: [
      { id: "analyze", label: "Analyzing" },
      { id: "checkpoint", label: "Your approval" },
      { id: "build", label: "Build" },
      { id: "compare", label: "Compare" },
      { id: "place", label: "Place" },
    ],
  },
};

export function modeConfig(mode: AcceleratorMode): ModeConfig {
  return MODE_CONFIGS[mode];
}
