# DS Starter Kit — project intent

Use this document as shared context when working in this repo (e.g. paste into Cursor, attach to a new chat, or hand to a collaborator). It explains **what we are building and why**, not step-by-step implementation detail.

---

## One-line summary

A **standalone design system starter kit**: token-driven components, a local playground to inspect and experiment with themes, and a path toward exporting tokens into Figma — without tying the product to any single client or brand.

---

## Primary audience (read this first)

This project is **for designers and other non-developers**, not for engineers as the main user.

The bar for success is:

- A designer can **get started without writing code** — or with minimal, guided help from AI / a technical buddy.
- They can **see real coded components** (not static mocks) and understand how **tokens drive the look** of those components.
- They can **work confidently in repos that contain coded components** — browse the playground, talk about tokens and variants in plain language, and eventually export work back into **Figma Token Studio** rather than living only in design files.
- Copy, labels, and docs should favour **plain language** over implementation jargon. When technical terms are needed (token, theme, CSS variable), explain what they mean in the same breath.

Developers still matter for setup, extending components, and CI — but **designers are the reason this exists**. Features should be judged by whether a designer can use them without opening `package.json`.

---

## Problem we are solving

People who want to **start or evolve a design system** often lack a practical middle ground between:

- a empty Figma file, and  
- a full, mature product design system locked to one organisation.

We want a **ready-to-run kit** that already has:

- a sensible **token architecture** (general tokens that cascade into component tokens),  
- a **small set of real UI components** wired to those tokens, and  
- a **playground** to see tokens and components update together as the system is tuned.

The goal is **experimentation and theme exploration first**, then **export** into design tools (especially Figma Token Studio), not “upload arbitrary JSON and hope it works” as the first milestone.

---

## What this repo is

| Piece | Role |
|-------|------|
| `packages/tokens` | Token Studio–style JSON, resolver, and CSS build (`var(--ds-…)`) |
| `apps/web` | Local playground: **Foundation** (token inspector) and **Components** (showcases) |

This is a **separate initiative** from client-specific repos (e.g. Vorwerk FSB). It lives under the initiatives area and should stay **neutral in naming and branding** — no product-specific flows or proprietary component families.

---

## Playground UX (source of truth for “feel”)

The playground should **feel like the Vorwerk FSB local playground** (`local_fsb_v1` / `apps/web`), not an older minimal sidebar layout. Concretely:

- **Left icon rail** with tooltips; primary sections at the **bottom** of the rail (e.g. Components, Foundation).
- **Second sidebar** when browsing components: title, **search**, scrollable list.
- **Main area**: header with mode controls + content (token viewer or component showcase).
- **Token viewer**: tile and list layouts, filters, visual previews for colour/spacing/radius — not a plain table only.

Foundation and Components are the core sections for now. Flows, accelerators, and client tools are **out of scope** unless explicitly added later.

---

## Tokens

### Architecture

- **General tokens** — colour, spacing, typography, radii, shadows, etc. These are the main levers; changing them should ripple through component tokens that reference them.
- **Component tokens** — per-component namespaces (button, badge, checkbox, …) that alias general tokens where possible.
- **Modes** on `<html>`: theme × appearance × density (e.g. `data-ds-theme`, `data-ds-appearance`, `data-ds-density`).

### Themes (current)

- **Default** — baseline starter palette and scales.
- **Warm** — alternate theme to prove multi-theme switching (same component set, different resolved values).

Users must be able to **switch theme, light/dark, and density** in the playground and see components and the token inspector reflect the active mode.

### Fonts

Token JSON may reference designer-facing font names; the web app maps them to **loaded web fonts** (e.g. Geist Sans) so previews are readable without shipping proprietary font files in v1.

### Explicitly not in v1

- **Upload your own token JSON** — deferred; validation and schema mismatch are hard, and most users will not start from a file upload.
- Preferred direction later: **export from this kit → import into Figma Token Studio**, not Figma → upload here as the primary loop.

---

## Components

### In scope

**Basic, reusable UI primitives** that demonstrate the token model, for example:

Accordion, Bottom Sheet, Button, Icon Button, Badge, Checkbox, Checkbox Group, Rich Checkbox Group, Link Button, Tooltip, Spinner, Progress (linear / arc), Slider, Flexible Range, Widget, Success, Typography, Credit Score (demo-style composite), and similar **starter-kit** pieces.

Each should have a **showcase** in the playground registry.

### Out of scope

**Life OS / chat / intelligence / OS-specific** component families (OsChat, OsAnnotation, Intelligence Logo, Life Intelligence Entry, etc.). Those belong to a product line, not a neutral starter kit.

Do not reintroduce product flows, device chrome demos, or branded marketing screens unless the intent document is updated.

---

## Planned evolution (not necessarily built yet)

Work in roughly this order:

1. **Theme lab (MVP+)** — real-time editing of **general** tokens (colour, spacing, key radii) with **live preview** on component showcases; no full JSON upload.
2. **Onboarding** — optional first screen: name the design system, pick default vs warm theme, then enter the playground.
3. **Export** — download token JSON structured for **Figma Token Studio** import.
4. **Scaffold (optional)** — zip or template repo with customised tokens + playground skeleton for greenfield teams.

