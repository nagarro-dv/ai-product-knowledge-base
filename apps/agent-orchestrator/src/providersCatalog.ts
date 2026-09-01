import dotenv from 'dotenv';
import { ClaudeAdapter } from './providers/claude/ClaudeAdapter.js';
import { ClaudeCodeAdapter } from './providers/claude-code/ClaudeCodeAdapter.js';
import { CursorAdapter } from './providers/cursor/CursorAdapter.js';
import { CursorCliAdapter } from './providers/cursor/CursorCliAdapter.js';
import { GeminiAdapter } from './providers/gemini/GeminiAdapter.js';
import { OpenAIAdapter } from './providers/openai/OpenAIAdapter.js';
import { DemoAdapter } from './providers/demo/DemoAdapter.js';
import { isDemoMode } from './demo/fixtures.js';
import { asPersonalKeyMethod } from './providers/personal.js';
import { clearAdapters, getAdapter, listAdapters, registerAdapter } from './providers/registry.js';
import type { AiProviderAdapter } from './providers/types.js';
import { deletePersonalKey, listPersonalKeyMeta, readPersonalKey, savePersonalKey, type PersonalKeyMeta } from './credentials/store.js';
import { isMethodDismissed, setMethodDismissed } from './credentials/dismissedMethods.js';

/**
 * Setup-time catalog of every known provider auth method, including ones that
 * are not configured or failed to initialize. This is what lets the AI Models
 * page show honest "Not connected — here's how" states for all four provider
 * families (Cursor, Claude, ChatGPT, Gemini) instead of hiding everything but
 * the currently-connected runtime.
 *
 * The runnable registry (providers/registry.ts) only ever holds methods that
 * initialized successfully; this catalog describes the rest.
 */

type CatalogMethodStatus = 'connected' | 'not-configured' | 'unavailable';

type CatalogMethod = {
  id: string;
  label: string;
  kind: string;
  source: 'organisation' | 'personal';
  description: string;
  /** Plain-language instruction for making this method available. */
  hint: string;
  /** Exact env var an admin sets for this method (api-key methods only). */
  envVar?: string;
  signInCommand?: string;
  installUrl?: string;
  mcpServers?: readonly string[];
  capabilities: { localRepoEdits: boolean; streaming: boolean; mcp: boolean };
  status: CatalogMethodStatus;
  error?: string;
};

type CatalogProvider = {
  id: string;
  label: string;
  methods: CatalogMethod[];
};

let providerCatalog: CatalogProvider[] = [];
let personalKeyMeta: Record<string, PersonalKeyMeta> = {};

/** Env keys re-read on refresh; cleared first so keys removed from .env actually disappear. */
const MANAGED_ENV_KEYS = [
  'CURSOR_API_KEY',
  'CURSOR_MODEL',
  'CURSOR_LOCAL_SETTING_SOURCES',
  'CURSOR_CLI_ENABLED',
  'CURSOR_CLI_MODEL',
  'ANTHROPIC_API_KEY',
  'CLAUDE_MODEL',
  'CLAUDE_EXTENDED_THINKING',
  'CLAUDE_CODE_ENABLED',
  'CLAUDE_CODE_MODEL',
  'CLAUDE_CODE_PERMISSION_MODE',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
];

function catalogProviderFor(catalog: CatalogProvider[], adapter: AiProviderAdapter): CatalogProvider {
  let provider = catalog.find((entry) => entry.id === adapter.providerId);
  if (!provider) {
    provider = { id: adapter.providerId, label: adapter.providerLabel, methods: [] };
    catalog.push(provider);
  }
  return provider;
}

/**
 * Describes the method in the catalog and, when configured, initializes and
 * registers it as runnable. Initialization failures (bad key, missing CLI,
 * signed-out runtime) become an 'unavailable' catalog entry with the real
 * error instead of halting startup.
 */
