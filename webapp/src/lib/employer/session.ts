import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AcceptEmployerInviteInput,
  ConfirmTwoFactorInput,
  DisableTwoFactorInput,
  EmployerSessionView,
  EmployerSignInInput,
  EnrolTwoFactorInput,
  RegisterEmployerInput,
  TwoFactorEnrolmentView,
} from "../../../../backend/src/types";

/**
 * The employer portal's session layer — a company's own multi-seat login.
 *
 * Separate from `lib/account/session.ts` (individual customers) and
 * `lib/auth/auth-context.tsx` (the demonstration's local session), for the
 * same reason the three are separate on the server: an employer team member's
 * session cookie is not a customer's, and must not be readable by any code
 * path that expects one.
 */

export const EMPLOYER_SESSION_KEY = ["employer", "session"] as const;

const ANONYMOUS: EmployerSessionView = {
  authenticated: false,
  id: null,
  fullName: null,
  email: null,
  role: null,
  employerId: null,
  employerName: null,
  employerStatus: null,
  twoFactorEnabled: false,
};

export function useEmployerSession() {
  return useQuery({
    queryKey: EMPLOYER_SESSION_KEY,
    queryFn: () => api.get<EmployerSessionView>("/api/employer/session"),
    retry: false,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    placeholderData: ANONYMOUS,
  });
}

export function useEmployerRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterEmployerInput) =>
      api.post<EmployerSessionView>("/api/employer/register", input),
    onSuccess: (data) => qc.setQueryData(EMPLOYER_SESSION_KEY, data),
  });
}

export function useEmployerLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployerSignInInput) => api.post<EmployerSessionView>("/api/employer/login", input),
    onSuccess: (data) => qc.setQueryData(EMPLOYER_SESSION_KEY, data),
  });
}

export function useEmployerLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<EmployerSessionView>("/api/employer/logout"),
    onSuccess: () => {
      qc.setQueryData(EMPLOYER_SESSION_KEY, ANONYMOUS);
      qc.removeQueries({ queryKey: ["employer"], exact: false });
    },
  });
}

export function useEnrolEmployerTwoFactor() {
  return useMutation({
    mutationFn: (input: EnrolTwoFactorInput) => api.post<TwoFactorEnrolmentView>("/api/employer/2fa/enrol", input),
  });
}

export function useEnableEmployerTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmTwoFactorInput) =>
      api.post<{ recoveryCodes: string[] }>("/api/employer/2fa/enable", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: EMPLOYER_SESSION_KEY }),
  });
}

export function useDisableEmployerTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DisableTwoFactorInput) => api.post<{ disabled: boolean }>("/api/employer/2fa/disable", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: EMPLOYER_SESSION_KEY }),
  });
}

export function useAcceptEmployerInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AcceptEmployerInviteInput) =>
      api.post<EmployerSessionView>("/api/employer/team/accept-invite", input),
    onSuccess: (data) => qc.setQueryData(EMPLOYER_SESSION_KEY, data),
  });
}
