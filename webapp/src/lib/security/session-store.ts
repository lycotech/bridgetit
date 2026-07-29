import type { User } from "@/lib/platform/models";

/**
 * Client session storage with expiry, rotation and tamper detection.
 *
 * WHAT WAS WRONG
 * The prototype wrote the whole user object — including `role` and `accountId`
 * — to localStorage as plain JSON, with:
 *   - no expiry at all (a session survived indefinitely),
 *   - no idle timeout (an unattended HR workstation stayed signed in),
 *   - no session identifier (so nothing could be rotated or revoked),
 *   - no integrity marker (edit `"role":"employee"` → `"super_admin"` in
 *     devtools and the UI unlocks the operations portal).
 *
 * BE HONEST ABOUT WHAT CAN AND CANNOT BE FIXED HERE
 * A browser-only session cannot be made tamper-PROOF. The user owns the
 * machine; any secret we ship can be read, and any check we run can be
 * skipped. Therefore:
 *
 *   - What this module DOES fix: accidental corruption, stale sessions,
 *     unbounded lifetime, cross-tab logout, and casual tampering (the fingerprint
 *     makes hand-edited records fail closed rather than silently escalate).
 *
 *   - What ONLY the server can fix: authorisation. The real control is
 *     backend/src/security/session.ts — an HttpOnly, signed cookie the browser
 *     cannot read or forge, with the role resolved server-side on every request.
 *     Until every route enforces that, the client role is a rendering hint and
 *     nothing more. This is stated in SECURITY.md as an accepted, tracked risk
 *     of the prototype rather than quietly papered over.
 *
 * DESIGN DECISIONS
 *
 * 1. sessionStorage is the DEFAULT; localStorage only on explicit "remember me".
 *    WHY: sessionStorage dies with the tab, so a shared or public machine does
 *    not keep a payroll session alive after the browser closes. Persistence
 *    becomes a choice the user makes, not a default they inherit.
 *
 * 2. Absolute expiry (12h) AND idle expiry (30m), enforced on every read.
 *    WHY both: absolute caps the value of a stolen record no matter how active
 *    it is kept; idle protects the walked-away-from desk. Checking on read
 *    rather than on a timer means an expired session cannot be resurrected by
 *    reloading the page.
 *
 * 3. A session id that is REGENERATED on every authentication.
 *    WHY: session fixation. If an attacker can plant a session identifier
 *    before the victim authenticates, and that identifier survives login, the
 *    attacker's copy becomes an authenticated session. Minting a fresh id at
 *    the moment privilege changes breaks that chain. The same rule applies to
 *    role changes and MFA completion.
 *
 * 4. Cross-tab synchronisation via the `storage` event.
 *    WHY: signing out in one tab must sign out everywhere. Otherwise "log out"
 *    is a lie in a workflow where HR keeps four dashboard tabs open.
 */

const SESSION_KEY = "pb_session_v2";
const LEGACY_KEYS = ["pb_session_v1"];
const PENDING_KEY = "pb_pending_v2";
const LEGACY_PENDING_KEYS = ["pb_pending_v1"];

/** 12 hours. Matches the server-side absolute TTL so the two cannot disagree. */
export const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
/** 30 minutes of no activity. */
export const IDLE_TTL_MS = 30 * 60 * 1000;

export interface StoredSession {
  user: User;
  /** Rotated on every privilege transition. */
  sid: string;
  /** Issued at (ms epoch) — drives absolute expiry. */
  iat: number;
  /** Last activity (ms epoch) — drives idle expiry. */
  seen: number;
  /** Has the second factor been satisfied in THIS session? */
  mfa: boolean;
  /** Tamper marker — see `fingerprint`. */
  fp: string;
}

function randomId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 24);
}

/**
 * Non-cryptographic fingerprint over the security-relevant fields.
 *
 * WHY not an HMAC: an HMAC needs a key, and any key shipped to the browser is
 * readable by the person we would be defending against. Pretending otherwise
 * would be security theatre. This is an integrity CHECKSUM: it makes a
 * hand-edited record fail closed (session dropped, user re-authenticates)
 * rather than silently granting the edited role. It raises the effort from
 * "change one word in devtools" to "read the algorithm and recompute" — which
 * is worth doing precisely because it is cheap, while the real control lives
 * on the server.
 */
