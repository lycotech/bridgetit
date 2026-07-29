import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { randomInt } from "./passwords";

/**
 * Generation and checking of the two human-typed secrets in the product:
 *
 *   1. Private-demonstration invitation codes — PB-7K4M-92QX
 *   2. Contact-verification codes — a 6-digit OTP sent by email or SMS
 *
 * Both are generated from the CSPRNG and stored only as sha256 digests. WHY
 * hashed rather than encrypted: nothing ever needs to read them back. The
 * invitation code exists in the invitation message; the OTP exists in the
 * customer's inbox. If the database is the only place either can be recovered
 * from, then a database reader can walk into a demo or complete someone's
 * verification — which is exactly the position we would be in if these were
 * stored in the clear "so support can help".
 *
 * WHY sha256 and not argon2id here, when passwords use argon2id: these are
 * high-entropy, short-lived values, not user-chosen ones. A 6-digit OTP has 20
 * bits of entropy, so slow hashing does not save it — a 5-attempt cap and a
 * 10-minute expiry do, and both are enforced by the caller. Hashing exists to
 * prevent *replay from a dump*, not to resist offline cracking.
 */

/* ------------------------------------------------------ INVITATION CODES */

/**
 * Alphabet for invitation codes. 32 characters, chosen for transcription
 * safety: no 0/O, no 1/I/L, no U (which is read as V in some faces).
 *
 * WHY this matters and is not fussiness: the code is read off a screen or an
 * email and typed by a prospective partner, often on a phone. Every ambiguous
 * glyph turns into a support conversation, and — worse — a failed attempt that
 * counts against the rate limit and looks exactly like an attack.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Human-facing prefix. Makes the code obviously ours if it is pasted anywhere. */
const CODE_PREFIX = "PB";

/** Two groups of four. */
const GROUP_LENGTH = 4;
const GROUP_COUNT = 2;

/**
 * A fresh invitation code, e.g. `PB-7K4M-92QX`.
 *
 * Entropy: 30 characters ^ 8 positions ≈ 2^39. That is not password-grade, and
 * it does not need to be — the code is worthless without the matching invited
 * email address, is rate-limited to a handful of attempts per window, expires,
 * and is revocable. The pair is the credential; see routes/demo.ts.
 */
export function generateInvitationCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i++) {
      group += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return [CODE_PREFIX, ...groups].join("-");
}

/**
 * Canonical form used for hashing and lookup: upper-case, everything that is
 * not a letter or digit removed.
 *
 * WHY normalise: the invitee will type `pb 7k4m 92qx`, or paste it with a
 * trailing space, or their mail client will helpfully capitalise it. Hashing the
 * raw string would reject all of those, and the invitee has no way to tell the
 * difference between "you typed it slightly differently" and "your invitation
 * was revoked". Note this means the code is deliberately case-INSENSITIVE, which
 * costs entropy already accounted for above.
 */
export function normaliseInvitationCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** sha256 of the canonical form. The only representation we persist. */
export function hashInvitationCode(code: string): string {
  return createHash("sha256").update(normaliseInvitationCode(code)).digest("hex");
}

/**
 * The non-secret part shown in the admin list: `PB-7K4M-••••`.
 *
 * WHY show anything at all: an invitee emails "my code PB-7K4M-92QX isn't
 * working" and someone has to find the row. Without a hint the admin has no way
 * to identify which invitation is which, and the tempting fix is to store the
 * code in the clear. Half the code plus the email address is enough to identify
 * it and not enough to use it.
 */
export function invitationCodeHint(code: string): string {
  const canonical = normaliseInvitationCode(code);
  const body = canonical.startsWith(CODE_PREFIX) ? canonical.slice(CODE_PREFIX.length) : canonical;
  return `${CODE_PREFIX}-${body.slice(0, GROUP_LENGTH)}-${"•".repeat(GROUP_LENGTH)}`;
}

/**
 * Format a canonical code back into display form. Used exactly once — on the
 * response that creates an invitation, which is the only time the plaintext
 * code is ever sent anywhere.
 */
export function formatInvitationCode(canonical: string): string {
  const body = canonical.startsWith(CODE_PREFIX) ? canonical.slice(CODE_PREFIX.length) : canonical;
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_LENGTH) groups.push(body.slice(i, i + GROUP_LENGTH));
  return [CODE_PREFIX, ...groups].join("-");
}

/** Shape check before any database lookup, so junk is rejected without a query. */
export function looksLikeInvitationCode(code: string): boolean {
  const canonical = normaliseInvitationCode(code);
  return canonical.length === CODE_PREFIX.length + GROUP_LENGTH * GROUP_COUNT;
}

