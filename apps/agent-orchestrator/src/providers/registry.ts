import type { AiProviderAdapter } from './types.js';

const adapters = new Map<string, AiProviderAdapter>();

export function registerAdapter(adapter: AiProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: string): AiProviderAdapter | undefined {
  return adapters.get(id);
}

export function requireAdapter(id: string): AiProviderAdapter {
  const adapter = adapters.get(id);
  if (!adapter) {
    throw new Error(`AI provider '${id}' is not registered.`);
  }
  return adapter;
}

export function listAdapters(): AiProviderAdapter[] {
  return [...adapters.values()];
}
