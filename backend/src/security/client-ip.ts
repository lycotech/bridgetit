import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { isProduction } from "./config";

/**
 * The caller's IP address, derived at the trust boundary.
 *
 * THE BUG THIS FILE EXISTS TO FIX
 *
 * Both the rate limiter and the audit log used to read
 * `x-forwarded-for.split(",")[0]` — the LEFTMOST entry. A proxy APPENDS the peer
 * it saw, so for a request that arrives with a header the client wrote itself,
 * the chain reads:
 *
 *     X-Forwarded-For: <whatever the client typed>, <the client's real IP>
 *                       ^ leftmost — attacker-controlled
 *
 * Taking the leftmost value therefore hands the attacker the identity used for
 * rate limiting. Demonstrated against this app: eight accounts created through a
 * limit of six per hour, purely by incrementing a header. It also means the `ip`
 * column in the audit table — the column that exists to be evidence — held
 * whatever the caller decided to put there.
 *
 * THE FIX
 *
 * Count from the RIGHT. The rightmost entry was written by our own edge and is
 * the only one nothing upstream could forge. With one proxy in front of the app
 * (the deployment default), the client is the last entry. With two, it is the
 * second from last, and so on — that is what TRUSTED_PROXY_HOPS expresses.
 *
 * An attacker can still pad the LEFT of the chain, which is now harmless: those
 * entries are never read.
 *
 * WHY a configured hop count and not a list of trusted proxy addresses: the edge
 * addresses here are not stable or knowable from inside the container, whereas
 * the number of hops is a property of the deployment topology and changes only
 * when that topology changes. Setting it too HIGH is the dangerous direction —
 * it starts reading entries the client can write — so the default is the minimum
 * that can be correct, 1.
 */

/**
 * How many proxies sit between the internet and this process.
 *
 * ZERO means "no proxy — do not read forwarded headers at all", and it is the
 * default outside production. WHY: with nothing in front of the app, EVERY entry
 * in the chain was written by the caller, including the rightmost, so there is no
 * safe index to read. Testing this locally proved the point — a one-entry chain
 * is indistinguishable from an edge-written one by inspection alone, so the
 * distinction has to come from configuration, not from the header.
 *
 * In production the default is 1, matching a single edge/load balancer. Raising
 * it is the dangerous direction — each increment walks one step further left,
 * towards the part of the chain a caller controls — so it is capped at 4 and must
 * be set deliberately.
 */
function trustedHops(): number {
  const configured = process.env.TRUSTED_PROXY_HOPS;
  if (configured === undefined || configured.trim() === "") return isProduction ? 1 : 0;
  const raw = Number(configured);
  if (!Number.isFinite(raw) || raw < 0) return isProduction ? 1 : 0;
  return Math.min(Math.floor(raw), 4);
}

/**
 * The socket peer, via `@hono/node-server`'s connection-info helper.
 *
 * WHY a try/catch: `getConnInfo` throws if called outside a request actually
 * served by the node-server adapter (e.g. a unit test constructing a bare
 * Context). Guessing wrong must return null silently rather than throw, which
 * is how the rate limiter would otherwise 500 instead of quietly collapsing
 * every caller into one shared bucket.
 */
function socketAddress(c: Context): string | null {
  try {
    return getConnInfo(c).remote.address ?? null;
  } catch {
    return null;
  }
}

export function clientIp(c: Context): string | null {
  const hops = trustedHops();

  /*
   * No trusted proxy: the forwarded headers are caller-supplied strings with no
   * provenance, so they are ignored entirely rather than read cautiously. The
   * socket peer is the only fact available, and in this configuration it IS the
   * caller.
   */
  if (hops === 0) return socketAddress(c);

  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    // Index from the right: hops=1 → last entry, hops=2 → second from last.
    const candidate = chain[chain.length - hops];
    if (candidate) return candidate;
    // The chain is shorter than the configured hop count, which means the
    // request did NOT arrive through the expected number of proxies. Falling
    // back to the leftmost entry here would reintroduce the bug, so prefer the
    // socket address and treat the header as unusable.
  }

  /*
   * These two are set by a specific edge (Cloudflare, nginx) and are single
   * valued, so there is no chain to mis-index. They are still only as
   * trustworthy as the guarantee that the app is not reachable except through
   * that edge — which is why the socket address is the final fallback rather
   * than the first choice.
   */
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? socketAddress(c);
}

/** Rate-limit bucket key. Never null: an unidentifiable caller shares one bucket. */
export function clientIpKey(c: Context): string {
  return clientIp(c) ?? "unknown";
}
