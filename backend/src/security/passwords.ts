import { timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";

/**
 * Password hashing and policy. Server-side and authoritative.
 *
 * WHY argon2id and not sha256: the existing admin credential check hashes with
 * a bare sha256 (see staff-session.ts). That is correct for comparing a config
 * value but wrong for storing a user's password — sha256 is designed to be
 * fast, so a leaked table of sha256 password digests is cracked at billions of
 * guesses per second on a single GPU. argon2id is deliberately slow and
 * memory-hard, which makes the same attack cost real money per password.
 *
 * WHY the `argon2` package rather than a hand-rolled KDF: it wraps the
 * reference libargon2 C implementation, which is the audited, widely-deployed
 * one — not something worth re-implementing for the single most
 * security-critical function in the app. It returns a self-describing PHC
 * string (`$argon2id$v=19$m=...`), so the parameters travel with the hash and
 * can be raised later without invalidating existing hashes.
 *
 * WHY the policy lives here and not only in the browser: webapp has a perfectly
 * good password-policy module, and it runs on the attacker's machine. A client
 * that never calls it still has to get past this.
 */

/*
 * Cost parameters. memoryCost is in KiB.
 *
 * 19 MiB / 2 passes is the OWASP-recommended argon2id baseline and takes tens
 * of milliseconds here — slow enough to make offline cracking expensive, fast
 * enough that a login does not feel broken. Raising these later is safe: old
 * hashes keep verifying because the parameters are embedded in the stored
 * string, and `needsRehash` reports which ones to upgrade on next sign-in.
 */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 *
 * Never throws. WHY: `argon2.verify` throws on a malformed or unknown hash
 * string, and a row with a corrupted hash would then produce a 500 instead of
 * a failed login — which tells an attacker they found something unusual about
 * that specific account. A bad hash is simply a password that cannot match.
 */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Should this hash be re-hashed with current parameters on next sign-in?
 * Cheap string check against the algorithm and memory cost we mint today.
 */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith(`$argon2id$v=19$m=${ARGON_OPTIONS.memoryCost},t=${ARGON_OPTIONS.timeCost},`);
}

/**
 * A dummy verify against a real argon2id hash, used on the "no such account"
 * branch of every login route.
 *
 * WHY: returning immediately for an unknown email makes that response
 * measurably faster than one for a known email whose password was wrong. That
 * timing difference is a working account-enumeration oracle — an attacker can
 * confirm which of a leaked address list has a PayBridge account without ever
 * guessing a password. Burning the same ~40ms on both paths removes the signal.
 *
 * The hash below is argon2id over a random throwaway string generated at
 * module load; nothing can ever match it.
 */
const DECOY_HASH = await argon2.hash(crypto.randomUUID(), ARGON_OPTIONS);

export async function burnPasswordTime(plain: string): Promise<void> {
  await verifyPassword(plain, DECOY_HASH);
}

/* ------------------------------------------------------------------ POLICY */

/** Minimum length. Long beats clever: length dominates real-world strength. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Passwords refused outright regardless of the character rules.
 *
 * "Passw0rd!" satisfies every complexity requirement and is in the first
 * thousand guesses of any real attack, so complexity rules alone are theatre.
 * Kept short and product-specific: a full breach corpus belongs behind an API
 * (Have I Been Pwned's k-anonymity range endpoint), noted as follow-up.
 */
const BLOCKLIST = [
  "password",
  "passw0rd",
  "paybridge",
  "getpaybridge",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "administrator",
  "changeme",
  "iloveyou",
  "monkey",
  "dragon",
  "abc123",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "trustno1",
  "sunshine",
  "princess",
  "football",
  "naija",
  "lagos",
  "nigeria",
];

export interface PasswordVerdict {
  ok: boolean;
  /** Safe to show the user: says what to fix, never what was nearly right. */
  message?: string;
}

/**
 * The single server-side password rule set, applied to customers and
 * administrators alike.
 *
 * `context` holds values the password must not contain — the person's own email
 * and name. WHY: "adeniran2026!" passes every character rule and is the first
 * thing a targeted attacker tries.
 */
export function checkPasswordPolicy(
  password: string,
  context: { email?: string | null; name?: string | null } = {},
): PasswordVerdict {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  // Upper bound: argon2id will happily hash a 10 MB string and spend real CPU
  // doing it, which turns the login form into a denial-of-service lever.
  if (password.length > 200) {
    return { ok: false, message: "That password is too long — 200 characters maximum." };
  }
  if (!/[a-z]/.test(password)) return { ok: false, message: "Include a lower-case letter." };
  if (!/[A-Z]/.test(password)) return { ok: false, message: "Include an upper-case letter." };
  if (!/[0-9]/.test(password)) return { ok: false, message: "Include a number." };
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, message: "Include a special character, such as ! ? or #." };
  }

  const lowered = password.toLowerCase();
  if (BLOCKLIST.some((entry) => lowered.includes(entry))) {
    return { ok: false, message: "That password is too easy to guess. Choose something unrelated to PayBridge." };
  }

  // A single repeated character, or a straight run, meets every rule above.
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, message: "That password is too easy to guess." };
  }

  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lowered.includes(local)) {
    return { ok: false, message: "Your password must not contain your email address." };
  }
  for (const part of (context.name ?? "").toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lowered.includes(part)) {
      return { ok: false, message: "Your password must not contain your name." };
    }
  }

  return { ok: true };
}

/** Constant-time string compare, for confirm-password and code checks. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Generate a strong random password for the deployment seed.
 *
 * Guarantees one character from each required class, then fills from the full
 * alphabet and shuffles — so the result always satisfies the policy above
 * instead of being generated-then-rejected in a retry loop.
 *
 * Ambiguous glyphs (O/0, l/1/I) are excluded: this password gets read off a
 * terminal and typed by hand once, and a transcription failure looks
 * identical to a wrong password.
 */
export function generateStrongPassword(length = 20): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*?-_=+";
  const all = lower + upper + digits + symbols;

  const pick = (set: string): string => set[randomInt(set.length)]!;
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));

  // Fisher–Yates with a CSPRNG. A sort-by-random shuffle is biased and, for a
  // credential, biased means predictable.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/**
 * Uniform random integer in [0, max) from the CSPRNG.
 *
 * WHY not `randomBytes(1)[0] % max`: unless max divides 256, the low residues
 * occur more often. Rejection sampling keeps the distribution flat, which is
 * what "cryptographically secure random" has to mean for a generated password
 * or an invitation code.
 */
export function randomInt(max: number): number {
  if (max <= 0) throw new Error("randomInt: max must be positive");
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % max;
  }
}
