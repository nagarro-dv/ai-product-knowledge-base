import dotenv from "dotenv";
import { setMaxListeners } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, Cursor, CursorAgentError, CursorSdkError } from "@cursor/sdk";
type LocalSettingSource = "project" | "user" | "team" | "mdm" | "plugins" | "all";

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
  console.log("  FSB_REPO_ROOT     Optional absolute monorepo path override");
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

const fsbRepoRoot = process.env.FSB_REPO_ROOT;
const repoRoot = fsbRepoRoot ? path.resolve(fsbRepoRoot) : defaultRepoRoot;
const localSettingSources = process.env.CURSOR_LOCAL_SETTING_SOURCES?.trim() || "all";
const resolvedSettingSources: LocalSettingSource[] = localSettingSources === "all" ? ["all"] : [];
const task = args.join(" ").trim();
const requestedModel = process.env.CURSOR_MODEL?.trim() || "composer-2";

const prompt = `
You are working in the Vorwerk monorepo.

Objective:
- ${task || "Inspect apps/web and propose the smallest safe component change in src/components/ds with implementation steps."}

Guardrails:
- Treat the repository files and .cursor/rules as source of truth.
- Keep changes scoped to apps/web unless absolutely required.
- Reuse existing DS components, conventions, and --vds-* token usage.
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

  console.log("Checking Cursor API key and available models...");
  const me = await Cursor.me({ apiKey });
  const models = await Cursor.models.list({ apiKey });
  if (models.length === 0) {
    throw new Error("No models available for this API key.");
  }

  const hasRequestedModel = models.some((model) => model.id === requestedModel);
  const modelId = hasRequestedModel ? requestedModel : models[0].id;
  if (!hasRequestedModel) {
    console.warn(
      `Requested model '${requestedModel}' is not available for this key. Falling back to '${modelId}'.`
    );
  }
  console.log(`apiKeyName: ${me.apiKeyName}`);
  console.log(`model: ${modelId}`);

  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: modelId },
    local: { cwd: repoRoot, settingSources: resolvedSettingSources }
  });

  if ("id" in result && typeof result.id === "string") {
    console.log(`run: ${result.id}`);
  }
  console.log(`status: ${result.status}`);
  if (typeof result.durationMs === "number") {
    console.log(`durationMs: ${result.durationMs}`);
  }
  if (result.result?.trim()) {
    console.log("");
    console.log("Agent output:");
    console.log(result.result.trim());
  } else {
    console.log("Agent output: (empty)");
  }

  if (result.status !== "finished") {
    process.exitCode = 2;
  }
} catch (error) {
  if (error instanceof CursorAgentError) {
    console.error("Cursor SDK request failed.");
    console.error(`message: ${error.message}`);
    if (error instanceof CursorSdkError) {
      console.error(`code: ${error.code ?? "n/a"}`);
      console.error(`status: ${error.status ?? "n/a"}`);
      console.error(`retryable: ${String(error.isRetryable)}`);
      if (error.operation) {
        console.error(`operation: ${error.operation}`);
      }
      if (error.endpoint) {
        console.error(`endpoint: ${error.endpoint}`);
      }
      if (error.requestId) {
        console.error(`requestId: ${error.requestId}`);
      }
    }
    process.exitCode = 1;
  } else {
    throw error;
  }
}
