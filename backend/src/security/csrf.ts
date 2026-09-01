import type { MiddlewareHandler } from "hono";
import { isAllowedOrigin } from "./config";
import { readSession, verifyCsrfToken } from "./session";
import { readStaffSession } from "./staff-session";
import { readEmployerSession } from "./employer-session";
import { audit } from "./audit";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence: origin pinning, plus a double-submit token on authenticated
 * state-changing requests.
 *
 * WHY CSRF matters here even though this is an SPA + JSON API: the app sends
 * `credentials: "include"`. That means the browser attaches our cookies to any
 * request it makes to this origin, including one initiated by evil.com. A form
 * POST from a hostile page does not need to read our response to do damage — it
 * only needs the side effect. On PayBridge the side effects include approving a
 * payroll run, changing bank details, and triggering a disbursement.
 *
 * WHY three layers instead of one:
 *
 *   Layer 1 — Origin/Referer pinning (this file).
 *     Every unsafe method must carry an Origin (or Referer) we recognise. This
 *     alone stops classic form-based CSRF, because the browser sets Origin and
 *     script cannot forge it. A missing Origin on an unsafe method is treated as
 *     hostile rather than "probably fine": treating absence as trust is exactly
 *     how origin checks get bypassed.
 *
 *   Layer 2 — SameSite=Lax on the session cookie (session.ts).
 *     Browser-side backstop if a proxy strips Origin.
 *
 *   Layer 3 — Double-submit token (session.ts::verifyCsrfToken).
 *     Server-enforced, independent of browser behaviour. Required only once a
 *     session cookie is actually present, so public endpoints (waitlist) stay
 *     usable while every authenticated mutation is covered.
 *
 * WHY not rely on "we only accept application/json": that is a real mitigation
 * (a cross-site HTML form cannot set that content type) but it is one parser
 * quirk away from failing, and it silently breaks the moment someone adds a
 * multipart file-upload route. Origin pinning does not have that failure mode.
 */
export function csrfProtection(): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();

    const origin = c.req.header("origin");
    const referer = c.req.header("referer");

    let sourceOrigin: string | null = origin ?? null;
    if (!sourceOrigin && referer) {
      try {
        sourceOrigin = new URL(referer).origin;
      } catch {
        sourceOrigin = null;
      }
    }

    if (!sourceOrigin || !isAllowedOrigin(sourceOrigin)) {
      audit({
        action: "csrf.origin.rejected",
        actor: "anonymous",
        outcome: "denied",
        target: `${c.req.method} ${new URL(c.req.url).pathname}`,
        detail: { origin: sourceOrigin ?? "(absent)" },
      });
      // Generic message: do not teach an attacker which check failed.
      return c.json({ error: { message: "Request rejected.", code: "FORBIDDEN" } }, 403);
    }

    // Only enforce the token once the caller actually holds a session — an
    // anonymous POST cannot be a *cross-site request forgery* against an
    // account, because there is no account to ride.
    //
    // All four session families are checked: the customer session, the admin
    // session, the private-demo session and the employer session. Omitting
    // the admin cookie here would leave the highest-privilege surface in the
    // product as the one without a double-submit token.
    //
    // WHY these are real decode-and-verify reads, not a raw cookie-name
    // string check: a cookie header is client-controlled input. A stale,
    // idle-expired or signature-invalid leftover from an earlier visit still
    // satisfies `cookieHeader.includes("pb_session=")` even though the
    // session it names is dead — readSession/readStaffSession/
    // readEmployerSession all verify the signature and expiry, they don't
    // just check presence. Gating on raw presence meant a browser carrying
    // old cookie litter (e.g. an idle-expired admin session from an earlier
    // tab) got permanently 403'd on every anonymous POST — including demo
    // invitation redemption — with the generic "Request rejected." message,
    // until that stale cookie's max-age finally elapsed on its own.
    const hasValidSession =
      Boolean(readSession(c)) ||
      Boolean(readStaffSession(c, "admin")) ||
      Boolean(readStaffSession(c, "demo")) ||
      Boolean(readEmployerSession(c));
    if (hasValidSession && !verifyCsrfToken(c)) {
      audit({
        action: "csrf.token.rejected",
        actor: "anonymous",
        outcome: "denied",
        target: `${c.req.method} ${new URL(c.req.url).pathname}`,
      });
      return c.json({ error: { message: "Request rejected.", code: "FORBIDDEN" } }, 403);
    }

    return next();
  };
}
