import type { Context } from "hono";
import { prisma } from "../db";
import { audit, redact } from "./audit";
import { clientIp } from "./client-ip";
import { AUDIT_ACTIONS } from "../types";

/**
 * Durable audit trail — the database half of `audit()`.
 *
 * WHY both: `audit()` writes JSON lines to stdout, which is the right sink for
 * a log pipeline (append-only, outside the app's reach, aggregated across
 * instances). But stdout is a stream, not a record: it rotates, it is not
 * queryable from the admin portal, and most hosting keeps it for days. The
 * questions this table has to answer — "who approved this KYC case in March",
 * "show me every failed sign-in for this administrator" — need rows.
 *
 * `record()` writes BOTH. The stream stays authoritative for incident response
 * (an attacker with database write access cannot retroactively edit what already
 * left the process); the table is what the portal reads.
 *
 * NO UPDATE OR DELETE PATH EXISTS. Not "we don't do it" — there is no function
 * here that can. A correction is a new row. An audit table that an
 * administrator can edit is not evidence, and the most likely person to want to
 * edit it is the one whose actions it records.
 */

/**
 * Actions worth persisting. An explicit allowlist rather than "everything".
 *
 * WHY an allowlist: this table holds full IP addresses (see the model comment),
 * so its scope is the privacy control. Letting any caller persist any action
 * would, over time, turn it into a general-purpose activity log of every
 * customer's movements — which is a different thing with different retention and
 * different legal weight. Adding a value here should be a deliberate decision.
 *
 * The array itself lives in types.ts (AUDIT_ACTIONS) and is re-exported here.
 * WHY there: the admin portal renders a filter over these values and cannot
 * import this module, because this module imports Prisma. Two hand-kept copies
 * of an allowlist is how a filter ends up silently missing the one action an
 * investigator needs.
 */
export const AUDITED_ACTIONS = AUDIT_ACTIONS;

export type AuditedAction = (typeof AUDITED_ACTIONS)[number];

export type ActorType = "admin" | "user" | "invitee" | "system" | "anonymous";