async function registerMethod(
  catalog: CatalogProvider[],
  input: { adapter: AiProviderAdapter; configured: boolean; hint: string; envVar?: string },
): Promise<void> {
  const { adapter, configured, hint, envVar } = input;
  const provider = catalogProviderFor(catalog, adapter);
  const entry: CatalogMethod = {
    id: adapter.authMethod.id,
    label: adapter.authMethod.label,
    kind: adapter.authMethod.kind,
    source: adapter.authMethod.source,
    description: adapter.authMethod.description,
    hint,
    ...(envVar && { envVar }),
    ...(adapter.authMethod.signInCommand && { signInCommand: adapter.authMethod.signInCommand }),
    ...(adapter.authMethod.installUrl && { installUrl: adapter.authMethod.installUrl }),
    ...(adapter.authMethod.mcpServers && { mcpServers: adapter.authMethod.mcpServers }),
    capabilities: adapter.capabilities,
    status: 'not-configured',
  };
  provider.methods.push(entry);

  if (!configured) {
    console.warn(`[providers] ${adapter.id} not configured — skipped.`);
    return;
  }

  try {
    await adapter.initialize();
    registerAdapter(adapter);
    entry.status = 'connected';
  } catch (error) {
    entry.status = 'unavailable';
    entry.error = error instanceof Error ? error.message : String(error);
    console.warn(`[providers] ${adapter.id} unavailable: ${entry.error}`);
  }
}

function createPersonalKeyAdapter(providerId: string, apiKey: string): AiProviderAdapter | null {
  switch (providerId) {
    case 'cursor':
      return asPersonalKeyMethod(
        new CursorAdapter({
          apiKey,
          requestedModel: process.env.CURSOR_MODEL?.trim() || '',
          settingSources: (process.env.CURSOR_LOCAL_SETTING_SOURCES?.trim() || 'all') === 'all' ? ['all'] : [],
        }),
      );
    case 'claude':
      return asPersonalKeyMethod(
        new ClaudeAdapter({
          apiKey,
          model: process.env.CLAUDE_MODEL?.trim() || '',
          extendedThinking: process.env.CLAUDE_EXTENDED_THINKING === 'true',
        }),
      );
    case 'openai':
      return asPersonalKeyMethod(new OpenAIAdapter({ apiKey, model: process.env.OPENAI_MODEL?.trim() || '' }));
    case 'gemini':
      return asPersonalKeyMethod(new GeminiAdapter({ apiKey, model: process.env.GEMINI_MODEL?.trim() || '' }));
    default:
      return null;
  }
}

export type SyncProvidersOptions = {
  /** Re-read these .env files (clearing managed keys first) before probing. */
  reloadEnvPaths?: string[];
};

/**
 * Rebuilds the full provider catalog and runnable registry from the current
 * environment and stored personal keys. Called once at startup and again on
 * user-triggered refreshes / personal-key changes.
 */
