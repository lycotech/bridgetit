import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AdminOnboardingStep,
  AdminSessionView,
  AdminSignInInput,
} from "../../../../backend/src/types";

/**
 * The administrator portal's session layer.
 *
 * Deliberately its own module, separate from `lib/account/session.ts` (real
 * customers) and `lib/auth/auth-context.tsx` (the demonstration's local
 * session). Three access routes, three session layers, no shared state — a
 * customer session cannot be mistaken for an administrator's by any code path
 * here, because there is no code path here that reads one.
 *
 * NOTHING in this file decides what an administrator may do. `permissions` and
 * `outstanding` arrive from the server, which recomputes them per request from
 * the AdminUser row. The client uses them only to avoid rendering dead ends; the
 * server refuses the action regardless. See backend/src/security/admin-roles.ts.
 */

export const ADMIN_SESSION_KEY = ["admin", "portal", "session"] as const;

const ANONYMOUS: AdminSessionView = {
  authenticated: false,
  id: null,
  name: null,
  email: null,
  role: null,
  permissions: [],
  mfaEnabled: false,
  outstanding: [],
  lastLoginAt: null,
};

/**
 * Who is signed in.
 *
 * `refetchOnWindowFocus` matters here more than anywhere else in the app: a
 * Super Admin who suspends another administrator expects that to take effect in
 * the other person's open tab, and this is what makes the tab notice.
 */
export function useAdminSession() {
  return useQuery({
    queryKey: ADMIN_SESSION_KEY,
    queryFn: () => api.get<AdminSessionView>("/api/admin/auth/session"),
    // The endpoint answers 200 with authenticated:false rather than 401, so
    // being signed out is a normal result, not an error to retry.
    retry: false,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    placeholderData: ANONYMOUS,
  });
}

export function useAdminSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminSignInInput) => api.post<AdminSessionView>("/api/admin/auth/login", input),
    onSuccess: (data) => qc.setQueryData(ADMIN_SESSION_KEY, data),
  });
}

export function useAdminSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AdminSessionView>("/api/admin/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(ADMIN_SESSION_KEY, ANONYMOUS);
      // Drop everything else this administrator loaded. WHY: the portal caches
      // customer names, KYC decisions and invitation details. Leaving them in
      // memory after sign-out means the next person at the same screen can read
      // them from a stale render.
      qc.removeQueries({ queryKey: ["admin"], exact: false });
    },
  });
}

/* ------------------------------------------------------------ ONBOARDING */

export interface ChangeAdminPasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function useAdminChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeAdminPasswordInput) =>
      api.post<AdminSessionView>("/api/admin/auth/password", input),
    onSuccess: (data) => qc.setQueryData(ADMIN_SESSION_KEY, data),
  });
}

export interface MfaEnrolment {
  /** Base32 secret, for typing into an app that cannot scan. */
  secret: string;
  /** otpauth:// URI, rendered as a QR code. */
  uri: string;
  issuer: string;
}

export function useAdminMfaEnrol() {
  return useMutation({
    mutationFn: (input: { currentPassword?: string }) =>
      api.post<MfaEnrolment>("/api/admin/auth/mfa/enrol", input),
  });
}

export function useAdminMfaEnable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) =>
      api.post<{ session: AdminSessionView; recoveryCodes: string[] }>(
        "/api/admin/auth/mfa/enable",
        input,
      ),
    onSuccess: (data) => qc.setQueryData(ADMIN_SESSION_KEY, data.session),
  });
}

export interface RecoveryDispatch {
  /** Masked for display: "ad•••••@example.com". */
  destination: string;
  delivered: boolean;
  /** Present only in development, when no mail transport is configured. */
  devCode?: string;
}

export function useAdminRecoveryStart() {
  return useMutation({
    mutationFn: (input: { recoveryEmail: string }) =>
      api.post<RecoveryDispatch>("/api/admin/auth/recovery", input),
  });
}

export function useAdminRecoveryConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) =>
      api.post<AdminSessionView>("/api/admin/auth/recovery/confirm", input),
    onSuccess: (data) => qc.setQueryData(ADMIN_SESSION_KEY, data),
  });
}

export function useAdminAcceptPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AdminSessionView>("/api/admin/auth/policy", { accepted: true }),
    onSuccess: (data) => qc.setQueryData(ADMIN_SESSION_KEY, data),
  });
}

/* ----------------------------------------------------------- CONVENIENCE */

/** Does this administrator hold a permission? Presentation only — see above. */
export function adminCan(session: AdminSessionView | undefined, permission: string): boolean {
  return Boolean(session?.permissions.includes(permission));
}

export const ONBOARDING_LABELS: Record<AdminOnboardingStep, string> = {
  password: "Set your password",
  mfa: "Add an authenticator",
  recovery: "Confirm a recovery email",
  policy: "Accept the security policy",
};

/** The step to show: the first one still owed, in the server's order. */
export function currentStep(session: AdminSessionView | undefined): AdminOnboardingStep | null {
  return session?.outstanding[0] ?? null;
}
