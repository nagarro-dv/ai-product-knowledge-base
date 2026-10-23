# AI Product Knowledge Base

A proactive knowledge base for product teams. Instead of waiting for questions, background agents watch your connected sources (Jira, Figma, Zendesk, Amplitude, Dovetail and more) and bring what they find to you: proposed initiatives, changes in the metrics you track, and new insights. You take an initiative from idea to something stakeholders can validate, and send it to Jira Product Discovery when it's ready.

This is a proof of concept. The pages, agents and data are real UI running on fixture data — there's no knowledge backend or agent runtime yet, so chat replies are canned. The one live integration is Jira Product Discovery.

## What's in it

| Page | What you do there |
|------|-------------------|
| **Start** | See what agents found since you last looked: a suggested initiative, your tracked metrics, new insights, agent activity, and work to pick up again. |
| **Search** | Browse what the knowledge base holds, by source, and scope a question to particular sources. |
| **Create** | Move initiatives through the pipeline (Proposed → Exploring → Brief ready → Prototyping → Validating), or start one from a template. |
| **Insights** | Every insight the agents reported, with the evidence behind it. |
| **Agents** | What each background agent watches and what it has done. |

Across every page:

- **Prompt box** with source chips, fill-in prompt templates and a choice of AI model. Chats keep the files they produce (briefs, decks, charts) in a side drawer.
- **Initiative details** open in a drawer: the goal and the OKRs it moves, why it's valuable, its sources and insights, notes, and the next step.
- **Impact score** (0–100) on every initiative, worked out from RICE (Reach × Impact × Confidence ÷ Effort). Confidence comes from the evidence, never typed in. The ⓘ shows the working.
- **Sharing** to Slack, Microsoft Teams and Jira Product Discovery, plus copy, Markdown download, print/PDF and email.

## Run it locally

1. Install [Node.js LTS](https://nodejs.org).
2. Open a terminal in this folder (the one that contains this `README.md`).
3. First time only:

   ```bash
   npm install
   ```

4. Start the agent server and the web app together:

   ```bash
   npm run dev:all
   ```

   Or run them in two terminals with `npm run dev:agent` and `npm run dev:web`.

5. Open **http://localhost:5173**.

The web app works on its own; the agent server (port 8787) is what talks to Jira Product Discovery and the AI providers.

## Useful commands

| Command | What it does |
|---------|--------------|
| `npm run dev:all` | Start the agent server and the web app |
| `npm run dev:web` | Start the web app (http://localhost:5173) |
| `npm run dev:agent` | Start the agent server (http://localhost:8787) |
| `npm run build:web` | Production build of the web app |
| `npm run tokens:build` | Regenerate the design tokens' CSS (`apps/web/src/styles/tokens.generated.css`) |

## Connect Jira Product Discovery

"Send to Product Discovery" on an initiative creates a real idea in your Product Discovery space, with its fields filled in: Theme, Roadmap, Impact, Reach, Effort, Confidence, Value, a short description and an `ai-knowledge-base` label. Product Discovery then works out the RICE score. Fields are matched by name to whatever your space has, so it adapts to your own fields and options.

1. Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens.
2. Copy `apps/agent-orchestrator/.env.example` to `apps/agent-orchestrator/.env` (it's git-ignored) and fill in:

   ```
   JPD_SITE=your-site.atlassian.net
   JPD_EMAIL=you@example.com
   JPD_API_TOKEN=your-token
   JPD_PROJECT_KEY=PI
   ```

3. Start (or keep running) the agent server. The send dialog shows **Connected** when it can reach your space; without these settings, sending stays a demo.

The token stays on the agent server — the browser never sees it. How initiatives map to Product Discovery fields is in `apps/web/src/knowledgeV2/jpdFields.ts`.

## Host it on Netlify

The repo is set up for [Netlify](https://www.netlify.com) (`netlify.toml`): every push to `main` rebuilds the public site, and pull requests get their own preview links. Sending to Product Discovery works on the hosted site too, through a Netlify Function (`netlify/functions/product-discovery.mts`).

1. In Netlify, choose **Add new project → Import an existing project → GitHub**, and pick `nagarro-dv/ai-product-knowledge-base`. Netlify reads the build settings from `netlify.toml`, so leave them as they are. (Private repos owned by a GitHub organization need Netlify's Pro plan, and a nagarro-dv admin may need to approve Netlify's GitHub access.)
2. Before the first deploy, or under **Project configuration → Environment variables** afterwards, add the same four settings as above: `JPD_SITE`, `JPD_EMAIL`, `JPD_API_TOKEN` and `JPD_PROJECT_KEY`. Mark `JPD_API_TOKEN` as a secret.
3. Deploy. If you add or change the variables later, trigger a new deploy so the function picks them up.

The site has no password: anyone with the link can use it, including creating ideas in your Product Discovery space with the token you set. Use a token you're comfortable sharing that way (an Atlassian service account is a good fit), and revoke it to cut off access. On the hosted site, chat replies and the AI model picker stay in demo mode — only the agent server can run real AI providers.

## Project layout

| Folder | What's there |
|--------|--------------|
| `apps/web` | The web app (React, Vite, TypeScript). The knowledge base itself is in `src/knowledgeV2`. |
| `apps/agent-orchestrator` | Local server for AI providers and Jira Product Discovery. The Product Discovery logic is in `src/productDiscovery.ts`, shared with the hosted site. |
| `netlify` | The hosted site's Product Discovery function (with `netlify.toml` at the root). |
| `packages/tokens` | Design tokens and the CSS variables built from them. |

Fixture data — initiatives, insights, metrics, OKRs, agents — lives in `apps/web/src/knowledgeV2/data.ts`.

## Where it came from

This started as an experiment inside the [DS Starter Kit](https://github.com/nagarro-dv/ds-starter-kit) and moved to its own repository to become a standalone product. Some code and internal names (such as the `@ds-starter/*` package names and the design tokens) still come from there and are being removed; for the design system, the DS Accelerator and their documentation, see the [DS Starter Kit repository](https://github.com/nagarro-dv/ds-starter-kit).