---

## Success criteria (how we know it’s working)

- A new contributor can `npm install` and `npm run dev:web` and immediately browse **tokens** and **components** without reading a long manual.
- Changing **theme / appearance / density** updates the UI and token inspector correctly.
- **General token edits** (when the theme lab exists) update component previews in real time without a manual rebuild loop for every tweak.
- The repo stays **brand-neutral**, **documented**, and **easy to open in its own Cursor window** with this file as context.
- A **designer** (not only a developer) can describe a token or component change in plain language and recognise the result in the playground.

---

## How to run (reminder)

From the repo root:

```bash
npm install
npm run dev:web
```

Regenerate CSS after token JSON changes:

```bash
npm run tokens:build
```

---

## Background & context (how this repo came to be)

This section records **lineage and prior work**. It is not required to run the kit, but it helps agents and humans understand decisions already made.

### Conversation and exploration (Vorwerk FSB repo)

Much of the **initial thinking** happened while working in the **Vorwerk FSB local repo** (`local_fsb_v1`). That repo is a **client-specific** design system and playground — it is **not** this product.

What carried over from that work:

| From FSB | How it applies here |
|----------|---------------------|
| **Playground shape** — icon rail, context sidebar, Foundation + Components, searchable component list, rich token viewer | **UX target** for `apps/web` in this repo |
| **Playground specification** (`02-imports/web-ds-playground-specification.md`) | Portable description of *how the app is organised*; token names and components are different here |
| **Proof that tokens + showcases work together** | Validates the model designers should experience in the starter kit |

What did **not** carry over: Vorwerk branding, FSB component library, Sensor flows, accelerators, agent tools, or `--vds-*` Vorwerk token naming.

### Technical baseline (BFSI Labs monorepo)

The **first implementation** of this repo was bootstrapped from the **BFSI Labs monorepo** (sometimes referred to informally as “BSI Labs”). That monorepo is a **separate, earlier initiative** with a mature **tokens-first** setup and many coded components.

What we took from BFSI Labs:

| From BFSI Labs | How it applies here |
|----------------|---------------------|
| `packages/tokens` — Token Studio JSON, `general` + per-component groups, appearance/density modes, resolver, CSS build | **Structural model** for `packages/tokens` in this repo (`--ds-*`, `data-ds-*`) |
| Component implementations — Button, Badge, Checkbox, Accordion, etc. | **Starter component set** (copied and trimmed) |
| Per-component token namespaces (e.g. `button.*` aliasing `general.*`) | **Pattern** designers should learn: change general → components follow |

What we **deliberately left behind**:

- **Life OS** and other **product-specific** UI (chat modules, intelligence logo, OS annotations, product flows).
- **BFSI / Life OS branding** in UI copy, theme names exposed to users, and repo positioning.
- The full monorepo scope (mobile app, dozens of flows, Storybook as primary surface).

Themes in this kit were renamed for neutrality (**Default**, **Warm**) rather than exposing internal theme file names from the source monorepo.

### Why a new repo instead of extending BFSI Labs or FSB

| Repo | Role |
|------|------|
| **Vorwerk FSB** | Production/client DS + playground for Vorwerk work |
| **BFSI Labs monorepo** | Rich reference implementation and historical R&D |
| **DS Starter Kit (this repo)** | **Neutral, designer-facing entry point** — small, approachable, export-oriented |

This repo should stay **easy to open in its own Cursor window** with `docs/project-intent.md` as context, without pulling client or product baggage.

### What was already built here (snapshot)

As of the first scaffold:

- Monorepo: `packages/tokens` + `apps/web` playground.
- Playground aligned with **FSB-style** navigation (icon rail, component sidebar, token tiles).
- **Default** and **Warm** themes; appearance and density switching.
- ~20 **starter components** with showcases; Life OS family excluded.
- Font mapping so previews work without proprietary Equip files in the repo.
- **Not yet built**: theme lab (live general-token editing), onboarding screen, Figma export download.

---

## References (for agents and developers)

| Need | Where |
|------|--------|
| Playground layout pattern | Vorwerk `local_fsb_v1` → `apps/web` (icon rail, context sidebar, Foundation, Components) |
| Token + component baseline | BFSI Labs monorepo → `packages/tokens`, `apps/web/src/components/ds` (general + per-component JSON, resolver, showcases) |
| Playground product shape (portable spec) | `02-imports/web-ds-playground-specification.md` in FSB repo (IA and behaviour, not Vorwerk token names) |
| BFSI Labs monorepo (reference) | `…/04-initiatives/01-nagarro-ds/01-repo-dv/bfsi-starter-kit/bfsi-labs-monorepo` — do not treat as this product; use for deltas and token parity only |

When implementing, prefer **matching FSB playground behaviour** and **this repo’s token naming** (`--ds-*`, `data-ds-*`). Do not copy client logos, Vorwerk-specific registry entries, or FSB-only tools unless the intent document is updated.

---

## Document maintenance

Update this file when the **goal** changes (e.g. upload support added, new theme system, mobile package). Keep implementation details in code, README, or ADRs — this file should stay a **short, stable statement of intent** suitable for upload as chat context.
