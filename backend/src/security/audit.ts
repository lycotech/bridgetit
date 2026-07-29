import { createHash } from "node:crypto";

/**
 * Structured, redacted audit + request logging.
 *
 * WHY replace hono's default `logger()`: it prints the full request line
 * including the query string. Password-reset tokens, OTPs, session ids and
 * `?email=` values routinely end up in query strings, and application logs are
 * the least-protected data store most companies own (shipped to third-party log
 * SaaS, readable by every engineer, retained for years). Logging them converts
 * a low-severity issue into credential disclosure. This logger strips the query
 * string and redacts known-sensitive fields before anything is written.
 *
 * WHY audit logging is a control and not just diagnostics: for a payroll and
 * earned-wage platform, "who approved this payroll run, from where, when" is
 * the evidence you need for a dispute, a regulator, or an insider-fraud
 * investigation. A log you cannot trust is worse than no log, so entries are
 * append-only in shape (no update/delete API) and carry actor, action, target,
 * source IP and outcome.
 */

const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "cookie",
  "otp",
  "code",
  "pin",
  "apikey",
  "api_key",
  "accesstoken",
  "refreshtoken",
  "sessionid",
  "bvn",
  "nin",
  "accountnumber",
  "cardnumber",
  "cvv",
];

function isSensitive(key: string): boolean {
  const k = key.toLowerCase().replace(/[_-]/g, "");
  return SENSITIVE_KEYS.some((s) => k.includes(s.replace(/[_-]/g, "")));
}

/**
 * One-way pseudonym for a value we must be able to correlate but must not store
 * in the clear (email, phone). WHY hashing not encryption: logs never need to
 * be reversed, only matched — "did this same email try 40 times?". A salted
 * SHA-256 gives correlation without holding recoverable PII in log storage.
 */
export function pseudonymise(value: string): string {
  const salt = process.env.LOG_SALT ?? "paybridge-log-salt";
  return `sha256:${createHash("sha256").update(salt).update(value.toLowerCase().trim()).digest("hex").slice(0, 16)}`;
}

/** Recursively redact an object before it goes anywhere near a log sink. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitive(k)) out[k] = "[redacted]";
      else if (/email/i.test(k) && typeof v === "string") out[k] = pseudonymise(v);
      else if (/phone|msisdn|mobile/i.test(k) && typeof v === "string") out[k] = pseudonymise(v);
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface AuditEvent {
  /** What happened, e.g. "waitlist.join". Stable machine-readable verb. */
  action: string;
  /** Who did it. "anonymous" when unauthenticated. */
  actor: string;
  /** Role at the time of the action — privilege changes must be reconstructable. */
  actorRole?: string;
  /** What it happened to. */
  target?: string;
  /** Did it succeed? Failures are the interesting half of an audit trail. */
  outcome: "success" | "failure" | "denied";
  /** Source IP, already extracted at the trust boundary. */
  ip?: string;
  requestId?: string;
  /** Anything else — passed through `redact()` before emission. */
  detail?: Record<string, unknown>;
}

/**
 * Emit one audit line as JSON.
 *
 * WHY JSON lines and not prose: audit value comes from being queryable. A
 * grep-able string breaks the moment a message is reworded; a structured event
 * survives. WHY stdout: it is the container-native sink — collection,
 * retention and immutability belong to the log pipeline, not the app process,
 * because an attacker who owns the app process must not be able to rewrite
 * history.
 */
export function audit(event: AuditEvent): void {
  const line = {
    type: "audit",
    at: new Date().toISOString(),
    ...event,
    detail: event.detail ? redact(event.detail) : undefined,
  };
  console.log(JSON.stringify(line));
}

/** Request logger that never prints the query string or headers. */
export function accessLog(input: {
  method: string;
  path: string;
  status: number;
  ms: number;
  ip?: string;
  requestId?: string;
}): void {
  console.log(
    JSON.stringify({
      type: "access",
      at: new Date().toISOString(),
      ...input,
    }),
  );
}
