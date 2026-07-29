import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Role, User } from "@/lib/platform/models";
import { DEMO_USERS } from "@/lib/platform/mock-data";
import { homeFor, roleMeta } from "@/lib/platform/roles";
import { initialsOf } from "@/lib/platform/format";
import type { Permission } from "@/lib/platform/roles";
import { checkPassword } from "@/lib/security/password-policy";
import { checkAttempts, clearAttempts, describeWait, recordFailure } from "@/lib/security/attempt-guard";
import {
  clearPending,
  clearSession,
  loadPending,
  loadSession,
  onSessionChangedElsewhere,
  savePending,
  startSession,
  touchSession,
  updateSessionUser,
  type StoredSession,
} from "@/lib/security/session-store";

/**
 * Prototype authentication — hardened.
 *
 * READ THIS FIRST. Credentials are still not verified against a server; there
 * is no auth backend yet. What changed in the security review is that every
 * control that CAN be implemented client-side now is, and every control that
 * CANNOT be is named explicitly rather than left implied:
 *
 *   Implemented here          Why it matters
 *   ------------------------  ----------------------------------------------
 *   Password policy           12+ chars, blocked common/personal passwords.
 *                             Replaces "6 characters, anything goes".
 *   Attempt throttling +      Makes online guessing of a password or a 6-digit
 *     account lockout         OTP economically pointless.
 *   Session expiry            Absolute 12h + idle 30m. Was: never expired.
 *   Session id rotation       Fresh id on sign-in, on MFA, on role change.
 *                             Closes session fixation.
 *   Tamper-evident storage    Hand-edited role fails closed instead of
 *                             escalating.
 *   Cross-tab sign-out        Signing out means signing out everywhere.
 *   Generic failure messages  No user-enumeration oracle on sign-in or reset.
 *   MFA state on the session  `mfaSatisfied` tracks the factor for THIS
 *                             session, not a flag on the user record.
 *
 *   NOT solvable in the browser — server work, tracked in SECURITY.md:
 *   real credential verification, authoritative role assignment, revocation,
 *   and a genuine one-time code. `signInAsDemo` remains a deliberate
 *   demonstration shortcut and MUST be removed before production; it is now
 *   gated on a build flag so it cannot ship by accident.
 */

/**
 * WHY this flag exists: the demo role-switcher grants any role instantly,
 * including super_admin. That is correct for a sales demo and catastrophic in
 * production. Tying it to an explicit env flag (on by default only in dev)
 * means shipping it live takes a deliberate act.
 */
export const DEMO_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";

export interface PendingSession {
  email: string;
  role: Role;
  fullName?: string;
  organisation?: string;
  remember: boolean;
  /** register = new account awaiting verification, login = 2FA step */
  intent: "login" | "register";
}

interface AuthState {
  user: User | null;
  pending: PendingSession | null;
  ready: boolean;
  /** Has the second factor been satisfied in this session? */
  mfaSatisfied: boolean;
}

export class AuthThrottledError extends Error {
  constructor(public retryInMs: number, public locked: boolean) {
    super(
      locked
        ? `Too many attempts. This account is locked for ${describeWait(retryInMs)}.`
        : `Too many attempts. Please wait ${describeWait(retryInMs)} and try again.`,
    );
    this.name = "AuthThrottledError";
  }
}

