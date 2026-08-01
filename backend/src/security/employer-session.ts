import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { isProduction } from "./config";
import { issueCsrfToken } from "./session";

/**
 * Sessions for the employer portal — a company's own multi-seat login.
 *
 * A DIFFERENT cookie from the customer session (session.ts) and from the
 * staff/demo sessions (staff-session.ts), for the same reason those two are
 * kept apart from each other: an employer team member must never be one
 * cookie-name collision away from holding a customer session or a PayBridge
 * staff session. Same construction throughout — HttpOnly, Secure, SameSite=Lax,
 * `__Host-` in production, HMAC-SHA256 with a constant-time compare, absolute
 * + idle expiry, a fresh id on every sign-in. See session.ts for the full
 * rationale; it is not repeated here.
 *
 * The double-submit CSRF token is shared across all three session types
 * (`issueCsrfToken`/`verifyCsrfToken` in session.ts) — it is not tied to any
 * one audience, only to "does a form submission carry the value our own page
 * set". `verifyCsrfToken` needs no changes here; `csrfProtection` just needs
 * this cookie's name added to the list of cookies that trigger enforcement
 * (see index.ts).
 */

const COOKIE_NAME = isProduction ? "__Host-pb_employer_session" : "pb_employer_session";

const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
const IDLE_TTL_MS = 30 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  return devSecret;
}
const devSecret = randomBytes(48).toString("base64");

export interface EmployerSessionPayload {
  sid: string;
  /** Subject: EmployerUser.id. */
  sub: string;
  employerId: string;
  role: string;
  iat: number;
  seen: number;
  /** EmployerUser.sessionEpoch at mint time — see session.ts for why this exists. */
  epoch: number;
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

function encode(payload: EmployerSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined): EmployerSessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!safeEqual(mac, sign(body))) return null;

  let payload: EmployerSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EmployerSessionPayload;
  } catch {
    return null;
  }

  const now = Date.now();
  if (now - payload.iat > ABSOLUTE_TTL_MS) return null;
  if (now - payload.seen > IDLE_TTL_MS) return null;
  return payload;
}

export function issueEmployerSession(
  c: Context,
  user: { id: string; employerId: string; role: string; epoch: number },
): EmployerSessionPayload {
  const now = Date.now();
  const payload: EmployerSessionPayload = {
    sid: randomBytes(24).toString("base64url"),
    sub: user.id,
    employerId: user.employerId,
    role: user.role,
    iat: now,
    seen: now,
    epoch: user.epoch,
  };
  writeCookie(c, payload);
  issueCsrfToken(c);
  return payload;
}

export function touchEmployerSession(c: Context, payload: EmployerSessionPayload): void {
  writeCookie(c, { ...payload, seen: Date.now() });
}

function writeCookie(c: Context, payload: EmployerSessionPayload): void {
  setCookie(c, COOKIE_NAME, encode(payload), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_TTL_MS / 1000),
  });
}

export function readEmployerSession(c: Context): EmployerSessionPayload | null {
  return decode(getCookie(c, COOKIE_NAME));
}

export function clearEmployerSession(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: "/", secure: isProduction, sameSite: "Lax" });
}

export const EMPLOYER_SESSION_COOKIE = COOKIE_NAME;

/* --------------------------------------------------------- INVITE TOKENS */

/**
 * A stateless, signed invitation link: `<employerUserId>.<expiry>.<hmac>`.
 *
 * WHY stateless rather than a stored token: EmployerUser has no token column
 * (adding one is a migration this pass avoids), and a signed, self-expiring
 * value needs nowhere to live — the signature IS the proof. Anyone holding the
 * link can accept the invite, which is the same trust model as the demo
 * invitation codes and the KYC verification links: possession of the link is
 * possession of the invitation.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function signEmployerInvite(employerUserId: string): string {
  const expires = Date.now() + INVITE_TTL_MS;
  const body = `${employerUserId}.${expires}`;
  return `${body}.${sign(body)}`;
}

export function verifyEmployerInvite(token: string): { employerUserId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [employerUserId, expiresRaw, mac] = parts;
  const body = `${employerUserId}.${expiresRaw}`;
  if (!safeEqual(mac!, sign(body))) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  if (!employerUserId) return null;
  return { employerUserId };
}
