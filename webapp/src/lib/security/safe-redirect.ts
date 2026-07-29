/**
 * Open-redirect defence for the `?next=` parameter.
 *
 * THE BUG THIS FIXES
 * The sign-in flow carried a `next` path through login → OTP → dashboard and
 * validated it with `next.startsWith("/")`. That check is not sufficient:
 *
 *   /login?next=//evil.com          → browsers read "//evil.com" as a
 *                                     protocol-relative URL and navigate
 *                                     off-site. It starts with "/", so the
 *                                     check passes.
 *   /login?next=/\evil.com          → backslash is normalised to "/" by
 *                                     several browsers. Same result.
 *   /login?next=/%09/evil.com       → whitespace/control characters are
 *                                     stripped before parsing.
 *   /login?next=https:/evil.com     → single-slash scheme, tolerated by some
 *                                     URL parsers.
 *
 * WHY IT MATTERS ON A PAYROLL PRODUCT
 * The redirect fires immediately AFTER a successful authentication. An attacker
 * sends "sign in to approve this payroll run" with a link to the real PayBridge
 * domain — the domain check a careful user performs actually passes — and the
 * user lands on a pixel-perfect clone with the URL bar reading evil.com only
 * after they have already typed their password. It is also the exact pattern
 * behind the react-router advisories this project is exposed to
 * (GHSA-2j2x-hqr9-3h42), where an open redirect is chained into script
 * execution.
 *
 * THE FIX: allowlist by construction, not denylist by pattern.
 * Rather than trying to enumerate hostile shapes, we resolve the candidate
 * against the current origin with the URL parser — the same parser the browser
 * will use — and accept it only if the resolved origin is still ours. Then we
 * return a *rebuilt* path (pathname + search + hash), so nothing from the raw
 * input survives into the navigation. A denylist of "//" and "\\" would have to
 * keep pace with every parser quirk; this cannot drift.
 */

/**
 * Characters the URL parser ignores but that break naive string comparisons:
 * NUL through unit-separator, plus DEL.
 */
// eslint-disable-next-line no-control-regex
const STRIPPABLE = /[\u0000-\u001F\u007F]/g;

export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;

  // Strip characters browsers ignore during URL parsing but that defeat naive
  // string checks (tab, newline, NUL, and leading/trailing whitespace).
  const candidate = raw.replace(STRIPPABLE, "").trim();
  if (!candidate) return fallback;

  // Must be a site-relative path. Reject anything that could carry a scheme or
  // an authority before we even hand it to the parser.
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback; // protocol-relative
  if (candidate.startsWith("/\\") || candidate.startsWith("\\")) return fallback; // backslash variants

  try {
    const url = new URL(candidate, window.location.origin);
    // The decisive check: after full parsing, are we still on our own origin?
    if (url.origin !== window.location.origin) return fallback;
    // Rebuild from parsed parts — no raw input is carried through.
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith("/") ? path : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Attributes every `target="_blank"` link must carry.
 *
 * WHY: without `noopener`, the opened page receives `window.opener` and can do
 * `window.opener.location = "https://phishing.example"` — silently replacing the
 * PayBridge tab the user will return to (reverse tabnabbing). `noreferrer`
 * additionally stops the full URL of the current dashboard page — which contains
 * employer and employee identifiers — being sent to the third party in the
 * Referer header. Modern browsers imply noopener, but "modern browsers imply it"
 * is not a control we own.
 */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

/**
 * Guard for any URL that will be placed in an href/src attribute.
 *
 * WHY: `href={userSuppliedValue}` with a `javascript:` or `data:text/html`
 * value is script execution on our origin — DOM XSS without ever touching
 * innerHTML. React does not sanitise href. Anything that is not http(s),
 * mailto, tel or a site-relative path is replaced with "#".
 */
const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

export function safeHref(raw: string | null | undefined): string {
  if (!raw) return "#";
  const value = raw.replace(STRIPPABLE, "").trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value; // relative
  try {
    const url = new URL(value);
    return SAFE_SCHEMES.includes(url.protocol) ? url.toString() : "#";
  } catch {
    return "#";
  }
}
