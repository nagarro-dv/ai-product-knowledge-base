import type { AgentAuthMethod, AgentProvider } from "../agentSseClient";

/**
 * Per-provider auth-method preference, chosen on the AI Providers page and
 * applied to every run. Stored client-side: the server is stateless about
 * user choices, and the preference only selects among methods the server
 * actually has connected.
 */
const STORAGE_KEY = "ds-accelerator-auth-methods";
const CHANGE_EVENT = "ds-auth-preferences-changed";

type PreferenceMap = Record<string, string>;

function readAll(): PreferenceMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as PreferenceMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function getPreferredAuthMethod(providerId: string): string | null {
  return readAll()[providerId] ?? null;
}

export function setPreferredAuthMethod(providerId: string, authMethodId: string): void {
  try {
    const all = readAll();
    all[providerId] = authMethodId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable — the preference just won't persist.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function subscribeAuthPreferences(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The auth method that will actually be used for a provider: the stored
 * preference when that method is connected, otherwise the provider default.
 * Returns null when the provider has no usable method.
 */
export function resolveActiveAuthMethod(provider: AgentProvider | undefined): AgentAuthMethod | null {
  if (!provider?.authMethods?.length) return null;
  const connected = provider.authMethods.filter((method) => method.ok);
  if (connected.length === 0) return null;
  const preferred = getPreferredAuthMethod(provider.id);
  const match =
    (preferred && connected.find((method) => method.id === preferred)) ||
    connected.find((method) => method.id === provider.defaultAuthMethod) ||
    connected[0];
  return match ?? null;
}
