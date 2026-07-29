/**
 * Single source of truth for "who is allowed to talk to this API".
 *
 * WHY one list: CORS and CSRF are two different controls that must agree.
 * CORS decides whether the browser lets JS *read* our response; CSRF (origin
 * pinning) decides whether we act on a state-changing request at all. When the
 * two lists drift apart you get either a broken app or a bypass. Keeping one
 * exported predicate makes drift impossible.
 */

/**
 * Anchored regexes, not `startsWith`/`includes`.
 * WHY: `origin.includes("vibecode.dev")` matches `https://vibecode.dev.evil.com`.
 * Every pattern below is anchored with ^...$ and escapes literal dots, so an
 * attacker-controlled suffix or prefix cannot satisfy it.
 */
const ORIGIN_PATTERNS: RegExp[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Extra origins for the real deployment, comma separated, exact match only.
 * WHY exact rather than another regex: production is the Vercel domain(s)
 * this app is actually deployed to, which the browser sends verbatim as the
 * Origin header — even through the Vercel rewrite proxy that fronts this API
 * (see webapp/vercel.json), since a proxy forwards the original request
 * headers rather than rewriting Origin. Set via ALLOWED_ORIGINS in the
 * deployment environment, e.g. "https://your-app.vercel.app".
 */
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  if (extraOrigins.includes(origin)) return true;
  return ORIGIN_PATTERNS.some((re) => re.test(origin));
}

export const isProduction = process.env.NODE_ENV === "production";
