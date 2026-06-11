/** Neutral skills inspired by FSB accelerator workflows — not client-specific. */
export type AcceleratorSkill = {
  id: string;
  label: string;
  path: string;
  description: string;
};

export const ACCELERATOR_SKILLS: readonly AcceleratorSkill[] = [
  {
    id: "ds-component-handoff",
    label: "DS component handoff",
    path: ".cursor/skills/ds-component-handoff/SKILL.md",
    description: "Structured spec for implementing or extending a DS component from a problem brief.",
  },
  {
    id: "ds-task-solutions-playground",
    label: "Task solutions in playground",
    path: ".cursor/skills/ds-task-solutions-playground/SKILL.md",
    description: "Create solution markdown and playground-ready variants under docs/tasks/.",
  },
  {
    id: "ds-figma-to-code",
    label: "Figma to code",
    path: ".cursor/skills/ds-figma-to-code/SKILL.md",
    description: "Translate Figma intent into token-bound React components in this repo.",
  },
  {
    id: "accessibility-wcag-eaa",
    label: "Accessibility (WCAG 2.2 + EAA)",
    path: ".cursor/rules/accessibility-wcag-eaa.mdc",
    description: "Mandatory accessibility audit for all UI changes.",
  },
] as const;

export function getSkillLabels(selectedIds: string[]): string[] {
  return ACCELERATOR_SKILLS.filter((skill) => selectedIds.includes(skill.id)).map((skill) => skill.label);
}
