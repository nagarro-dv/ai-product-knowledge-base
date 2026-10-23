/*
 * The hosted site's password gate (shared by the Netlify Functions).
 *
 * One password for everyone, set as APP_PASSWORD in the Netlify site's
 * environment variables — never in the code. Entering it sets an HttpOnly
 * cookie holding an HMAC of a fixed label keyed by the password, so the
 * cookie can be checked without storing sessions, and changing the password
 * signs everyone out. With no APP_PASSWORD set, nothing unlocks (fail closed).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "aikb_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const appPassword = (): string => (process.env.APP_PASSWORD ?? "").trim();

const token = (password: string) => createHmac("sha256", password).update("aikb-session-v1").digest("hex");

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Whether `input` is the site password (compared in constant time). */
export function passwordMatches(input: string): boolean {
  const password = appPassword();
  return !!password && sameText(token(input), token(password));
}

/** Whether the request carries a valid session cookie. */
export function hasSession(request: Request): boolean {
  const password = appPassword();
  if (!password) return false;
  const cookies = request.headers.get("cookie") ?? "";
  const value = /(?:^|;\s*)aikb_session=([a-f0-9]+)/.exec(cookies)?.[1];
  return !!value && sameText(value, token(password));
}

/** The Set-Cookie header that unlocks the site for 30 days. */
export function sessionCookie(): string {
  return `${COOKIE}=${token(appPassword())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}
