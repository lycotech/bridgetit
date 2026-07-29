import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { isProduction } from "./config";
import { audit } from "./audit";
import { issueCsrfToken } from "./session";

/**
 * Sessions for the two NON-PUBLIC surfaces: the admin dashboard and the
 * private demonstration environment.
 *
 * These are separate from the customer session in `session.ts` on purpose. A
 * demo viewer must never be one cookie-name collision away from holding an
 * admin session, and an admin session must not be minted by the same code path
 * that hands out demo access to an invited prospect. Different cookie, different
 * audience claim, verified on every request.
 *
 * Same construction as the customer session and for the same reasons:
 * HttpOnly (an XSS cannot read it), Secure, SameSite=Lax, `__Host-` prefix in
 * production (no sibling subdomain can write into our namespace), HMAC-SHA256
 * with a constant-time compare (a byte-wise `===` leaks the signature through
 * timing), and both an absolute and an idle expiry.
 */

type Audience = "admin" | "demo";

const COOKIES: Record<Audience, string> = {
  admin: isProduction ? "__Host-pb_admin" : "pb_admin",
  demo: isProduction ? "__Host-pb_demo" : "pb_demo",
};

/** Admin: a working session, capped. Demo: long enough for a meeting. */
const ABSOLUTE_TTL_MS: Record<Audience, number> = {
  admin: 8 * 60 * 60 * 1000,
  demo: 4 * 60 * 60 * 1000,
};
const IDLE_TTL_MS: Record<Audience, number> = {
  admin: 30 * 60 * 1000,
  demo: 60 * 60 * 1000,
};

const devSecret = randomBytes(48).toString("base64");

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 48",
    );
  }
  return devSecret;
}

export interface StaffSession {
  aud: Audience;
  sid: string;
  /** Who: admin email/username, or the invited email for a demo viewer. */
  sub: string;
  /** Which demo invitation opened this session, if any. */
  inv?: string;
  /** Which portal a demo session may view. Absent = all. */
  portal?: string;
  iat: number;
  seen: number;

  /* ---------------- Admin-only claims (absent on a demo session) ----------- */
  /**
   * AdminUser.id. Absent for the legacy environment-variable administrator,
   * which is why every consumer must treat it as optional rather than assuming
   * a database row exists.
   */
  uid?: string;
  /** AdminRole at the time the session was minted. See admin-roles.ts. */
  role?: string;
  /**
   * AdminUser.sessionEpoch when the cookie was signed. Compared against the
   * current row on every request; a mismatch kills the session.
   *
   * WHY this is the only way to revoke: these cookies are self-contained and
   * verified by signature alone, so nothing about a password change would
   * otherwise reach a session already in someone's browser. The epoch turns
   * "sign every other session out" from a claim into a fact.
   */
  epoch?: number;
  /** Has the second factor been satisfied for THIS session? */
  mfa?: boolean;
  /**
   * True while the administrator still owes a first-run step (password change,
   * MFA enrolment, recovery address, policy acceptance). A session in this state
   * can reach the onboarding routes and nothing else.
   */
  onboarding?: boolean;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function encode(payload: StaffSession): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined, audience: Audience): StaffSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), sign(body))) return null;

  let payload: StaffSession;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StaffSession;
  } catch {
    return null;
  }

  /*
   * Verify the audience claim. WHY: without it, a valid demo cookie replayed
   * into the admin cookie slot would decode and verify perfectly — same secret,
   * same format. The audience is what makes the two token families genuinely
   * non-interchangeable rather than merely differently named.
   */
  if (payload.aud !== audience) return null;

  const now = Date.now();
  if (now - payload.iat > ABSOLUTE_TTL_MS[audience]) return null;
  if (now - payload.seen > IDLE_TTL_MS[audience]) return null;
  return payload;
}

function write(c: Context, payload: StaffSession): void {
  setCookie(c, COOKIES[payload.aud], encode(payload), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_TTL_MS[payload.aud] / 1000),
  });
}

