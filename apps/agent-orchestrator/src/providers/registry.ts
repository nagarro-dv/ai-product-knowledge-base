import type { AiProviderAdapter } from './types.js';

/**
 * Registry of runnable adapters, keyed by provider family and auth method.
 *
 * A provider (e.g. 'claude') may register several adapters, one per
 * authentication method (e.g. 'api-key' via the Anthropic API, 'claude-code'
 * via the local Claude Code runtime). Job requests address adapters by
 * `providerId` plus an optional `authMethodId`; when the method is omitted the
 * provider's first registered adapter wins, so registration order defines the
 * default.
 */
const adaptersByProvider = new Map<string, AiProviderAdapter[]>();

/**
 * Drops every registered adapter so the catalog can be rebuilt from scratch
 * (used when re-syncing provider state on demand). Safe with in-flight jobs:
 * `runJob()` resolves its adapter once at job start and keeps that reference,
 * so clearing the map does not affect a run already in progress.
 */
export function clearAdapters(): void {
  adaptersByProvider.clear();
}

export function registerAdapter(adapter: AiProviderAdapter): void {
  const list = adaptersByProvider.get(adapter.providerId) ?? [];
  const existingIndex = list.findIndex((entry) => entry.authMethod.id === adapter.authMethod.id);
  if (existingIndex >= 0) {
    list[existingIndex] = adapter;
  } else {
    list.push(adapter);
  }
  adaptersByProvider.set(adapter.providerId, list);
}

export function getAdapter(providerId: string, authMethodId?: string): AiProviderAdapter | undefined {
  const list = adaptersByProvider.get(providerId);
  if (!list || list.length === 0) return undefined;
  if (!authMethodId) return list[0];
  return list.find((entry) => entry.authMethod.id === authMethodId);
}

export function requireAdapter(providerId: string, authMethodId?: string): AiProviderAdapter {
  const adapter = getAdapter(providerId, authMethodId);
  if (!adapter) {
    throw new Error(
      authMethodId
        ? `AI provider '${providerId}' has no registered '${authMethodId}' authentication method.`
        : `AI provider '${providerId}' is not registered.`,
    );
  }
  return adapter;
}

export function listAdapters(): AiProviderAdapter[] {
  return [...adaptersByProvider.values()].flat();
}

export type ProviderGroup = {
  providerId: string;
  providerLabel: string;
  adapters: AiProviderAdapter[];
};

export function listProviderGroups(): ProviderGroup[] {
  return [...adaptersByProvider.entries()].map(([providerId, adapters]) => ({
    providerId,
    providerLabel: adapters[0]?.providerLabel ?? providerId,
    adapters: [...adapters],
  }));
}
