---
name: ds-task-solutions-playground
description: >-
  Create and wire task-scoped solution markdown and playground-ready component
  variants for the DS Accelerator. Use when analysis produces Solution A/B/C
  directions that need docs and code artifacts.
---

# Task solutions in the playground

## Task folder layout

```
docs/tasks/<task-slug>/
  brief.md              # problem statement
  solutions/
    solution-a.md         # frontmatter + short lead
    solution-b.md
```

## Solution markdown frontmatter

```yaml
---
id: solution-a
title: Solution A — Short name
status: Proposed | Implemented | Discarded
lead: One sentence for accelerator cards
playgroundImplemented: true | false
---
```

## Implementation

- Map ticket keys to folders (e.g. `DS-042` → `ds-042-credit-score-clarity`).
- Do not delete the original component — add variant files.
- List changed paths in the agent response under `## Changed Files`.
