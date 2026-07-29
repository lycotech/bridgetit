import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateInvitationInput, InvitationStatus, InvitationView } from "../../../../backend/src/types";

/**
 * Client for the demonstration-invitation manager.
 *
 * The one thing to understand about this module: `code` comes back exactly once,
 * from `useCreateInvitation` and `useResendInvitation`. There is no "fetch the
 * code" hook, and there cannot be — the server stores a hash. Every component
 * that shows a code must show it immediately, from the mutation result, and
 * accept that navigating away loses it.
 */
export interface InvitationFilters {
  status?: InvitationStatus | "";
  q?: string;
}

export interface InvitationList {
  items: InvitationView[];
  counts: Record<"total" | "pending" | "opened" | "used" | "expired" | "revoked", number>;
}

/** A created or reissued invitation, with the plaintext code attached once. */
export interface IssuedInvitation {
  invitation: InvitationView;
  code: string;
  emailed: boolean;
  note: string;
}

export const invitationKeys = {
  list: (filters: InvitationFilters) => ["admin", "invitations", filters] as const,
};

function query(filters: InvitationFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function useInvitations(filters: InvitationFilters) {
  return useQuery({
    queryKey: invitationKeys.list(filters),
    queryFn: () => api.get<InvitationList>(`/api/admin/invitations${query(filters)}`),
    staleTime: 15_000,
  });
}

/** Anything that mutates an invitation invalidates every filtered list. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "invitations"], exact: false });
}

export function useCreateInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateInvitationInput) => api.post<IssuedInvitation>("/api/admin/invitations", input),
    onSuccess: invalidate,
  });
}

export function useResendInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<IssuedInvitation>(`/api/admin/invitations/${id}/resend`, {}),
    onSuccess: invalidate,
  });
}

export function useExtendInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, expiresAt }: { id: string; expiresAt: string }) =>
      api.post<{ invitation: InvitationView }>(`/api/admin/invitations/${id}/extend`, { expiresAt }),
    onSuccess: invalidate,
  });
}

export function useRevokeInvitation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<{ invitation: InvitationView }>(`/api/admin/invitations/${id}/revoke`, { reason }),
    onSuccess: invalidate,
  });
}

/** Tailwind classes per status. Kept beside the client so both lists agree. */
export const INVITATION_STATUS_TONE: Record<InvitationStatus, string> = {
  pending: "border-border bg-secondary/60 text-muted-foreground",
  opened: "border-primary/40 bg-primary/10 text-primary",
  used: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  expired: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  revoked: "border-destructive/40 bg-destructive/10 text-destructive",
};
