/** Browser client for the Figma MCP integration endpoints (see agent-orchestrator FigmaIntegration.ts). */

export type FigmaAccount = {
  email?: string;
  team?: string;
};

export type FigmaSummary = {
  status: "not-connected" | "needs-auth" | "connected" | "cli-missing" | "network-error" | "error";
  mcpUrl?: string;
  /** The exact terminal command to run — always `claude mcp login figma`, server-provided so the frontend never hardcodes it. */
  loginCommand?: string;
  lastCheckedAt?: number;
  lastConnectedAt?: number;
  /** Epoch ms of the last successful "Test connection" real MCP round trip. */
  lastVerifiedAt?: number;
  account?: FigmaAccount;
  error?: string;
  /** Raw CLI diagnostic text — only ever shown behind an explicit "Advanced diagnostics" disclosure. */
  diagnostic?: string;
};

function agentOrigin(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // ignore
  }
  return response.statusText;
}

/** Registers the Figma MCP server (fast, side-effect-free) so the user can then sign in themselves — see FigmaIntegration.ts for why the sign-in step itself is never run on their behalf. */
export async function connectFigma(): Promise<FigmaSummary> {
  const response = await fetch(`${agentOrigin()}/api/integrations/figma/connect`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: FigmaSummary };
  return parsed.summary;
}

export async function recheckFigma(): Promise<FigmaSummary> {
  const response = await fetch(`${agentOrigin()}/api/integrations/figma/recheck`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: FigmaSummary };
  return parsed.summary;
}

/** Clears the stored Figma sign-in without forgetting the server itself — Reconnect never needs to re-register it. */
export async function disconnectFigma(): Promise<FigmaSummary> {
  const response = await fetch(`${agentOrigin()}/api/integrations/figma/disconnect`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: FigmaSummary };
  return parsed.summary;
}

/** Runs a real, read-only MCP round trip (calls Figma's own `whoami` tool) to actually verify communication, not just registration status. */
export async function testFigmaConnection(): Promise<FigmaSummary> {
  const response = await fetch(`${agentOrigin()}/api/integrations/figma/test`, { method: "POST" });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const parsed = (await response.json()) as { summary: FigmaSummary };
  return parsed.summary;
}
