import type { Context, MiddlewareHandler, Next } from "hono";
import { clientIpKey } from "./client-ip";

/**
 * Sliding-window rate limiter.
 *
 * WHY rate limiting at all: without it, every unauthenticated endpoint is a
 * free oracle. On PayBridge specifically it protects three things:
 *   1. Credential endpoints — stops online password/OTP brute force. A 6-digit
 *      OTP has 1,000,000 combinations; at 1,000 req/s that is ~17 minutes.
 *      At 5 attempts / 15 min it is ~5,700 years.
 *   2. The waitlist endpoint — stops mass PII injection and email-bombing.
 *   3. Cost and availability — a payroll platform that falls over under a
 *      trivial flood cannot settle wages on payday.
 *
 * WHY sliding window and not fixed window: a fixed window lets an attacker send
 * 2x the limit across a window boundary (limit at 11:59:59 + limit at 12:00:00).
 * A sliding window counts the trailing N milliseconds, so the ceiling holds.
 *
 * LIMITATION (documented deliberately): this store is in-memory and therefore
 * per-process. It is correct for a single instance and is the right primitive
 * to keep in code, but a horizontally scaled deployment must back it with Redis
 * (or the edge/WAF layer) or the effective limit becomes limit x instances.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Stop the map growing without bound — evict buckets with no recent hits. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number, maxWindow: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((t) => now - t > maxWindow)) buckets.delete(key);
  }
}

/**
 * Derive the client identity.
 *
 * See security/client-ip.ts for why this reads the forwarded chain from the
 * RIGHT. Reading it from the left let a caller mint a fresh identity per request
 * by writing its own X-Forwarded-For, which bypassed every limit in this file.
 */
function clientKey(c: Context): string {
  return clientIpKey(c);
}

export interface RateLimitOptions {
  /** Requests permitted inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Namespace so different routes do not share a budget. */
  name: string;
  /** Optional extra identity component (e.g. submitted email) for per-account limits. */
  keyExtra?: (c: Context) => string | undefined;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { limit, windowMs, name, keyExtra } = options;

  return async (c: Context, next: Next) => {
    const now = Date.now();
    sweep(now, windowMs);

    const extra = keyExtra?.(c);
    const key = `${name}:${clientKey(c)}${extra ? `:${extra}` : ""}`;

    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

    if (bucket.hits.length >= limit) {
      buckets.set(key, bucket);
      const oldest = bucket.hits[0] ?? now;
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));

      // WHY these headers: RFC 9331 / draft-ratelimit-headers. Well-behaved
      // clients back off instead of hammering, which keeps the limiter cheap.
      c.header("Retry-After", String(retryAfter));
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", "0");
      c.header("RateLimit-Reset", String(retryAfter));

      // WHY a generic message: telling an attacker exactly which limit they hit
      // and how long the window is helps them tune. "Too many requests" plus a
      // Retry-After is all a legitimate client needs.
      return c.json(
        { error: { message: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" } },
        429,
      );
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);

    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(Math.max(0, limit - bucket.hits.length)));

    await next();
  };
}

/** Test/ops hook — clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}
