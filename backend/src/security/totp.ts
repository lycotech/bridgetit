import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238) for administrator MFA.
 *
 * WHY implemented here rather than pulling in otplib/speakeasy: the whole
 * algorithm is HMAC-SHA1 over a counter plus a truncation rule — about forty
 * lines. Adding a transitive dependency tree to the code path that guards the
 * highest-privilege surface in the product is a worse trade than owning forty
 * lines, and it is one fewer package that can be compromised upstream.
 *
 * WHY TOTP and not SMS: an authenticator app is not vulnerable to SIM swap,
 * which is the dominant account-takeover route in this market. SMS as a fallback
 * would reduce the whole factor to the strength of SMS, so it is deliberately
 * not offered; the fallback is single-use recovery codes.
 *
 * WHY SHA-1: RFC 6238's default, and what Google Authenticator, Authy, 1Password
 * and iOS Passwords actually implement. SHA-1's collision weakness is
 * irrelevant to HMAC with a secret key, and choosing SHA-256 here would mean
 * enrolment silently failing in the apps administrators really use.
 */

/** 30-second steps, 6 digits — the values every authenticator app assumes. */
const STEP_SECONDS = 30;
const DIGITS = 6;

/**
 * Accept the previous, current and next step (±30s).
 *
 * WHY a window at all: phone clocks drift, and a code typed at the 29th second
 * arrives in the next step. WHY only ±1: each extra step widens the guessing
 * window proportionally, and with a 6-digit code the margin matters. Combined
 * with rate limiting, ±1 is the standard compromise.
 */
const WINDOW = 1;

/* --------------------------------------------------------------- BASE32 */
/*
 * RFC 4648 base32, no padding. Authenticator apps take secrets in this form and
 * nothing else, which is the only reason this codec exists here.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character in TOTP secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ----------------------------------------------------------------- TOTP */

/**
 * A fresh 160-bit secret, base32-encoded.
 *
 * 20 bytes is RFC 4226's recommendation for HMAC-SHA1: it matches the hash's
 * block behaviour, so a longer secret buys nothing.
 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for one 30-second step. */
function codeForCounter(secret: Buffer, counter: number): string {
  // 8-byte big-endian counter. Written as two 32-bit halves because a JS number
  // cannot hold a 64-bit integer exactly, and `writeBigUInt64BE` would need a
  // BigInt conversion on every verify.
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);

  const digest = createHmac("sha1", secret).update(buf).digest();

  // Dynamic truncation (RFC 4226 §5.3). The low nibble of the last byte selects
  // the offset; the leading bit is masked so the result is always positive.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** The code valid right now — used by tests and by the enrolment self-check. */
export function currentTotp(secretBase32: string, atMs = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return codeForCounter(base32Decode(secretBase32), counter);
}

/**
 * Verify a submitted code against the secret.
 *
 * Every candidate step is compared with a constant-time compare and the loop is
 * NOT short-circuited on a match. WHY: returning as soon as a step matches makes
 * "matched the previous step" measurably slower than "matched the current
 * step", which leaks the receiver's clock offset. Trivial, but the fix is one
 * boolean, so there is no reason to leave it.
 */
export function verifyTotp(secretBase32: string | null | undefined, submitted: string, atMs = Date.now()): boolean {
  if (!secretBase32) return false;

  const cleaned = submitted.replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;

  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }

  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  let matched = false;
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    const candidate = codeForCounter(secret, counter + drift);
    const a = Buffer.from(candidate);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) matched = true;
  }
  return matched;
}

/**
 * The `otpauth://` URI an authenticator app scans.
 *
 * The secret is IN this string, so it is returned exactly once — at enrolment,
 * over an authenticated response — and must never be logged, stored in the
 * client, or written to an audit record.
 */
export function totpEnrolmentUri(input: { secret: string; email: string; issuer?: string }): string {
  const issuer = input.issuer ?? "PayBridge";
  const label = encodeURIComponent(`${issuer}:${input.email}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Single-use recovery codes, for a lost or wiped authenticator.
 *
 * Returned once in plaintext; only sha256 digests are stored, because a
 * recovery code bypasses the second factor entirely and is therefore a
 * credential in its own right.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Two groups of five from a Crockford-style alphabet: no O/I/L/U, so a code
    // read off a screen and typed back cannot be transcribed wrong.
    const raw = base32Encode(randomBytes(7)).replace(/[OILU]/g, "9").slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