export function issueStaffSession(
  c: Context,
  input: {
    aud: Audience;
    sub: string;
    inv?: string;
    portal?: string;
    uid?: string;
    role?: string;
    epoch?: number;
    mfa?: boolean;
    onboarding?: boolean;
  },
): StaffSession {
  const now = Date.now();
  // A fresh session id every time. An attacker who plants a known id before
  // login holds a dead id after it — the fix for session fixation.
  const payload: StaffSession = {
    aud: input.aud,
    sid: randomBytes(24).toString("base64url"),
    sub: input.sub,
    inv: input.inv,
    portal: input.portal,
    uid: input.uid,
    role: input.role,
    epoch: input.epoch,
    mfa: input.mfa,
    onboarding: input.onboarding,
    iat: now,
    seen: now,
  };
  write(c, payload);
  /*
   * Mint the double-submit CSRF token alongside the session.
   *
   * WHY here and not left to the caller: from the moment this cookie exists,
   * `csrfProtection` requires the matching X-CSRF-Token header on every unsafe
   * method. Without issuing the token in the same breath as the session, the
   * admin would log in successfully and then have every subsequent PATCH
   * rejected — and the tempting "fix" is to drop the cookie from the CSRF
   * check, which is the wrong direction entirely.
   */
  issueCsrfToken(c);
  return payload;
}

export function readStaffSession(c: Context, audience: Audience): StaffSession | null {
  return decode(getCookie(c, COOKIES[audience]), audience);
}

export function clearStaffSession(c: Context, audience: Audience): void {
  deleteCookie(c, COOKIES[audience], { path: "/", secure: isProduction, sameSite: "Lax" });
}

declare module "hono" {
  interface ContextVariableMap {
    staff?: StaffSession;
  }
}

/**
 * Rotate an existing admin session in place — same identity, new session id.
 *
 * Called after every privilege transition: MFA satisfied, password changed,
 * onboarding finished. WHY rotate rather than patch: a session id that survives
 * a privilege change is the session-fixation bug. Re-minting means a token
 * captured before the change cannot be replayed after it.
 */
export function rotateStaffSession(c: Context, current: StaffSession, patch: Partial<StaffSession> = {}): StaffSession {
  const next: StaffSession = {
    ...current,
    ...patch,
    sid: randomBytes(24).toString("base64url"),
    seen: Date.now(),
  };
  write(c, next);
  issueCsrfToken(c);
  return next;
}

/**
 * Gate for the admin dashboard API.
 *
 * Signature validity is necessary but not sufficient. This also re-checks the
 * live AdminUser row on every request, because everything that makes a session
 * *stop* being valid lives there: the account was suspended, the password
 * changed, the role changed. A self-contained cookie knows none of that.
 *
 * The database read per request is a deliberate cost. The alternative — trusting
 * the claims in the cookie until it expires — means a suspended administrator
 * keeps working for up to eight hours, which is not a defensible answer to
 * "we removed their access immediately".
 *
 * `options.allowOnboarding` lets the first-run routes (change password, enrol
 * MFA, accept policy) run for a session that is otherwise not yet trusted.
 * Everything else refuses until onboarding is finished.
 */
export function requireAdmin(options: { allowOnboarding?: boolean } = {}): MiddlewareHandler {
  return async (c, next) => {
    const session = readStaffSession(c, "admin");
    if (!session) {
      return c.json({ error: { message: "Authentication required.", code: "UNAUTHENTICATED" } }, 401);
    }

    /*
     * Database-backed administrators carry `uid`. Re-read the row and confirm
     * the session is still entitled to exist.
     *
     * Imported lazily. WHY: this module is imported by index.ts before the
     * routes, and a top-level import of the Prisma client here would pull the
     * database into the security module's import graph, making it impossible to
     * unit-test session decoding without a database.
     */
    if (session.uid) {
      const { prisma } = await import("../db");
      const admin = await prisma.adminUser
        .findUnique({
          where: { id: session.uid },
          select: { id: true, email: true, role: true, status: true, sessionEpoch: true },
        })
        .catch(() => null);

      if (!admin || admin.status !== "active") {
        clearStaffSession(c, "admin");
        audit({
          action: "admin.session.rejected",
          actor: session.sub,
          outcome: "denied",
          detail: { reason: admin ? "account_not_active" : "account_missing" },
        });
        return c.json(
          { error: { message: "Your access has been withdrawn. Contact a Super Admin.", code: "ACCOUNT_INACTIVE" } },
          403,
        );
      }

      if (admin.sessionEpoch !== session.epoch) {
        clearStaffSession(c, "admin");
        audit({
          action: "admin.session.rejected",
          actor: session.sub,
          outcome: "denied",
          detail: { reason: "epoch_mismatch" },
        });
        return c.json(
          { error: { message: "Your password or role changed. Please sign in again.", code: "SESSION_STALE" } },
          401,
        );
      }

      /*
       * The role is re-read from the row rather than trusted from the cookie.
       * A role demotion must take effect on the next request, not at the next
       * sign-in — and the cookie's copy is, by definition, the stale one.
       */
      session.role = admin.role;
    }

    if (session.onboarding && !options.allowOnboarding) {
      return c.json(
        {
          error: {
            message: "Complete your account setup before continuing.",
            code: "ONBOARDING_REQUIRED",
          },
        },
        403,
      );
    }

    c.set("staff", session);
    write(c, { ...session, seen: Date.now() }); // slide the idle window
    await next();
  };
}