export async function syncProviders(options: SyncProvidersOptions = {}): Promise<void> {
  if (options.reloadEnvPaths?.length) {
    // dotenv only ever SETS keys present in the file — clearing first makes a
    // refresh an honest re-read instead of a one-way accumulation.
    for (const key of MANAGED_ENV_KEYS) delete process.env[key];
    for (const envPath of options.reloadEnvPaths) {
      dotenv.config({ path: envPath, override: true, quiet: true });
    }
  }

  // Drop every previously registered adapter before re-probing so removed
  // credentials and stale failure states don't survive the sync. Safe with
  // in-flight jobs: runJob() resolves its adapter reference at job start.
  clearAdapters();

  const nextCatalog: CatalogProvider[] = [];
  personalKeyMeta = await listPersonalKeyMeta();

  if (isDemoMode()) {
    await registerMethod(nextCatalog, {
      adapter: new DemoAdapter(),
      configured: true,
      hint: 'Built-in offline demo data (DEMO_MODE) — no credentials needed.',
    });
  }

  const registerPersonalKeyMethod = async (providerId: string) => {
    const storedKey = await readPersonalKey(providerId);
    const adapter = createPersonalKeyAdapter(providerId, storedKey ?? 'unset');
    if (!adapter) return;
    await registerMethod(nextCatalog, {
      adapter,
      configured: Boolean(storedKey),
      hint: 'Connect your own API key. Stored securely on this computer and billed to your own account.',
    });
  };

  // Registration order within a provider defines its default auth method.
  const cursorApiKey = process.env.CURSOR_API_KEY?.trim() ?? '';
  await registerMethod(nextCatalog, {
    adapter: new CursorAdapter({
      apiKey: cursorApiKey,
      requestedModel: process.env.CURSOR_MODEL?.trim() || '',
      settingSources: (process.env.CURSOR_LOCAL_SETTING_SOURCES?.trim() || 'all') === 'all' ? ['all'] : [],
    }),
    configured: Boolean(cursorApiKey && cursorApiKey !== 'cursor_xxx'),
    hint: 'Ask an administrator to set CURSOR_API_KEY in apps/agent-orchestrator/.env and restart the assistant service.',
    envVar: 'CURSOR_API_KEY',
  });
  await registerPersonalKeyMethod('cursor');
  await registerMethod(nextCatalog, {
    adapter: new CursorCliAdapter({ model: process.env.CURSOR_CLI_MODEL?.trim() || '' }),
    // A user-initiated in-app disconnect (see disconnectMethod) is treated
    // exactly like "not configured" — same status, same UI, same recovery
    // path — rather than a separate state, since the underlying CLI session
    // itself is untouched and reconnecting is just re-enabling this check.
    configured: process.env.CURSOR_CLI_ENABLED?.trim() !== 'false' && !(await isMethodDismissed('cursor', 'cli')),
    hint: 'Install the Cursor CLI on this machine (https://cursor.com/cli) and sign in by running `cursor-agent login` with your Cursor account. Your personal plan is used — no API key needed.',
  });

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  await registerMethod(nextCatalog, {
    adapter: new ClaudeAdapter({
      apiKey: anthropicApiKey || 'unset',
      model: process.env.CLAUDE_MODEL?.trim() || '',
      extendedThinking: process.env.CLAUDE_EXTENDED_THINKING === 'true',
    }),
    configured: Boolean(anthropicApiKey),
    hint: 'Ask an administrator to set ANTHROPIC_API_KEY in apps/agent-orchestrator/.env and restart the assistant service.',
    envVar: 'ANTHROPIC_API_KEY',
  });
  await registerPersonalKeyMethod('claude');
  await registerMethod(nextCatalog, {
    adapter: new ClaudeCodeAdapter({
      model: process.env.CLAUDE_CODE_MODEL?.trim() || '',
      permissionMode: process.env.CLAUDE_CODE_PERMISSION_MODE?.trim() || '',
    }),
    // See the matching comment on the Cursor CLI registration above — same
    // in-app-only disconnect model.
    configured: process.env.CLAUDE_CODE_ENABLED?.trim() !== 'false' && !(await isMethodDismissed('claude', 'claude-code')),
    hint: 'Install Claude Code on this machine and sign in by running `claude` with your Claude Pro or Max account. Your personal plan is used — no API key needed.',
  });

  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  await registerMethod(nextCatalog, {
    adapter: new OpenAIAdapter({ apiKey: openaiApiKey || 'unset', model: process.env.OPENAI_MODEL?.trim() || '' }),
    configured: Boolean(openaiApiKey),
    hint: 'Ask an administrator to set OPENAI_API_KEY in apps/agent-orchestrator/.env and restart the assistant service.',
    envVar: 'OPENAI_API_KEY',
  });
  await registerPersonalKeyMethod('openai');

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  await registerMethod(nextCatalog, {
    adapter: new GeminiAdapter({ apiKey: geminiApiKey || 'unset', model: process.env.GEMINI_MODEL?.trim() || '' }),
    configured: Boolean(geminiApiKey),
    hint: 'Ask an administrator to set GEMINI_API_KEY in apps/agent-orchestrator/.env and restart the assistant service.',
    envVar: 'GEMINI_API_KEY',
  });
  await registerPersonalKeyMethod('gemini');

  providerCatalog = nextCatalog;

  if (listAdapters().length === 0) {
    console.warn(
      '[providers] No AI provider is connected. The playground still works in sample-data mode; connect a provider to run real jobs.',
    );
  } else {
    console.log(`[providers] connected: ${listAdapters().map((a) => a.id).join(', ')}`);
  }
}

