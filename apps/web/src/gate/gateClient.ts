/*
 * Talks to the hosted site's password gate (netlify/functions/auth.mts).
 * Only production builds are gated — `npm run dev` opens straight into the app.
 */

export const GATE_ENABLED = !import.meta.env.DEV;

/** Whether this browser already has the unlock cookie. */
export async function isUnlocked(): Promise<boolean> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    if (!res.ok) return false;
    return ((await res.json()) as { unlocked?: boolean }).unlocked === true;
  } catch {
    return false;
  }
}

/** Tries the password; resolves on success, throws with the reason to show otherwise. */
export async function unlock(password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error("Couldn't check the password — try again in a moment.");
  }
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? "Couldn't check the password — try again in a moment.");
}