/**
 * Require a specific admin permission on top of a valid session.
 *
 * Server-side and authoritative. The portal hides sections a role cannot use,
 * but that only removes the button — this is what removes the capability.
 *
 * Returns 403 rather than 404: unlike the demo environment, the existence of
 * the admin API is not the secret (it is behind a login the user has already
 * passed), and a signed-in administrator hitting a wall needs to know it is a
 * permission problem so they ask for access instead of filing a bug.
 */
export function requireAdminPermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const session = c.get("staff");
    const { adminCan } = await import("./admin-roles");

    /*
     * The environment-variable administrator (no `uid`, no `role`) is treated as
     * a Super Admin break-glass account. It exists so a deployment whose admin
     * table is empty or locked out is recoverable, and it is the reason
     * `role ?? "super_admin"` is not simply a permissive default: a session that
     * reached this point already proved the env credential, which is itself the
     * highest-trust secret the deployment holds.
     */
    const role = session?.role ?? (session?.uid ? undefined : "super_admin");

    if (!adminCan(role, permission as never)) {
      audit({
        action: "admin.permission.denied",
        actor: session?.sub ?? "anonymous",
        actorRole: role,
        outcome: "denied",
        target: permission,
        requestId: c.get("requestId"),
      });
      return c.json(
        {
          error: {
            message: "Your role does not allow that action.",
            code: "FORBIDDEN",
          },
        },
        403,
      );
    }
    await next();
  };
}

/** Gate for the private demonstration environment. */
export function requireDemoAccess(): MiddlewareHandler {
  return async (c, next) => {
    // An admin is implicitly allowed to view the demo they hand out.
    const admin = readStaffSession(c, "admin");
    const demo = admin ?? readStaffSession(c, "demo");
    if (!demo) {
      return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
    }
    c.set("staff", demo);
    write(c, { ...demo, seen: Date.now() });
    await next();
  };
}

/* ------------------------------------------------------- ADMIN CREDENTIALS */

/**
 * Admin credentials come from the environment. There is no user table and no
 * self-service registration for this dashboard, because every account that can
 * be created is an account that can be created by an attacker.
 *
 * ADMIN_PASSWORD_HASH holds sha256(password) as hex. WHY a hash and not the
 * password: the value sits in a deployment config that is read by CI, visible
 * in a dashboard, and often pasted into chat. A hash there is still sensitive
 * but is not directly replayable against anything else the person reuses.
 *
 * Plain ADMIN_PASSWORD is accepted as a convenience for local development only
 * and is refused in production.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface AdminCheck {
  ok: boolean;
  /** Set when the deployment has no admin credential configured at all. */
  unconfigured?: boolean;
}

export function verifyAdminCredentials(username: string, password: string): AdminCheck {
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const expectedHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const plain = process.env.ADMIN_PASSWORD ?? "";

  if (!expectedUser || (!expectedHash && !plain)) {
    audit({ action: "admin.login.unconfigured", actor: "anonymous", outcome: "denied" });
    return { ok: false, unconfigured: true };
  }
  if (plain && isProduction && !expectedHash) {
    // Refuse to authenticate against a plaintext password in production.
    audit({ action: "admin.login.plaintext_refused", actor: "anonymous", outcome: "denied" });
    return { ok: false, unconfigured: true };
  }

  const wanted = expectedHash || sha256Hex(plain);

  /*
   * Compare BOTH fields with a constant-time compare, and always compare both
   * even when the username is already wrong. Short-circuiting on a bad username
   * makes the response measurably faster for unknown users than for known ones,
   * which is a username-enumeration oracle.
   */
  const userOk = safeEqual(sha256Hex(username.trim().toLowerCase()), sha256Hex(expectedUser.trim().toLowerCase()));
  // `wanted` is ALREADY a sha256 digest, so the submitted password has to be
  // digested once to be comparable — and both sides are then digested again so
  // the compared buffers are always the same length regardless of input.
  const passOk = safeEqual(sha256Hex(sha256Hex(password)), sha256Hex(wanted));
  return { ok: userOk && passOk };
}

export const ADMIN_COOKIE = COOKIES.admin;
export const DEMO_COOKIE = COOKIES.demo;
