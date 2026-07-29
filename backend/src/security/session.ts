import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { isProduction } from "./config";

/**
 * Server-authoritative session handling.
 *
 * The current app ships a *prototype* client-side session (see
 * webapp/src/lib/auth). This module is the server-side replacement: it is the
 * only place that decides who a caller is, and it is wired into `requireSession`
 * so real routes can adopt it without redesigning anything.
 *
 * DESIGN DECISIONS AND WHY
 *
 * 1. Cookie, not localStorage.
 *    A token in localStorage is readable by any JavaScript on the page, so a
 *    single XSS anywhere in a 100-page dashboard equals full account takeover
 *    with no way to detect or revoke it. An HttpOnly cookie is not reachable
 *    from JS at all, which downgrades the same XSS from "steal the session" to
 *    "act inside the current tab".
 *
 * 2. HttpOnly + Secure + SameSite=Lax + Path=/ + __Host- prefix.
 *    - HttpOnly: blocks script access (see 1).
 *    - Secure: never sent over plaintext HTTP, so a hostile network cannot lift
 *      it. Payroll data over cleartext is not defensible.
 *    - SameSite=Lax: the browser will not attach the cookie to cross-site POSTs,
 *      which kills the classic CSRF vector while still allowing top-level
 *      navigation from email links (a Strict cookie makes "click the link in
 *      your payslip email" land you on a logged-out page).
 *    - __Host- prefix: the browser refuses to accept the cookie unless it is
 *      Secure, Path=/ and has NO Domain attribute. That prevents a compromised
 *      or attacker-registered sibling subdomain from *writing* a session cookie
 *      into our namespace — the standard session-fixation-by-subdomain attack.
 *      Dropped in dev because the prefix requires HTTPS.
 *
 * 3. Signed, self-describing token — id.payload.hmac.
 *    HMAC-SHA256 over the payload with a server-only secret, verified with a
 *    constant-time compare. Constant-time matters: a byte-by-byte `===` leaks
 *    the correct signature through timing, one byte at a time.
 *
 * 4. Absolute expiry AND idle expiry.
 *    Absolute (12h) caps the blast radius of a stolen token no matter how much
 *    the attacker keeps it warm. Idle (30m) logs out the unattended shared
 *    machine — a real risk in an HR office. Either alone leaves a hole.
 *
 * 5. Rotation on every privilege transition.
 *    `issueSession` always mints a NEW session id, and `rotateSession` is called
 *    after login, after MFA, and after any role change. This is the fix for
 *    session fixation: an attacker who plants a known session id before login
 *    holds a dead id after it.
 */

const COOKIE_NAME = isProduction ? "__Host-pb_session" : "pb_session";
const CSRF_COOKIE_NAME = isProduction ? "__Host-pb_csrf" : "pb_csrf";

/** 12 hours: long enough for a working day, short enough to bound theft. */
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
/** 30 minutes of inactivity. */
const IDLE_TTL_MS = 30 * 60 * 1000;

/**
 * WHY fail-fast in production: a session secret that silently defaults to a
 * constant means every deployment shares a signing key and anyone can forge an
 * admin session. Refusing to boot is the correct, loud failure.
 */
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  // Dev only: ephemeral per-process key. Restarting invalidates sessions, which
  // is exactly what you want locally — it can never leak into production use.
  return devSecret;
}
const devSecret = randomBytes(48).toString("base64");

export interface SessionPayload {
  /** Session id — rotated on every privilege change. */
  sid: string;
  /** Subject: the user id. */
  sub: string;
  role: string;
  /** Issued at (ms). */
  iat: number;
  /** Last seen (ms) — drives idle expiry. */
  seen: number;
  /** Has the second factor been satisfied for this session? */
  mfa: boolean;
  /**
   * The account's `sessionEpoch` at the moment this token was minted.
   *
   * WHY a signed cookie needs this: the token is self-contained, so once issued
   * the server has no record of it and nothing to delete. Comparing this number
   * against the current value in the database on every request is the only way
   * "sign out everywhere", "your password changed" and "this account is now
   * suspended" can take effect before the token's own expiry. Bumping the
   * account's counter invalidates every token ever issued for it, at once.
   */
  epoch?: number;
}

function sign(data: string): string {
  return createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!safeEqual(mac, sign(body))) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }

  const now = Date.now();
  if (now - payload.iat > ABSOLUTE_TTL_MS) return null; // absolute expiry
  if (now - payload.seen > IDLE_TTL_MS) return null; // idle expiry
  return payload;
}

/** Mint a brand-new session. Always used on login — never reuse an inbound id. */
export function issueSession(
  c: Context,
  user: { id: string; role: string; mfa?: boolean; epoch?: number },
): SessionPayload {
  const now = Date.now();
  const payload: SessionPayload = {
    sid: randomBytes(24).toString("base64url"),
    sub: user.id,
    role: user.role,
    iat: now,
    seen: now,
    mfa: user.mfa ?? false,
    epoch: user.epoch,
  };
  writeSessionCookie(c, payload);
  issueCsrfToken(c);
  return payload;
}

/** Re-mint the id while keeping the identity — call after MFA or role change. */
export function rotateSession(c: Context, current: SessionPayload, patch: Partial<SessionPayload> = {}): SessionPayload {
  const next: SessionPayload = {
    ...current,
    ...patch,
    sid: randomBytes(24).toString("base64url"),
    seen: Date.now(),
  };
  writeSessionCookie(c, next);
  issueCsrfToken(c);
  return next;
}

/** Slide the idle window forward on an authenticated request. */
export function touchSession(c: Context, payload: SessionPayload): void {
  writeSessionCookie(c, { ...payload, seen: Date.now() });
}

function writeSessionCookie(c: Context, payload: SessionPayload): void {
  setCookie(c, COOKIE_NAME, encode(payload), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    // No `domain`: scoping the cookie to the exact host stops sibling
    // subdomains from reading it, and is required by the __Host- prefix.
    maxAge: Math.floor(ABSOLUTE_TTL_MS / 1000),
  });
}

export function readSession(c: Context): SessionPayload | null {
  return decodeSession(getCookie(c, COOKIE_NAME));
}

export function clearSession(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: "/", secure: isProduction, sameSite: "Lax" });
  deleteCookie(c, CSRF_COOKIE_NAME, { path: "/", secure: isProduction, sameSite: "Lax" });
}

/**
 * Double-submit CSRF token.
 *
 * WHY on top of SameSite=Lax: SameSite is a browser-enforced control, and the
 * set of browsers is not ours to choose. Older WebViews, some embedded
 * browsers, and any future relaxation of the default leave a gap. The
 * double-submit token is enforced by *us*: the value lives in a non-HttpOnly
 * cookie AND must be echoed in the X-CSRF-Token header. A cross-site attacker
 * can cause the cookie to be sent but cannot read it (same-origin policy) and
 * therefore cannot set the matching header. Two independent controls, one
 * browser-side and one server-side, is the point.
 */
export function issueCsrfToken(c: Context): string {
  const token = randomBytes(24).toString("base64url");
  setCookie(c, CSRF_COOKIE_NAME, token, {
    httpOnly: false, // deliberately readable — the SPA must echo it in a header
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_TTL_MS / 1000),
  });
  return token;
}

export function verifyCsrfToken(c: Context): boolean {
  const cookie = getCookie(c, CSRF_COOKIE_NAME);
  const header = c.req.header("x-csrf-token");
  if (!cookie || !header) return false;
  return safeEqual(cookie, header);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const CSRF_COOKIE = CSRF_COOKIE_NAME;
