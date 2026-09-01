# DS Accelerator — Demo Mode & Current State

**Audience:** anyone who needs to demo the DS Accelerator without a real Storybook, Jira, GitHub, or AI provider credential — or anyone picking up frontend work on the Compare Directions / QA Report screens after this session's changes.

**Status:** current-state handoff. Everything described here is implemented and working as of this writing.

---

## 1. What Demo Mode is

The DS Accelerator normally needs a real, connected Storybook, a real Jira OAuth app, a real GitHub OAuth app, and a real AI provider (Claude/Cursor/OpenAI/Gemini) to do anything. None of that is available to someone who doesn't own those systems — including whoever presents this tool.

**`DEMO_MODE=true`** (set in `apps/agent-orchestrator/.env`) swaps every one of those for a fixture-backed equivalent, so the full "Improve component" and "Run QA" flows work end-to-end with zero credentials and zero network calls. Everything is scripted around one real, coherent scenario already partially present in this repo: **ticket DS-042 — "Credit Score card, lead with meaning, not just the number"** (see `docs/tasks/ds-042-credit-score-clarity/`), applied to the real `DsCreditScore` component (`apps/web/src/components/ds/CreditScore.tsx`).

### How to turn it on

```
cd apps/agent-orchestrator
cp .env.example .env   # if you don't already have one
# edit .env, set:
DEMO_MODE=true
npm run serve --prefix apps/agent-orchestrator   # backend, :8787
npm run dev:web                                   # frontend, :5173 (from repo root)
```

No other env var needs to be set. Real provider keys, if present in the same `.env`, are ignored while `DEMO_MODE=true`.

### What gets faked, and how

| Real thing | Fixture replacement | Where |
|---|---|---|
| Storybook connection | One fixture component ("Credit Score"), served from an in-memory index — no real Storybook process anywhere | `apps/agent-orchestrator/src/integrations/storybook/StorybookIntegration.ts` (`loadDemoFixture()`), fixture data in `apps/agent-orchestrator/src/demo/fixtures.ts` |
| Jira | 3 fixture tickets (DS-042 + two filler bugs), same `IntegrationAdapter` interface as real Jira | `apps/agent-orchestrator/src/integrations/jira/DemoJiraIntegration.ts` |
| Workspace repository (GitHub/local) | A small seeded scratch repo under `apps/agent-orchestrator/.demo-repo/` (gitignored), containing a real copy of `CreditScore.tsx` — **never** this actual checkout, so promote/apply can't touch real project files | `apps/agent-orchestrator/src/demo/seedDemoRepo.ts`, wired into `bootstrap()` in `server.ts` |
| AI provider | A "Demo (offline)" provider that returns canned, phase-aware responses (analysis, direction generation, QA judgment) and does real file writes for staged previews | `apps/agent-orchestrator/src/providers/demo/DemoAdapter.ts` |

The demo AI provider detects which phase of the flow it's being called for by matching the distinctive opening line of the prompt (`apps/web/src/accelerator/prompts.ts` builds these), and:
- **Understanding phase**: returns a canned analysis of the Credit Score problem.
- **Direction-generation phase**: writes two real, different component variants ("Status-first hierarchy" and "Context band under the arc") plus `Preview.tsx` harnesses into the run's staging directory — genuinely real files, not just text.
- **QA phase**: writes a QA preview harness and canned judgment findings for whatever criteria are actually enabled.

