import dotenv from "dotenv";
import { setMaxListeners } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CursorAdapter } from "./providers/cursor/CursorAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const defaultRepoRoot = path.resolve(packageRoot, "..", "..");
const appEnvPath = path.resolve(packageRoot, ".env");
const repoEnvPath = path.resolve(defaultRepoRoot, ".env");

// Avoid noisy AbortSignal listener warnings from SDK internals on Node 22.
setMaxListeners(0);

// Load app-local env first, then monorepo root env as a fallback.
dotenv.config({ path: appEnvPath, quiet: true });
dotenv.config({ path: repoEnvPath, override: false, quiet: true });

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage:");
  console.log('  npm run dev --prefix apps/agent-orchestrator -- "your task prompt"');
  console.log("");
  console.log("Environment variables:");
  console.log("  CURSOR_API_KEY    Required Cursor API key");
  console.log("  CURSOR_MODEL      Optional preferred model ID");
  console.log("  DS_REPO_ROOT      Optional absolute monorepo path override (FSB_REPO_ROOT also accepted)");
  process.exit(0);
}

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing CURSOR_API_KEY. Copy .env.example to .env and set the key.");
  process.exit(1);
}
if (apiKey === "cursor_xxx") {
  console.error("CURSOR_API_KEY is still placeholder value 'cursor_xxx'. Replace it with a real key.");
  process.exit(1);
}

const repoRoot = process.env.DS_REPO_ROOT?.trim()
  ? path.resolve(process.env.DS_REPO_ROOT)
  : process.env.FSB_REPO_ROOT?.trim()
    ? path.resolve(process.env.FSB_REPO_ROOT)
    : defaultRepoRoot;
const task = args.join(" ").trim();

const prompt = `
You are working in the DS Starter Kit monorepo (design-system playground + tokens + components).

Objective:
- ${task || "Inspect apps/web and propose the smallest safe component change in src/components/ds with implementation steps."}

Guardrails:
- Treat the repository files and .cursor/rules as source of truth.
- Keep changes scoped to apps/web and packages/tokens unless absolutely required.
- Reuse existing DS components, conventions, and var(--ds-*) token usage; never introduce client-specific branding.
- Explain intended changes before editing files.
`.trim();

try {
  console.log("Running Cursor agent...");
  console.log(`cwd: ${repoRoot}`);
  if (task) {
    console.log(`task: ${task}`);
  } else {
    console.log("task: (default) inspect/propose mode");
  }

  const settingSources: string[] =
    (process.env.CURSOR_LOCAL_SETTING_SOURCES?.trim() || "all") === "all" ? ["all"] : [];

  const adapter = new CursorAdapter({
    apiKey,
    requestedModel: process.env.CURSOR_MODEL?.trim() || "",
    settingSources,
  });

  console.log("Checking Cursor API key and available models...");
  await adapter.initialize();
  console.log(`health: ${JSON.stringify(adapter.health())}`);

  const events: unknown[] = [];
  const result = await adapter.runJob({
    prompt,
    cwd: repoRoot,
    onEvent: (event) => events.push(event),
    signal: new AbortController().signal,
  });

  console.log(`status: ${result.status}`);
  if (result.runId) console.log(`runId: ${result.runId}`);
  if (typeof result.durationMs === "number") console.log(`durationMs: ${result.durationMs}`);

  if (result.output?.trim()) {
    console.log("");
    console.log("Agent output:");
    console.log(result.output.trim());
  } else {
    console.log("Agent output: (empty)");
  }

  if (result.status !== "finished") {
    process.exitCode = 2;
  }
} catch (error) {
  console.error("Unexpected error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
