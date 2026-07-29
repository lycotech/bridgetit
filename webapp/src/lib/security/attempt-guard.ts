/**
 * Account lockout and attempt throttling.
 *
 * WHAT WAS WRONG
 * Sign-in and OTP verification had no attempt counter of any kind. A 6-digit
 * code with unlimited guesses is not a second factor — a script walks the whole
 * 1,000,000-code space in minutes.
 *
 * DESIGN DECISIONS AND WHY
 *
 * 1. Exponential backoff BEFORE hard lockout.
 *    Attempts 1–4 are free. From attempt 5 the wait doubles (30s, 60s, 120s…)
 *    up to a 15-minute cap, and only at attempt 10 does the account lock for
 *    30 minutes. WHY not lock immediately at 5: a hard, immediate lock turns
 *    the login form into a denial-of-service weapon — anyone who knows a
 *    colleague's email can lock them out of their pay on payday. Backoff costs
 *    an attacker almost everything (the guess rate collapses) and costs a
 *    fumbling legitimate user almost nothing.
 *
 * 2. Counters are keyed by identifier, not just by device.
 *    Otherwise clearing cookies resets the counter.
 *
 * 3. The *same* generic error message regardless of why sign-in failed.
 *    "No account with that email" versus "Wrong password" is a user-enumeration
 *    oracle: it confirms which addresses are real, which is the input to
 *    phishing and credential stuffing. One message, both cases.
 *
 * 4. Lockout state is announced honestly to the user, with a countdown.
 *    Hiding it produces support tickets and teaches people the product is
 *    broken; showing "try again in 4:32" is not useful to an attacker who
 *    already knows they are being throttled.
 *
 * WHERE THIS RUNS — AND THE HONEST LIMITATION
 * This implementation is client-side, because the current authentication is a
 * prototype with no auth server. A client-side lockout stops casual and
 * scripted browser-based abuse but is bypassable by anyone calling the API
 * directly. It is written as a pure, storage-backed module specifically so the
 * same policy constants can be lifted into the server when real auth lands.
 * Until then, this control is treated as UX + speed bump, NOT as the
 * anti-brute-force control of record. See SECURITY.md.
 */

const STORE_KEY = "pb_attempts_v1";

/** Free attempts before backoff starts. */
const FREE_ATTEMPTS = 4;
/** Attempts before a hard lock. */
const LOCK_AFTER = 10;
/** Hard lock duration. */
const LOCK_MS = 30 * 60 * 1000;
/** First backoff step; doubles each attempt. */
const BASE_BACKOFF_MS = 30 * 1000;
/** Backoff ceiling. */
const MAX_BACKOFF_MS = 15 * 60 * 1000;
/** Counters older than this are forgotten — a bad day should not follow you. */
const DECAY_MS = 60 * 60 * 1000;

interface AttemptRecord {
  count: number;
  /** Timestamp of the most recent failure. */
  last: number;
  /** Locked until (ms epoch), 0 when not locked. */
  until: number;
}

type Store = Record<string, AttemptRecord>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked — fail open on the UX, never crash sign-in */
  }
}

function keyFor(scope: string, identifier: string): string {
  return `${scope}:${identifier.trim().toLowerCase()}`;
}

export interface AttemptStatus {
  blocked: boolean;
  /** Milliseconds until the next attempt is allowed. */
  retryInMs: number;
  /** Failures recorded so far. */
  attempts: number;
  /** True when the hard lock (not just backoff) is in force. */
  locked: boolean;
}

export function checkAttempts(scope: string, identifier: string): AttemptStatus {
  const store = readStore();
  const key = keyFor(scope, identifier);
  const record = store[key];
  const now = Date.now();

  if (!record || now - record.last > DECAY_MS) {
    return { blocked: false, retryInMs: 0, attempts: 0, locked: false };
  }

  if (record.until > now) {
    return {
      blocked: true,
      retryInMs: record.until - now,
      attempts: record.count,
      locked: record.count >= LOCK_AFTER,
    };
  }

  return { blocked: false, retryInMs: 0, attempts: record.count, locked: false };
}

/** Record a failure and return the resulting status. */
export function recordFailure(scope: string, identifier: string): AttemptStatus {
  const store = readStore();
  const key = keyFor(scope, identifier);
  const now = Date.now();
  const previous = store[key];
  const count = previous && now - previous.last <= DECAY_MS ? previous.count + 1 : 1;

  let until = 0;
  if (count >= LOCK_AFTER) {
    until = now + LOCK_MS;
  } else if (count > FREE_ATTEMPTS) {
    const step = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (count - FREE_ATTEMPTS - 1));
    until = now + step;
  }

  store[key] = { count, last: now, until };
  writeStore(store);

  return {
    blocked: until > now,
    retryInMs: Math.max(0, until - now),
    attempts: count,
    locked: count >= LOCK_AFTER,
  };
}

/** Clear the counter after a genuine success. */
export function clearAttempts(scope: string, identifier: string): void {
  const store = readStore();
  delete store[keyFor(scope, identifier)];
  writeStore(store);
}

/** "4 minutes 32 seconds" — human-readable countdown for the UI. */
export function describeWait(ms: number): string {
  const total = Math.ceil(ms / 1000);
  if (total < 60) return `${total} second${total === 1 ? "" : "s"}`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (!seconds) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} min ${seconds} sec`;
}

export const ATTEMPT_POLICY = {
  FREE_ATTEMPTS,
  LOCK_AFTER,
  LOCK_MS,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  DECAY_MS,
};
