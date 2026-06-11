---
name: ds-component-handoff
description: >-
  Structured handoff for implementing or extending a design-system component from
  a problem brief in the DS Starter Kit. Use when the DS Accelerator or a ticket
  asks for component changes with token-bound React/CSS.
---

# DS component handoff

Use when implementing a component change in `apps/web/src/components/ds/`.

## Rules

1. Read the target showcase and component files before editing.
2. Use `var(--ds-*)` tokens only — no hard-coded brand colours.
3. Preserve the baseline component; add solution variants as separate files when exploring alternatives.
4. Update the matching showcase if the playground should preview new variants.
5. Run `npm run build:web` and fix TypeScript errors before finishing.

## File naming for accelerator solutions

- `ComponentNameSolutionA.tsx` + `ComponentNameSolutionA.css`
- Document each solution under `docs/tasks/<task-folder>/solutions/`

## Accessibility

Follow `.cursor/rules/accessibility-wcag-eaa.mdc` — flag blocking issues to the user.