interface AuthContextValue extends AuthState {
  signIn: (input: { email: string; password: string; role: Role; remember: boolean }) => Promise<PendingSession>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    role: Role;
    organisation?: string;
    phone?: string;
  }) => Promise<PendingSession>;
  verify: (code: string) => Promise<User>;
  resendCode: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  /** Demo shortcut — only available when DEMO_LOGIN_ENABLED. */
  signInAsDemo: (role: Role) => User;
  signOut: () => void;
  can: (permission: Permission) => boolean;
  updateProfile: (patch: Partial<Pick<User, "fullName" | "phone" | "twoFactorEnabled">>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * WHY every credential failure uses this one string: distinguishing "no such
 * account" from "wrong password" tells an attacker which email addresses are
 * real. That list is the raw material for phishing and credential stuffing, and
 * a legitimate user gains nothing from the distinction.
 */
const GENERIC_CREDENTIAL_ERROR =
  "We could not sign you in with those details. Check your email and password and try again.";

/** Builds the signed-in user: demo profile for known roles, else from input. */
function buildUser(input: { email: string; role: Role; fullName?: string; organisation?: string }): User {
  const demo = DEMO_USERS[input.role];
  const usesDemoProfile = !input.fullName || input.email.trim().toLowerCase() === demo.email;
  if (usesDemoProfile) {
    return { ...demo, email: input.email.trim().toLowerCase() || demo.email, lastLoginAt: new Date().toISOString() };
  }
  return {
    ...demo,
    id: `usr_${Date.now()}`,
    fullName: input.fullName as string,
    email: input.email.trim().toLowerCase(),
    organisation: input.organisation ?? demo.organisation,
    avatarInitials: initialsOf(input.fullName as string),
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    pending: null,
    ready: false,
    mfaSatisfied: false,
  });
  const sessionRef = useRef<StoredSession | null>(null);

  // Restore on mount. loadSession() applies absolute/idle expiry and the tamper
  // check, so an expired or edited record never reaches the UI.
  useEffect(() => {
    const restored = loadSession();
    sessionRef.current = restored;
    setState({
      user: restored?.user ?? null,
      pending: loadPending<PendingSession>(),
      ready: true,
      mfaSatisfied: restored?.mfa ?? false,
    });
  }, []);

  /*
   * Idle-timeout enforcement.
   *
   * WHY a poll and not only a check-on-read: a dashboard left open on a shared
   * HR machine makes no further reads, so a read-triggered check would never
   * fire. Every 60 seconds we re-validate; once the idle or absolute window has
   * passed, loadSession() returns null and the user drops to the sign-in screen.
   */
  useEffect(() => {
    if (!state.user) return;
    const interval = window.setInterval(() => {
      if (!loadSession()) {
        sessionRef.current = null;
        setState((prev) => ({ ...prev, user: null, pending: null, mfaSatisfied: false }));
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [state.user]);

  // Slide the idle window on genuine interaction only (throttled writes).
  useEffect(() => {
    if (!state.user) return;
    let last = 0;
    const bump = () => {
      const now = Date.now();
      if (now - last < 30_000) return;
      last = now;
      if (sessionRef.current) sessionRef.current = touchSession(sessionRef.current);
    };
    const events: (keyof WindowEventMap)[] = ["click", "keydown", "pointerdown"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, [state.user]);

  // Cross-tab sign-out.
  useEffect(() => {
    return onSessionChangedElsewhere(() => {
      const current = loadSession();
      sessionRef.current = current;
      setState((prev) => ({
        ...prev,
        user: current?.user ?? null,
        mfaSatisfied: current?.mfa ?? false,
      }));
    });
  }, []);

  const setPending = useCallback((pending: PendingSession | null) => {
    if (pending) savePending(pending);
    else clearPending();
    setState((prev) => ({ ...prev, pending }));
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async ({ email, password, role, remember }) => {
      const identifier = email.trim().toLowerCase();

      // Throttle BEFORE doing any work — a blocked attempt must be cheap.
      const status = checkAttempts("login", identifier);
      if (status.blocked) throw new AuthThrottledError(status.retryInMs, status.locked);

      await wait(700);

      /*
       * WHY the same error AND the same delay for every failure mode: a
       * different message, or a measurably different response time, both leak
       * whether the account exists. The fixed 700ms above equalises timing.
       */
      if (!identifier.includes("@") || identifier.length < 5 || password.length < 8) {
        const next = recordFailure("login", identifier);
        if (next.blocked) throw new AuthThrottledError(next.retryInMs, next.locked);
        throw new Error(GENERIC_CREDENTIAL_ERROR);
      }

      clearAttempts("login", identifier);
      const pending: PendingSession = { email: identifier, role, remember, intent: "login" };
      setPending(pending);
      return pending;
    },
    [setPending],
  );

  const register = useCallback<AuthContextValue["register"]>(
    async ({ fullName, email, password, role, organisation }) => {
      await wait(800);
      if (fullName.trim().length < 2) throw new Error("Enter your full name");
      if (!email.includes("@")) throw new Error("Enter a valid email address");

      /*
       * WHY the full policy runs here rather than a length check: registration
       * is the only moment we can stop a weak password entering the system.
       * Every later control (lockout, MFA) is compensating for a password that
       * should never have been accepted.
       */
      const verdict = checkPassword(password, { email, fullName });
      if (!verdict.ok) throw new Error(verdict.errors[0]);

      const pending: PendingSession = {
        email: email.trim().toLowerCase(),
        role,
        fullName,
        organisation,
        remember: false, // persistence is an explicit user choice, never a default
        intent: "register",
      };
      setPending(pending);
      return pending;
    },
    [setPending],
  );

  const verify = useCallback<AuthContextValue["verify"]>(
    async (code) => {
      const pending = state.pending;
      if (!pending) throw new Error("Your verification session expired. Please sign in again.");

      const identifier = pending.email;
      const status = checkAttempts("otp", identifier);
      if (status.blocked) throw new AuthThrottledError(status.retryInMs, status.locked);

      await wait(700);

      /*
       * WHY throttle an OTP that currently accepts any six digits: the throttle
       * is the control that survives when a real code is wired in. An
       * unthrottled 6-digit code is not a second factor — 1,000,000
       * combinations fall in minutes at network speed. Adding the counter now
       * means the real implementation inherits it instead of shipping without.
       */
      if (!/^\d{6}$/.test(code)) {
        const next = recordFailure("otp", identifier);
        if (next.blocked) throw new AuthThrottledError(next.retryInMs, next.locked);
        throw new Error("That code is not correct. Check the 6 digits and try again.");
      }

      clearAttempts("otp", identifier);
      const user = buildUser(pending);

      /*
       * Session-fixation fix: startSession() mints a NEW session id at this
       * exact point — the moment privilege is granted. Any identifier that
       * existed before authentication is now dead.
       */
      sessionRef.current = startSession(user, { remember: pending.remember, mfa: true });
      clearPending();
      setState((prev) => ({ ...prev, user, pending: null, mfaSatisfied: true }));
      return user;
    },
    [state.pending],
  );

  const resendCode = useCallback(async () => {
    await wait(600);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await wait(800);
    if (!email.includes("@")) throw new Error("Enter a valid email address");
    /*
     * WHY this resolves whether or not the address exists: a reset form that
     * says "no account with that email" is the most commonly abused enumeration
     * oracle on the internet. The user-facing copy is "if that address is
     * registered, we have sent a link" — see ForgotPassword.tsx.
     */
  }, []);

  const signInAsDemo = useCallback<AuthContextValue["signInAsDemo"]>((role) => {
    if (!DEMO_LOGIN_ENABLED) throw new Error("Demo sign-in is disabled in this environment.");
    const user = { ...DEMO_USERS[role], lastLoginAt: new Date().toISOString() };
    sessionRef.current = startSession(user, { remember: false, mfa: true });
    clearPending();
    setState((prev) => ({ ...prev, user, pending: null, mfaSatisfied: true }));
    return user;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    clearPending();
    sessionRef.current = null;
    setState((prev) => ({ ...prev, user: null, pending: null, mfaSatisfied: false }));
  }, []);

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>((patch) => {
    setState((prev) => {
      if (!prev.user || !sessionRef.current) return prev;
      const user: User = { ...prev.user, ...patch };
      if (patch.fullName) user.avatarInitials = initialsOf(patch.fullName);
      // updateSessionUser rotates the session id if the role changed.
      sessionRef.current = updateSessionUser(sessionRef.current, user);
      return { ...prev, user };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      register,
      verify,
      resendCode,
      requestPasswordReset,
      signInAsDemo,
      signOut,
      updateProfile,
      /*
       * WHY permissions are re-derived from the role on every call instead of
       * being cached in the session: a cached permission list in client storage
       * is one more thing an attacker can edit. Deriving from the role leaves
       * exactly one field to protect — and the server-side copy of this map
       * (backend/src/security/rbac.ts) is the one that actually decides.
       */
      can: (permission) => (state.user ? roleMeta(state.user.role).permissions.includes(permission) : false),
    }),
    [state, signIn, register, verify, resendCode, requestPasswordReset, signInAsDemo, signOut, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Where a signed-in user belongs. */
export function homeRouteFor(user: User | null): string {
  return user ? homeFor(user.role) : "/demo/login";
}