export interface RecordInput {
  action: AuditedAction;
  outcome: "success" | "failure" | "denied";
  actorType: ActorType;
  actorId?: string | null;
  /** Admin email, customer email, "system". Stored in the clear: the point is attribution. */
  actorLabel?: string | null;
  targetType?:
    | "user"
    | "admin"
    | "invitation"
    | "kyc"
    | "registration"
    | "employer"
    | "employer_user"
    | "payroll_cycle"
    | "employee_record"
    | "employer_score"
    | "credit_decision"
    | "bridge_draw"
    | "salary_account_request"
    | "savings_goal"
    | "investment_commitment"
    | "session"
    /** A support ticket, identified by its readable reference. */
    | "ticket"
    /** A person's accessibility settings. The VALUES never go in `detail`. */
    | "preferences"
    | "consent"
    | null;
  targetId?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * The caller's IP, for the column that exists to be evidence.
 *
 * Delegates to security/client-ip.ts. This used to read the LEFTMOST entry of
 * `x-forwarded-for`, which a caller writes itself — so the recorded address was
 * whatever the subject of the audit record chose. An audit trail with a forgeable
 * actor address is worse than one with no address at all, because it will be
 * believed.
 */
export function callerIp(c: Context): string | null {
  return clientIp(c);
}

/** Browser/device string, truncated. Display only — never parsed for decisions. */
export function callerDevice(c: Context): string | null {
  return c.req.header("user-agent")?.slice(0, 300) ?? null;
}

/**
 * Keys that must never reach the `detail` column, whatever a caller passes.
 *
 * This duplicates `redact()`'s coverage on purpose. `redact()` masks by *key
 * name pattern* and is generic; this list names the specific things that would
 * be catastrophic in this specific table — the invitation code, a TOTP secret, a
 * decrypted identity number. Defence in depth on the one column that accepts
 * free-form input.
 */
const FORBIDDEN_DETAIL_KEYS = [
  "code",
  "password",
  "secret",
  "token",
  "tokenhash",
  "mfasecret",
  "idnumber",
  "bvn",
  "nin",
  "dateofbirth",
  "dob",
  "address",
  "recoverycode",
];

/**
 * Match on WORD parts, not on raw substrings.
 *
 * WHY: a plain `includes` over the flattened key is wrong in both directions.
 * "nin" sits inside "attemptsRemaining", so a harmless counter was being
 * redacted into uselessness — and a field that silently becomes "[redacted]" is
 * worse than an absent field, because the log still looks complete. But dropping
 * substring matching entirely lets "invitationCode" through, which is the single
 * most damaging value that could land in this column.
 *
 * So both checks run: the key is split on camelCase and separators and each part
 * is compared exactly (catching `code`, `bvn`, `dob`, `nin` wherever they appear
 * as words), and the flattened key is additionally substring-matched against the
 * longer terms (catching `customerIdNumber`, `applicantAddressLine1`).
 */
function keyParts(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .map((part) => part.toLowerCase())
    .filter(Boolean);
}

/** Below this length a term is only trusted as a whole word. */
const WHOLE_WORD_MAX = 4;

function isForbiddenKey(key: string): boolean {
  const parts = keyParts(key);
  const flat = key.toLowerCase().replace(/[^a-z]/g, "");
  return FORBIDDEN_DETAIL_KEYS.some(
    (forbidden) =>
      parts.includes(forbidden) || (forbidden.length > WHOLE_WORD_MAX && flat.includes(forbidden)),
  );
}

function scrubDetail(detail: Record<string, unknown> | undefined): string | null {
  if (!detail) return null;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    safe[key] = isForbiddenKey(key) ? "[redacted]" : value;
  }
  // Second pass through the shared redactor, which also pseudonymises anything
  // that looks like an email or phone number nested deeper in the object.
  try {
    return JSON.stringify(redact(safe)).slice(0, 4000);
  } catch {
    return null;
  }
}

/**
 * Write one audit record to the stream and the table.
 *
 * NEVER THROWS, and never blocks the caller's result. WHY: if writing the audit
 * row can fail the request, then an attacker who can make the audit write fail
 * (fill the disk, break the connection) can also block the action — or, far
 * worse, a developer hits the error once and wraps the call in a way that
 * silently drops future writes. The failure is logged loudly as its own event so
 * a gap in the table is visible in the stream.
 *
 * The consequence is stated plainly: a database outage means missing rows, and
 * stdout is the fallback record for that window.
 */
export async function record(c: Context | null, input: RecordInput): Promise<void> {
  const ip = c ? callerIp(c) : null;
  const userAgent = c ? callerDevice(c) : null;
  const requestId = c ? (c.get("requestId") as string | undefined) : undefined;

  // Stream first: it is the copy an attacker with database access cannot alter.
  audit({
    action: input.action,
    actor: input.actorLabel ?? input.actorId ?? input.actorType,
    outcome: input.outcome,
    target: input.targetId ?? undefined,
    ip: ip ?? undefined,
    requestId,
    detail: {
      ...input.detail,
      targetType: input.targetType ?? undefined,
      previousStatus: input.previousStatus ?? undefined,
      newStatus: input.newStatus ?? undefined,
    },
  });

  try {
    await prisma.auditEvent.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        outcome: input.outcome,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus ?? null,
        ip,
        userAgent,
        requestId: requestId ?? null,
        detail: scrubDetail(input.detail),
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "audit.persist_failed",
        at: new Date().toISOString(),
        action: input.action,
        requestId,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/** Shape returned to the admin audit-log view. */
export interface SerialisedAuditEvent {
  id: string;
  action: string;
  outcome: string;
  actorType: string;
  actorLabel: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  detail: string | null;
  createdAt: string;
}

export function serialiseAuditEvent(row: {
  id: string;
  action: string;
  outcome: string;
  actorType: string;
  actorLabel: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  detail: string | null;
  createdAt: Date;
}): SerialisedAuditEvent {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
