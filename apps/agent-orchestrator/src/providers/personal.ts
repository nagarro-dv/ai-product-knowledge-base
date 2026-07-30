import type { AiProviderAdapter } from './types.js';

/**
 * Re-brands an existing adapter instance as the provider's personal-API-key
 * method. The runtime behavior (initialize/runJob/health) is untouched — only
 * the identity changes, so the registry can hold the organisation-managed and
 * the personal variant of the same provider side by side, each constructed
 * with its own credential.
 */
export function asPersonalKeyMethod(adapter: AiProviderAdapter): AiProviderAdapter {
  return {
    id: `${adapter.providerId}:personal-api-key`,
    providerId: adapter.providerId,
    providerLabel: adapter.providerLabel,
    label: `${adapter.providerLabel} (your API key)`,
    authMethod: {
      id: 'personal-api-key',
      label: 'Your API key',
      kind: 'api-key',
      source: 'personal',
      description:
        'Uses an API key you connect yourself. Stored securely on this computer and billed to your own account.',
    },
    capabilities: adapter.capabilities,
    initialize: () => adapter.initialize(),
    runJob: (input) => adapter.runJob(input),
    health: () => adapter.health(),
  };
}
