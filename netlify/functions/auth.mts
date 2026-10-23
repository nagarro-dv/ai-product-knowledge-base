/*
 * The hosted site's password gate: GET /api/session says whether this
 * browser is unlocked; POST /api/unlock { password } unlocks it with a
 * cookie. See netlify/shared/session.ts.
 */
import { appPassword, hasSession, passwordMatches, sessionCookie } from "../shared/session";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

export default async (request: Request): Promise<Response> => {
  const { pathname } = new URL(request.url);

  if (request.method === "GET" && pathname === "/api/session") {
    return json(200, { unlocked: hasSession(request) });
  }

  if (request.method === "POST" && pathname === "/api/unlock") {
    if (!appPassword()) return json(503, { error: "The password isn't set up on this site yet." });
    let password = "";
    try {
      password = String(((await request.json()) as { password?: unknown }).password ?? "");
    } catch {
      return json(400, { error: "Invalid request." });
    }
    if (!passwordMatches(password)) {
      // A short pause on every wrong guess makes guessing slow.
      await new Promise((resolve) => setTimeout(resolve, 600));
      return json(401, { error: "That password isn't right." });
    }
    return json(200, { unlocked: true }, { "Set-Cookie": sessionCookie() });
  }

  return json(404, { error: "Not found." });
};

export const config = {
  path: ["/api/session", "/api/unlock"],
};
