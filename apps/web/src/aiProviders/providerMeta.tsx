import type { ComponentType } from "react";
import type { AgentProvider } from "../agentSseClient";
import { ClaudeLogo, CursorLogo, GeminiLogo, OpenAILogo } from "./providerLogos";

export type ProviderIconComponent = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

/** Shared between the AI Models settings page and the Accelerator's provider picker. */
export const PROVIDER_ICONS: Record<string, ProviderIconComponent> = {
  cursor: CursorLogo,
  claude: ClaudeLogo,
  openai: OpenAILogo,
  gemini: GeminiLogo,
};

export type ProviderRowStatus = "connected" | "attention" | "not-connected";

export function providerRowStatus(provider: AgentProvider): ProviderRowStatus {
  const methods = provider.authMethods ?? [];
  if (methods.some((m) => m.ok)) return "connected";
  if (methods.some((m) => m.status === "unavailable")) return "attention";
  return "not-connected";
}
