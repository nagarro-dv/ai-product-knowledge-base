---
name: ds-figma-to-code
description: >-
  Translate Figma design intent into token-bound React components in the DS Starter
  Kit. Use when a Figma source is attached in the DS Accelerator or a handoff
  references Figma nodes.
---

# Figma to code (DS Starter Kit)

## Workflow

1. Use Figma MCP when available to read the referenced node (design context, tokens, structure).
2. Map Figma variables to `--ds-*` CSS custom properties from `packages/tokens`.
3. Implement in `apps/web/src/components/ds/` using existing primitives (Button, Badge, Typography, etc.).
4. Add or extend a showcase in the component registry.

## Constraints

- Neutral naming — no client-specific branding.
- Prefer semantic HTML; ARIA only when native elements are insufficient.
- Match playground patterns from sibling components (CSS file colocated with TSX).

## Output

When finishing an accelerator run, report:

- Figma node reference used
- Token mappings applied
- Files created or changed