function fingerprint(input: { sid: string; iat: number; role: string; id: string; accountId?: string }): string {
  const data = `${input.sid}|${input.iat}|${input.role}|${input.id}|${input.accountId ?? ""}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

function stores(): Storage[] {
  return [sessionStorage, localStorage];
}

/** Read, validate and slide the session. Returns null if absent or invalid. */
export function loadSession(): StoredSession | null {
  for (const store of stores()) {
    let raw: string | null = null;
    try {
      raw = store.getItem(SESSION_KEY);
    } catch {
      continue;
    }
    if (!raw) continue;

    let parsed: StoredSession;
    try {
      parsed = JSON.parse(raw) as StoredSession;
    } catch {
      store.removeItem(SESSION_KEY);
      continue;
    }

    const now = Date.now();
    const expectedFp = fingerprint({
      sid: parsed.sid,
      iat: parsed.iat,
      role: parsed.user?.role ?? "",
      id: parsed.user?.id ?? "",
      accountId: parsed.user?.accountId,
    });

    const invalid =
      !parsed.user ||
      !parsed.sid ||
      parsed.fp !== expectedFp || // tampered or corrupted → fail closed
      now - parsed.iat > ABSOLUTE_TTL_MS || // absolute expiry
      now - parsed.seen > IDLE_TTL_MS; // idle expiry

    if (invalid) {
      clearSession();
      return null;
    }

    return parsed;
  }
  return null;
}

/**
 * Persist a session, always minting a NEW session id.
 * Call this on sign-in, on MFA completion, and on any role change.
 */
export function startSession(user: User, options: { remember: boolean; mfa: boolean }): StoredSession {
  const now = Date.now();
  const sid = randomId(); // rotation: never reuse an inbound identifier
  const session: StoredSession = {
    user,
    sid,
    iat: now,
    seen: now,
    mfa: options.mfa,
    fp: fingerprint({ sid, iat: now, role: user.role, id: user.id, accountId: user.accountId }),
  };
  persist(session, options.remember);
  return session;
}

/** Update the stored user without changing the security envelope's lifetime. */
export function updateSessionUser(current: StoredSession, user: User): StoredSession {
  // A role change is a privilege transition, so it rotates the id.
  const roleChanged = user.role !== current.user.role;
  const sid = roleChanged ? randomId() : current.sid;
  const iat = roleChanged ? Date.now() : current.iat;
  const next: StoredSession = {
    ...current,
    user,
    sid,
    iat,
    seen: Date.now(),
    fp: fingerprint({ sid, iat, role: user.role, id: user.id, accountId: user.accountId }),
  };
  persist(next, isRemembered());
  return next;
}

/** Slide the idle window. Cheap enough to call on user activity. */
export function touchSession(current: StoredSession): StoredSession {
  const next = { ...current, seen: Date.now() };
  persist(next, isRemembered());
  return next;
}

function persist(session: StoredSession, remember: boolean): void {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  try {
    target.setItem(SESSION_KEY, JSON.stringify(session));
    other.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable — the user stays signed in for this page only */
  }
}

export function isRemembered(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  for (const store of stores()) {
    try {
      store.removeItem(SESSION_KEY);
      store.removeItem(PENDING_KEY);
      for (const legacy of [...LEGACY_KEYS, ...LEGACY_PENDING_KEYS]) store.removeItem(legacy);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Pending (pre-MFA) state.
 *
 * WHY sessionStorage only, and WHY it never contains a password: this record
 * exists for the seconds between "password accepted" and "code entered". It is
 * an unauthenticated half-state, so it must not survive the tab, must not be
 * shared with other tabs, and must carry the minimum needed to finish the step.
 * It also carries its own short expiry — an OTP challenge left open for an hour
 * is a challenge someone else can finish.
 */
const PENDING_TTL_MS = 10 * 60 * 1000;

export interface PendingRecord<T> {
  value: T;
  at: number;
}

export function savePending<T>(value: T): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ value, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function loadPending<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRecord<T>;
    if (Date.now() - parsed.at > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function clearPending(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** Subscribe to sign-out in another tab. Returns an unsubscribe function. */
export function onSessionChangedElsewhere(handler: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) handler();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export const SESSION_STORAGE_KEY = SESSION_KEY;