/** Shape returned by GET /api/agent/providers and its refresh/personal-key routes. */
export function buildProvidersPayload() {
  const providers = providerCatalog.map((provider) => {
    const registered = listAdapters().filter((adapter) => adapter.providerId === provider.id);
    const defaultAdapter = registered[0];
    const defaultHealth = defaultAdapter?.health();
    const authMethods = provider.methods.map((method) => {
      const adapter = getAdapter(provider.id, method.id);
      const h = adapter?.health();
      // A runtime that initialized but failed its last run (e.g. Claude Code
      // signed out mid-session) is reported as needing attention.
      const lastRunError = typeof h?.lastRunError === 'string' ? h.lastRunError : '';
      const personalMeta = method.id === 'personal-api-key' ? personalKeyMeta[provider.id] : undefined;
      return {
        id: method.id,
        label: method.label,
        kind: method.kind,
        source: method.source,
        description: method.description,
        hint: method.hint,
        ...(method.envVar && { envVar: method.envVar }),
        ...(method.signInCommand && { signInCommand: method.signInCommand }),
        ...(method.installUrl && { installUrl: method.installUrl }),
        ...(method.mcpServers && method.mcpServers.length > 0 && { mcpServers: method.mcpServers }),
        // Only the non-secret last-4 hint ever leaves the server.
        ...(personalMeta && { maskedHint: `····${personalMeta.keyEndingIn}`, savedAt: personalMeta.savedAt }),
        capabilities: method.capabilities,
        status: lastRunError ? ('unavailable' as const) : method.status,
        ok: Boolean(h?.ok) && !lastRunError,
        ...(typeof h?.model === 'string' && h.model && { model: h.model }),
        ...(typeof h?.lastAuthSource === 'string' && { lastAuthSource: h.lastAuthSource }),
        ...(lastRunError ? { error: lastRunError } : method.error ? { error: method.error } : {}),
      };
    });
    return {
      id: provider.id,
      label: provider.label,
      ok: authMethods.some((method) => method.ok),
      ...(typeof defaultHealth?.model === 'string' && defaultHealth.model && { model: defaultHealth.model }),
      defaultAuthMethod: defaultAdapter?.authMethod.id ?? null,
      authMethods,
    };
  });
  return { providers };
}

/** Validates the key with a real provider call BEFORE storing it. Throws on invalid keys. */
export async function connectPersonalKey(providerId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error('Enter an API key first.');
  const probe = createPersonalKeyAdapter(providerId, trimmed);
  if (!probe) throw new Error(`Unknown provider '${providerId}'.`);
  await probe.initialize();
  await savePersonalKey(providerId, trimmed);
  await syncProviders();
}

export async function disconnectPersonalKey(providerId: string): Promise<void> {
  await deletePersonalKey(providerId);
  await syncProviders();
}

function findCatalogMethod(providerId: string, methodId: string): CatalogMethod | undefined {
  return providerCatalog.find((p) => p.id === providerId)?.methods.find((m) => m.id === methodId);
}

/**
 * Generic disconnect, shared by every auth-method kind that has a real,
 * user-owned connection to end:
 * - `personal-api-key` — deletes the stored secret (same as disconnectPersonalKey).
 * - `local-runtime` (Claude Code, Cursor CLI) — marks it dismissed; see
 *   dismissedMethods.ts for why this can't and shouldn't sign the user out
 *   of the external CLI itself.
 *
 * Deliberately refuses `organisation`-sourced methods (admin-configured
 * .env keys) — those aren't this user's credential to remove, and doing so
 * would break the shared method for every other user of this workspace.
 */
export async function disconnectMethod(providerId: string, methodId: string): Promise<void> {
  if (methodId === 'personal-api-key') {
    await deletePersonalKey(providerId);
    await syncProviders();
    return;
  }
  const method = findCatalogMethod(providerId, methodId);
  if (!method) throw new Error(`Unknown method '${methodId}' for provider '${providerId}'.`);
  if (method.kind !== 'local-runtime' || method.source !== 'personal') {
    throw new Error('This connection is managed by your organisation and can only be changed by an administrator.');
  }
  await setMethodDismissed(providerId, methodId, true);
  await syncProviders();
}

/**
 * Re-enables a previously in-app-disconnected `local-runtime` method. Not
 * meaningful for `personal-api-key` (reconnecting there is just connecting a
 * key again via connectPersonalKey) or organisation methods (never
 * disconnectable in the first place).
 */
export async function reconnectMethod(providerId: string, methodId: string): Promise<void> {
  const method = findCatalogMethod(providerId, methodId);
  if (!method || method.kind !== 'local-runtime' || method.source !== 'personal') {
    throw new Error(`'${methodId}' isn't a reconnectable local sign-in for provider '${providerId}'.`);
  }
  await setMethodDismissed(providerId, methodId, false);
  await syncProviders();
}
