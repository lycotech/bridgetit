import type { Context, MiddlewareHandler, Next } from "hono";
import { readSession, touchSession, type SessionPayload } from "./session";
import { hasPermission, portalFor, isRole, type Permission } from "./rbac";
import { audit } from "./audit";

/**
 * API authentication and authorisation middleware.
 *
 * WHY authentication and authorisation are separate middlewares: conflating
 * them produces the single most common access-control bug — a route that checks
 * "is someone logged in?" and forgets "is it *their* record?". Splitting them
 * makes the second check impossible to omit silently, because a route with only
 * `requireSession` visibly has no permission gate next to it.
 */

declare module "hono" {
  interface ContextVariableMap {
    session: SessionPayload;
  }
}

export function requireSession(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = readSession(c);
    if (!session) {
      // 401 with no detail. WHY: distinguishing "expired" from "forged" from
      // "never existed" is useful to an attacker probing token handling and
      // useless to a legitimate client, which just re-authenticates.
      return c.json({ error: { message: "Authentication required.", code: "UNAUTHENTICATED" } }, 401);
    }
    if (!isRole(session.role)) {
      return c.json({ error: { message: "Authentication required.", code: "UNAUTHENTICATED" } }, 401);
    }
    c.set("session", session);
    touchSession(c, session); // slide the idle window
    await next();
  };
}

/**
 * WHY MFA is a session property, not a user property: "this user has 2FA
 * enabled" does not mean "this session proved it". Gating sensitive actions on
 * `session.mfa` is what makes step-up authentication possible later without
 * re-plumbing every route.
 */
export function requireMfa(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = c.get("session");
    if (!session?.mfa) {
      return c.json(
        { error: { message: "Additional verification required.", code: "MFA_REQUIRED" } },
        403,
      );
    }
    await next();
  };
}

export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = c.get("session");
    if (!session || !hasPermission(session.role, permission)) {
      // WHY audit denials: a burst of denials from one session is the clearest
      // signal of privilege-escalation probing you will ever get. Successes
      // alone tell you nothing about attempts.
      audit({
        action: "authz.denied",
        actor: session?.sub ?? "anonymous",
        actorRole: session?.role,
        outcome: "denied",
        target: `${permission} @ ${new URL(c.req.url).pathname}`,
      });
      return c.json({ error: { message: "You do not have access to this.", code: "FORBIDDEN" } }, 403);
    }
    await next();
  };
}

export function requirePortal(portal: "employee" | "employer" | "investor" | "operations"): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = c.get("session");
    if (!session || !isRole(session.role) || portalFor(session.role) !== portal) {
      return c.json({ error: { message: "You do not have access to this.", code: "FORBIDDEN" } }, 403);
    }
    await next();
  };
}

/**
 * Ownership check — the fix for Insecure Direct Object Reference.
 *
 * WHY this needs to be explicit: `GET /api/employees/:id/pay` with only
 * `requireSession` is a full data breach — change the id, read someone else's
 * salary. Non-guessable ids (cuid/uuid) are NOT a fix; they are obscurity, and
 * ids leak through exports, screenshots, URLs and support tickets. The only
 * correct check is "does this subject own, or have a granted relationship to,
 * this object?", performed server-side on every single access.
 *
 * `resolveOwner` must load the record and return its owning subject id, so the
 * check is against stored truth rather than anything the client supplied.
 */
export function requireOwnership(
  paramName: string,
  resolveOwner: (id: string) => Promise<string | null>,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const session = c.get("session");
    const id = c.req.param(paramName);
    if (!session || !id) {
      return c.json({ error: { message: "You do not have access to this.", code: "FORBIDDEN" } }, 403);
    }

    const owner = await resolveOwner(id);
    if (!owner || owner !== session.sub) {
      audit({
        action: "authz.idor.blocked",
        actor: session.sub,
        actorRole: session.role,
        outcome: "denied",
        target: `${paramName}=${id}`,
      });
      // WHY 404 and not 403: a 403 confirms the record exists, which turns the
      // endpoint into an enumeration oracle ("employee id 4821 is real"). For
      // objects the caller may not know about, "not found" is the honest answer.
      return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
    }

    await next();
  };
}
