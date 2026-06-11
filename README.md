# DS Starter Kit

A small monorepo for starting a design system from a proven token model and a set of basic UI components. Use the web playground to inspect tokens, preview components, and tune theme modes before exporting to Figma Token Studio.

## What’s included

| Area | Role |
|------|------|
| `packages/tokens` | Token Studio–style JSON, resolver, and CSS variable build |
| `apps/web` | Local playground — **Foundation**, **Components**, and **Tools** (DS Accelerator) |
| `apps/agent-orchestrator` | Local Cursor SDK server for accelerator agent runs |

Starter components: Button, Icon Button, Badge, Checkbox, Checkbox Group, Link Button, Tooltip, Spinner, Accordion.

## Run the playground

1. Install [Node.js LTS](https://nodejs.org).
2. Open a terminal in this folder (the one that contains this `README.md`).
3. First time only:

   ```bash
   npm install
   ```

4. Start the dev server:

   ```bash
   npm run dev:web
   ```

5. Open the **Local** URL from the terminal (usually `http://localhost:5173`).

## Useful commands

| Command | What it does |
|---------|----------------|
| `npm run tokens:build` | Regenerate `apps/web/src/styles/tokens.generated.css` from token JSON |
| `npm run dev:web` | Start the playground (Foundation, Components, Tools) |
| `npm run dev:agent` | Start the Cursor SDK orchestrator for **DS Accelerator** (port 8787) |
| `npm run build:web` | Production build of the playground |

## DS Accelerator (Tools)

The playground includes **DS Accelerator** under the **Tools** tab (drafting-compass icon). It runs a three-step flow:

1. **Intake** — ticket, Figma link, component, prompt, optional skills  
2. **Analysis** — agent proposes solution directions as selectable cards  
3. **Implementation** — agent edits the repo via the local orchestrator (job + SSE stream)

### Full agent mode setup

1. Copy `apps/agent-orchestrator/.env.example` → `.env` and set `CURSOR_API_KEY`.
2. In one terminal: `npm run dev:agent`
3. In another: `npm run dev:web`
4. Open **Tools → DS Accelerator**. Use **Mock data test** to explore UI without API calls.

Example ticket for mock mode: **DS-042** (Credit Score clarity — see `docs/tasks/ds-042-credit-score-clarity/`).

## Token modes

Set on `<html>` (the playground controls do this for you):

- `data-ds-theme="default"` \| `"nagarro"`
- `data-ds-appearance="Light"` \| `"Dark"`
- `data-ds-density="Compact"` \| `"Standard"` \| `"Comfortable"`

Component CSS uses `var(--ds-…)` custom properties emitted from `packages/tokens`.

## Next steps (planned)

- Real-time editor for **general** tokens (colour, spacing) with live preview
- Export token JSON for import into Figma Token Studio
- Optional project scaffold download
