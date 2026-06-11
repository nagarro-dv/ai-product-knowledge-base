# Agent Orchestrator

Small Node app that drives Cursor agents against this monorepo.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `CURSOR_API_KEY` (must be a real key, not `cursor_xxx`).
3. Optional: set `CURSOR_MODEL` (default `composer-2`).
4. Optionally set `FSB_REPO_ROOT` (defaults to this repo root).
5. Optional: set `CURSOR_LOCAL_SETTING_SOURCES`:
   - `all` (default): load local Cursor settings, including configured MCP servers like Figma.
   - any other value: do not load local settings (MCP access likely unavailable).

## Run one-shot CLI

```bash
npm run dev --prefix apps/agent-orchestrator
```

With a task:

```bash
npm run dev --prefix apps/agent-orchestrator -- "Create a DS PromoBadge component in apps/web"
```

The runner starts a local Cursor agent with `cwd` pointed at the repository root so it can read shared rules/docs and edit `apps/web`.

## Run local API server (for playground Tool UI)

```bash
npm run serve --prefix apps/agent-orchestrator
```

Endpoints:

- `GET /api/agent/health`
- `POST /api/agent/chat` — waits for the full run, returns JSON
- `POST /api/agent/chat/stream` — **SSE** (`text/event-stream`): emits `thinking`, `assistant`, `tool`, `status`, `task` events, then a terminal `done` object (same fields as `/chat`)

`GET /api/agent/health` now also reports:

- `localSettingSources`
- `figmaMcpAccessLikely`

`apps/web` dev server proxies `/api/agent/*` to `http://localhost:8787` by default.
