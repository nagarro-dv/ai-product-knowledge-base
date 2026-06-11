# DS-042 — Credit Score clarity

**Ticket:** DS-042  
**Component:** Credit Score (`credit-score`)  
**Status:** Example task for DS Accelerator mock mode and documentation.

## Problem

The Credit Score card shows a large numeric score and arc gauge, but usability tests found that many users fixate on the number without understanding **what the score means** or **what action to take**. The status badge and trend line compete visually with the score instead of explaining it.

Design research asks for alternative hierarchies that:

1. Lead with actionable insight (status + plain-language guidance)
2. Preserve the arc gauge for users who want the numeric detail
3. Stay within `--ds-*` tokens and the existing `DsCreditScore` API

## Constraints

- Do not remove the baseline component — add solution variants alongside it
- WCAG 2.2 AA: contrast, focus, and readable text hierarchy
- Token-only styling (`var(--ds-…)`)

## Success criteria

- At least two comparable solution directions documented under `solutions/`
- Playground can preview the baseline Credit Score showcase
- Implementation files are named distinctly (Solution A/B/C pattern)
