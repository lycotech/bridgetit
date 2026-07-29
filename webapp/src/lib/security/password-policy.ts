/**
 * Password policy.
 *
 * WHAT WAS WRONG
 * Sign-in accepted any password of 6+ characters and registration accepted 8+.
 * "123456" and "password" both passed. For a product that fronts salary data
 * and can move money on payday, that is the single cheapest full-account
 * compromise available: credential stuffing against a list of breached
 * passwords succeeds on a meaningful percentage of accounts with no exploit at
 * all.
 *
 * WHY THIS POLICY AND NOT THE USUAL ONE
 * This follows NIST SP 800-63B rather than the familiar
 * "8 chars, 1 upper, 1 digit, 1 symbol, rotate every 90 days" rule, because
 * that rule is now understood to make things worse:
 *
 *  - LENGTH beats composition. Every character added multiplies the search
 *    space; forcing one capital letter adds almost nothing because humans put
 *    it in position 1. We require 12 minimum, and support up to 128 so
 *    passphrases and password managers are not punished.
 *
 *  - BLOCK KNOWN-BAD instead of forcing character classes. Composition rules
 *    push users to "Password1!" — which satisfies every class and is in every
 *    cracking dictionary. Checking against common passwords, keyboard runs and
 *    the user's own name/email removes the passwords that actually get
 *    guessed. Composition here is a *hint* that raises the strength score, not
 *    a hard gate.
 *
 *  - NO FORCED ROTATION. Periodic expiry drives predictable increments
 *    (Payroll2024 → Payroll2025) and encourages writing passwords down.
 *    Rotation should be event-driven: on suspected compromise.
 *
 *  - Whitespace and unicode are allowed and NOT stripped: truncating or
 *    filtering silently reduces entropy and breaks password managers.
 *
 * NOTE ON WHERE THIS RUNS: this is client-side, so it is a UX control. The same
 * rules must be enforced on the server when real authentication lands —
 * anything checked only in the browser can be skipped by calling the API
 * directly. The list is deliberately kept in one exportable module so the
 * server can import the identical rules.
 */

/** Top breached/guessed passwords, plus the ones specific to this product. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssword", "p@ssw0rd",
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345",
  "qwerty", "qwerty123", "qwertyuiop", "asdfghjkl", "zxcvbnm",
  "letmein", "welcome", "welcome1", "admin", "admin123", "administrator",
  "iloveyou", "monkey", "dragon", "sunshine", "princess", "football",
  "abc123", "111111", "000000", "123123", "654321", "666666", "1q2w3e4r",
  "trustno1", "master", "superman", "starwars", "whatever", "changeme",
  // Product / sector specific — the first things an attacker tries here.
  "paybridge", "paybridge1", "paybridge123", "payroll", "payroll123",
  "salary", "salary123", "naira123", "nigeria", "lagos123", "access123",
]);

const KEYBOARD_RUNS = [
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "abcdefghijklmnopqrstuvwxyz",
];

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordCheck {
  ok: boolean;
  /** 0–4. Drives the strength meter. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  /** Blocking problems — must be empty for `ok`. */
  errors: string[];
  /** Non-blocking nudges. */
  hints: string[];
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Does the password contain a run of 4+ consecutive keyboard/alphabet chars? */
function hasKeyboardRun(lower: string): boolean {
  for (const run of KEYBOARD_RUNS) {
    for (let i = 0; i + 4 <= run.length; i++) {
      const chunk = run.slice(i, i + 4);
      if (lower.includes(chunk) || lower.includes([...chunk].reverse().join(""))) return true;
    }
  }
  return false;
}

/** Repeated single character, e.g. "aaaa", or a repeated short unit "abab". */
function hasLowVariety(value: string): boolean {
  if (/(.)\1{3,}/.test(value)) return true;
  const unique = new Set(value).size;
  return unique <= Math.max(3, Math.floor(value.length / 4));
}

export function checkPassword(
  password: string,
  context?: { email?: string; fullName?: string },
): PasswordCheck {
  const errors: string[] = [];
  const hints: string[] = [];
  const lower = password.toLowerCase();
  const flat = normalise(password);

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters — length matters more than symbols`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Keep it under ${PASSWORD_MAX_LENGTH} characters`);
  }
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(flat)) {
    errors.push("This is one of the most commonly used passwords. Choose something else");
  }
  if (hasKeyboardRun(lower)) {
    errors.push("Avoid keyboard patterns like qwerty or 1234");
  }
  if (hasLowVariety(password)) {
    errors.push("Avoid repeating the same few characters");
  }

  /*
   * WHY check against the user's own details: name- and email-derived passwords
   * are the first thing a targeted attacker tries, and they are trivially
   * derivable from a LinkedIn page. This is the difference between resisting a
   * dictionary and resisting someone who knows who you are.
   */
  const localPart = context?.email?.split("@")[0] ?? "";
  const personal = [localPart, ...(context?.fullName?.split(/\s+/) ?? [])]
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((p) => p.length >= 4);
  if (personal.some((p) => flat.includes(p))) {
    errors.push("Do not use your name or email address in your password");
  }

  // Score — entropy-ish, weighted heavily toward length.
  let raw = 0;
  if (password.length >= 12) raw += 1;
  if (password.length >= 16) raw += 1;
  if (password.length >= 20) raw += 1;
  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (classes >= 3) raw += 1;
  if (new Set(password).size >= 10) raw += 1;
  if (errors.length) raw = Math.min(raw, 1);

  const score = Math.max(0, Math.min(4, raw)) as PasswordCheck["score"];
  const label = (["Too weak", "Weak", "Fair", "Strong", "Very strong"] as const)[score];

  if (!errors.length) {
    if (password.length < 16) hints.push("A longer passphrase — four unrelated words — is stronger still");
    if (classes < 3) hints.push("Mixing letters, numbers and symbols adds a little more strength");
  }

  return { ok: errors.length === 0, score, label, errors, hints };
}
