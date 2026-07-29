import type { MiddlewareHandler } from "hono";
import { isProduction } from "./config";

/**
 * Security response headers.
 *
 * This API serves JSON only — it never returns HTML, never loads a script and
 * is never framed. That lets us use the strictest possible policy rather than
 * the usual compromise, and any future header that "has to be relaxed" is then
 * a deliberate, reviewable decision.
 *
 * WHY each header:
 *
 * Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
 *   If an attacker ever gets HTML reflected out of a JSON endpoint (content-type
 *   confusion, an error page, a file download rendered inline), `default-src
 *   'none'` means the browser will not fetch or execute a single thing that page
 *   references. It turns "stored XSS on the API origin" into an inert document.
 *
 * X-Content-Type-Options: nosniff
 *   Without it, some browsers ignore our Content-Type and sniff the body. A JSON
 *   response whose first bytes look like HTML can then be executed as HTML on
 *   *our* origin — which is the origin holding the session cookie. This header
 *   is the single-line fix for that whole class.
 *
 * X-Frame-Options: DENY (and CSP frame-ancestors 'none')
 *   Clickjacking. Both are set because X-Frame-Options is what older browsers
 *   honour and frame-ancestors is what modern ones honour. For a payroll
 *   product the concrete attack is a transparent iframe over a "decoy" page so
 *   an HR admin approves a payroll run they cannot see.
 *
 * Referrer-Policy: no-referrer
 *   Stops URLs (which in a dashboard contain employee ids, employer ids, run
 *   references) leaking to any third party the browser navigates to. Default
 *   browser behaviour would send the full path cross-origin on downgrade-safe
 *   navigations. Information leakage, quietly, in analytics logs you do not own.
 *
 * Permissions-Policy
 *   Explicitly turns off camera, microphone, geolocation, payment, USB and
 *   FLoC/Topics. The API needs none of them; denying by name means a future
 *   compromised script cannot silently ask for them.
 *
 * Strict-Transport-Security (production only)
 *   Forces HTTPS for a year including subdomains, and preloads. Without it the
 *   very first request of a session can be plaintext and strippable. Not sent
 *   in dev because pinning HTTPS on localhost makes the machine unusable.
 *
 * Cross-Origin-Resource-Policy: same-site
 *   Blocks other sites from embedding our JSON as a subresource, which is the
 *   base primitive behind speculative side-channel (Spectre-class) reads.
 *
 * Cross-Origin-Opener-Policy: same-origin
 *   Severs the window.opener relationship so a page we open (or that opens us)
 *   cannot script our window.
 *
 * Cache-Control: no-store on API responses
 *   Payroll figures, salary and settlement data must never sit in a shared
 *   proxy cache or on disk in a browser cache on a shared HR workstation.
 *
 * X-Powered-By / Server are removed: version disclosure hands an attacker a
 *   free CVE lookup for the exact framework build. Low severity on its own,
 *   free to remove.
 */
export function securityHeaders(): MiddlewareHandler {
  const csp = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'none'",
    "style-src 'none'",
    "img-src 'none'",
    "connect-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const permissions = [
    "accelerometer=()",
    "autoplay=()",
    "camera=()",
    "display-capture=()",
    "encrypted-media=()",
    "fullscreen=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=(self)", // kept open for WebAuthn/passkey MFA
    "screen-wake-lock=()",
    "usb=()",
    "xr-spatial-tracking=()",
    "interest-cohort=()",
    "browsing-topics=()",
  ].join(", ");

  return async (c, next) => {
    await next();

    c.header("Content-Security-Policy", csp);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", permissions);
    c.header("Cross-Origin-Resource-Policy", "same-site");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("Origin-Agent-Cluster", "?1");
    c.header("X-Permitted-Cross-Domain-Policies", "none");
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
    c.header("Pragma", "no-cache");

    if (isProduction) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

    c.res.headers.delete("X-Powered-By");
    c.res.headers.delete("Server");
  };
}
