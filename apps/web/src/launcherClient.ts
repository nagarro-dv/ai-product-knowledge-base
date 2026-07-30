/**
 * Browser client for the local launcher (apps/launcher) — the small always-on
 * process that supervises the agent-orchestrator so the frontend can ask for
 * a restart without anyone opening a terminal. See apps/launcher/src/index.ts
 * for why this has to be a separate process rather than something the agent
 * server (or the browser) does to itself.
 */

export type LauncherStatus = {
  state: "starting" | "running" | "crashed" | "stopped";
  pid: number | null;
  startedAt: number | null;
  lastExitCode: number | null;
  lastExitSignal: string | null;
  logsTail: string[];
};

function launcherOrigin(): string {
  const envOrigin = import.meta.env.VITE_LAUNCHER_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:4321" : "");
}

function agentOrigin(): string {
  const envOrigin = import.meta.env.VITE_AGENT_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  return envOrigin || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
}

/** True only if the launcher itself is reachable — false means the user isn't running `npm run dev`. */
export async function isLauncherAvailable(): Promise<boolean> {
  const origin = launcherOrigin();
  if (!origin) return false;
  try {
    const res = await fetch(`${origin}/status`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLauncherStatus(): Promise<LauncherStatus | null> {
  const origin = launcherOrigin();
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}/status`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    return (await res.json()) as LauncherStatus;
  } catch {
    return null;
  }
}

/** Asks the launcher to (re)spawn the agent process. Returns false if the launcher itself can't be reached. */
export async function restartAssistantService(): Promise<boolean> {
  const origin = launcherOrigin();
  if (!origin) return false;
  try {
    const res = await fetch(`${origin}/restart`, { method: "POST", signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Polls the agent's own health endpoint until it responds or the timeout elapses. */
export async function waitForAssistantService(timeoutMs: number): Promise<boolean> {
  const origin = agentOrigin();
  if (!origin) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/api/agent/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return true;
    } catch {
      // not up yet — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}