Sibling files a staged component imports (e.g. `ProgressArc.tsx`, `DsTypography.tsx`) are auto-copied in unmodified from this real checkout by the existing `prepare` step (`apps/agent-orchestrator/src/proposalsRouter.ts`'s `fillSiblingGaps`) — nothing demo-specific was needed there.

### Known limitations of demo mode

- Only **one** Storybook component exists (Credit Score) — there's no way to pick a different one and get a sensible response, so the picker only ever shows this one, by design.
- Figma and Doc reference chips are unaffected either way (they're inert URL text unless a real Claude Code + Figma MCP session is active, which demo mode doesn't touch).
- GitHub isn't faked as an OAuth+PR flow — promote/apply targets the local seeded scratch repo instead. See `docs/ds-accelerator-ai-adapter-handoff.md`-style docs if a fuller GitHub simulation is ever wanted.

---

## 2. UI/architecture fixes made alongside demo mode

Running demo mode end-to-end for the first time surfaced several real, pre-existing bugs in the Compare Directions and QA Report screens — these are fixed now, not demo-specific:

### Nav bar consolidation
"Start over" and the Overview/Directions/Implementation tab stepper used to render as a separate row below the app's own topbar (two stacked, separately-bordered bars). `DsAcceleratorTool` now portals that content (via `createPortal`) into a slot (`.app-topbar__runSlot`) rendered inside `App.tsx`'s own topbar, so it's genuinely one bar. The "Back" button was also relabeled **"Start over"** with a confirm-before-discard prompt — it never navigated anywhere, it silently discarded the whole in-progress run.

### Nested-scrollbar / "boxed" layout bug
`.accelerator` used to assume it was an unpadded, direct child of the viewport (`height: calc(100vh - 56px); overflow: hidden`) — but it's actually nested inside `App.css`'s `.app-main-column`, which already has its own padding and `overflow: auto`. That mismatch produced three nested/competing scrollbars. Fixed by removing the rigid height/overflow from `.accelerator` and its descendants (`.accelerator__window`, `.accelerator__shell`, `.accelerator__stagePanel`, `.accelerator__stageBody`) — `.app-main-column` is now the single scroll container for the whole app, with `min-height` used only as a floor, never a clipping ceiling. The dot-grid "design tool" card look is now intake-screen-only (`.accelerator__window--intake`); in-run screens sit directly on the page background instead of a card-in-a-card.

### Too many nested containers
`.responsiveStage__stage` was drawing its own border despite its own code comment saying the child preview should own that chrome — removed the redundant border/radius, kept the dot-grid as a background texture. Also removed a redundant dashed panel that had been added around "Original component."

### Cropped / collapsed previews — two distinct root causes
1. **"Original component" preview** (`DsAcceleratorTool.tsx`'s `renderOriginalComponent`/`renderAppliedComponent`): when the Storybook URL isn't a real `http(s)` address (as in demo mode), it now renders the real `DsCreditScore` component directly instead of an iframe that could never load. The wrapper measuring that content was itself `height: 100%` of the box whose size depends on that very measurement — a circular loop that never converged on the real height. Fixed by letting the measured element size to its natural content height.
2. **QA report preview** (`QaPreviewFrame.tsx`): this component never had the `scrollHeight`-based measurement `DirectionPreviewFrame` uses — it just relied on CSS `height: 100%`, which only resolves correctly inside `ResponsivePreviewStage` (not used here). Ported the same measurement approach (measure on ready, settle after 350ms, `ResizeObserver` for later changes), applied as an explicit pixel height.

### Ticket picker modal
`.jiraPicker__resultRow` had no `width`/`min-width` constraint, so the grid grew to fit the widest ticket title instead of the modal, triggering a horizontal scrollbar that clipped titles mid-word instead of the ellipsis truncation (which was already there but never engaged). Fixed in `JiraTicketPicker.css`, with the same safety applied to the Component picker's rows in `SlotIntake.css`.

### Iframe scrollbars
Direction/QA previews render in a same-origin iframe (`preview-frame.html`) that never reset its own document's overflow — an iframe is its own browsing context, so the *outer* page's `overflow: hidden` can't suppress the framed document's *own* native scrollbar. Fixed with a scoped `<style>` reset inside `preview-frame.html` itself (not the shared `index.css`, which the outer app also loads).

### Direction previews showing every state at once
The demo fixture's `Preview.tsx` for both directions rendered all four badge examples (Good/Excellent/Fair/Poor) in a row, copied from `CreditScoreShowcase`'s "show every state" pattern. A comparison preview should show what a direction looks like, not showcase the whole prop surface — now renders one realistic example each.

### "Choose this direction" hidden below the fold
`.directionCard__choose` is now `position: sticky; bottom: ...` — it rides near the bottom of the viewport while its card is in view, instead of requiring a scroll past a potentially tall preview/Details section to reach it.

---

## 3. File map for this session's changes

**New (demo mode):**
- `apps/agent-orchestrator/src/demo/fixtures.ts` — fixture data + `isDemoMode()`
- `apps/agent-orchestrator/src/demo/seedDemoRepo.ts`
- `apps/agent-orchestrator/src/integrations/jira/DemoJiraIntegration.ts`
- `apps/agent-orchestrator/src/providers/demo/DemoAdapter.ts`

**Modified (demo mode):** `StorybookIntegration.ts`, `integrationsRouter.ts`, `providersCatalog.ts`, `server.ts`, `.env.example`, `.gitignore`

**Modified (UI fixes):** `App.tsx`/`App.css`, `DsAcceleratorTool.tsx`/`.css`, `AcceleratorTabs.css`, `DirectionCard.css`, `ResponsivePreviewStage.css`, `QaReport.css`, `QaPreviewFrame.tsx`, `JiraTicketPicker.tsx`/`.css`, `SlotIntake.css`, `preview-frame.html`

---

## 4. Verification

Both dev servers can run side by side as above. Smoke test: Improve Component → pick "Credit Score" → attach ticket DS-042 (or type it manually) → Analyze → confirm the analysis → Generate directions → confirm both direction previews render fully (no cropping, one example each) and the page has exactly one scrollbar → Choose a direction → Run QA on the same component → confirm the preview renders at full height and findings are legible.