/* ---------------------------------------------------- VERIFICATION CODES */

/** Digits in an email/SMS verification code. */
export const OTP_LENGTH = 6;

/** How long a verification code lives. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * Wrong guesses allowed against a single code before it is dead.
 *
 * WHY 5 and why per-code rather than only per-IP: 6 digits is a million
 * possibilities, which a botnet spread across addresses can exhaust in minutes
 * if the code itself never dies. Burning the code after 5 failures caps the
 * attack at 5-in-a-million per issued code regardless of how the attempts are
 * distributed. Per-IP rate limiting is a separate, additive control.
 */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * A 6-digit code, uniformly distributed across 000000–999999.
 *
 * Leading zeros are preserved. WHY that is worth a comment: generating with
 * `randomInt(900000) + 100000` to "avoid" leading zeros is a common shortcut
 * that silently discards 10% of the keyspace and makes the first digit
 * non-uniform.
 */
export function generateOtp(): string {
  let out = "";
  for (let i = 0; i < OTP_LENGTH; i++) out += String(randomInt(10));
  return out;
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code.replace(/\D/g, "")).digest("hex");
}

/** Constant-time comparison of a submitted code against a stored digest. */
export function otpMatches(submitted: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(submitted));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Partially mask a destination for display: "ad••••••@example.com",
 * "+2348•••••79".
 *
 * WHY mask at all when we are telling the person their own address: the "check
 * your email" screen is reachable with only an email address, so an attacker
 * probing addresses would otherwise be handed the account's full phone number.
 * Enough characters to recognise your own; not enough to learn someone else's.
 */
export function maskDestination(destination: string): string {
  if (destination.includes("@")) {
    const [local = "", domain = ""] = destination.split("@");
    const head = local.slice(0, 2);
    return `${head}${"•".repeat(Math.max(local.length - 2, 2))}@${domain}`;
  }
  const digits = destination.replace(/\s+/g, "");
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `${digits.slice(0, 4)}${"•".repeat(Math.max(digits.length - 6, 2))}${digits.slice(-2)}`;
}

/* ------------------------------------------------- STATELESS TIMED CODES */

/**
 * A 6-digit code derived from a secret and a purpose, rather than stored.
 *
 * Used for the administrator's recovery-address confirmation. WHY stateless here
 * when the customer OTP has its own table: the customer flow needs an attempt
 * counter that survives a restart and a per-code kill switch, so it has to be a
 * row. This one is a single step inside an authenticated first-run wizard,
 * already behind an admin session and a rate limit, and there is no AdminUser
 * column to put it in. Deriving it means no schema change and, more usefully, no
 * code sitting in the database at all.
 *
 * The subject is inside the HMAC, so a code issued for one address cannot
 * confirm a different one — changing the pending address invalidates any
 * outstanding code automatically. Two windows are accepted (the current one and
 * the one before it) so a code that arrives just after a boundary still works,
 * which puts the real lifetime between one and two TTLs.
 */
const TIMED_CODE_TTL_MS = 15 * 60 * 1000;

/** Minutes to quote to the recipient: the guaranteed life, not the best case. */
export const TIMED_CODE_MINUTES = TIMED_CODE_TTL_MS / 60_000;

function timedCodeSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production and must be at least 32 characters.");
  }
  return "development-only-timed-code-secret-never-used-in-production";
}

function timedCodeAt(purpose: string, subject: string, window: number): string {
  const digest = createHmac("sha256", timedCodeSecret()).update(`${purpose} ${subject} ${window}`).digest();
  // Same dynamic truncation as TOTP: 31 bits from a rotating offset, so no fixed
  // slice of the digest is ever exposed, then reduced to six digits.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return (binary % 1_000_000).toString().padStart(6, "0");
}

export function issueTimedCode(purpose: string, subject: string, atMs = Date.now()): string {
  return timedCodeAt(purpose, subject, Math.floor(atMs / TIMED_CODE_TTL_MS));
}

/**
 * Check a submitted code. Both candidate windows are always compared and the
 * loop is not short-circuited, for the same timing reason as `verifyTotp`.
 */
export function verifyTimedCode(purpose: string, subject: string, submitted: string, atMs = Date.now()): boolean {
  const cleaned = submitted.replace(/\D/g, "");
  if (cleaned.length !== 6) return false;
  const window = Math.floor(atMs / TIMED_CODE_TTL_MS);
  let matched = false;
  for (const candidate of [window, window - 1]) {
    const a = Buffer.from(timedCodeAt(purpose, subject, candidate));
    const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) matched = true;
  }
  return matched;
}
