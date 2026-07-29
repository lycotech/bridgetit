import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AdminOnboardingStep,
  AdminRoleName,
  AdminUserView,
  CreateAdminInput,
  IssuedAdminView,
  UpdateAdminInput,
} from "../../../../backend/src/types";

/**
 * Client for administrator management.
 *
 * Same one-shot rule as the invitation client: `temporaryPassword` exists only
 * in the response to the call that generated it, because the server keeps an
 * argon2id hash. There is deliberately no "fetch the password" hook — the
 * component that receives a mutation result is the only place it can ever be
 * shown.
 *
 * `selfId`, `assignableRoles` and `superAdminCount` come from the list response
 * rather than being inferred in the browser. The server already knows who is
 * calling and what they may hand out; recomputing it here would create a second
 * opinion, and the disabled-button version of a rule is not a rule.
 */
export interface AdminList {
  items: AdminUserView[];
  /** The caller's own row id, or null for the break-glass environment session. */
  selfId: string | null;
  assignableRoles: AdminRoleName[];
  /** Drives the "last Super Admin" warning before the server has to refuse. */
  superAdminCount: number;
}

export const adminKeys = {
  list: () => ["admin", "admins"] as const,
};

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.list(),
    queryFn: () => api.get<AdminList>("/api/admin/admins"),
    staleTime: 15_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: adminKeys.list(), exact: false });
}

export function useCreateAdmin() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateAdminInput) => api.post<IssuedAdminView>("/api/admin/admins", input),
    onSuccess: invalidate,
  });
}

export function useUpdateAdmin() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAdminInput & { id: string }) =>
      api.patch<{ admin: AdminUserView }>(`/api/admin/admins/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useResetAdminPassword() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<IssuedAdminView>(`/api/admin/admins/${id}/reset-password`, {}),
    onSuccess: invalidate,
  });
}

export function useSignOutAdmin() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<{ admin: AdminUserView }>(`/api/admin/admins/${id}/sign-out`, {}),
    onSuccess: invalidate,
  });
}

/** Status tone. Paired with a text label everywhere, never colour alone. */
export const ADMIN_STATUS_TONE: Record<string, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  suspended: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const ADMIN_STEP_LABELS: Record<AdminOnboardingStep, string> = {
  password: "Change password",
  mfa: "Authenticator",
  recovery: "Recovery address",
  policy: "Accept policy",
};

/** One-line description of what each role can reach. Shown at the point of choice. */
export const ADMIN_ROLE_SCOPE: Record<AdminRoleName, string> = {
  super_admin: "Everything, including administrators and security settings.",
  kyc_reviewer: "Identity checks: approve, reject and request new documents.",
  operations_admin: "Registered users, employers and outgoing mail.",
  demo_manager: "Demonstration invitations only.",
  auditor: "Read-only. Can see the audit trail, can change nothing.",
};
