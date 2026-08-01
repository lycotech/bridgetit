import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  KycCaseView,
  KycQueueItemView,
  KycRejectionReason,
  KycStatus,
} from "../../../../backend/src/types";

/**
 * Client for KYC review.
 *
 * The queue list never carries decrypted identity fields — those only ever
 * arrive from `useKycCase`, fetched one case at a time when a reviewer opens
 * it, because every fetch of that route is a logged read of somebody's
 * identity data. Nothing here prefetches a case nobody has opened yet.
 */

export interface KycFilters {
  status?: KycStatus;
  q?: string;
}

export interface KycQueuePage {
  items: KycQueueItemView[];
  nextCursor: string | null;
  counts: { pending: number; approved: number; rejected: number; notStarted: number };
}

export const PAGE_SIZE = 30;

export const kycKeys = {
  list: (filters: KycFilters) => ["admin", "kyc", "list", filters] as const,
  case: (userId: string) => ["admin", "kyc", "case", userId] as const,
};

function toQuery(filters: KycFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function useKycQueue(filters: KycFilters) {
  return useInfiniteQuery({
    queryKey: kycKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<KycQueuePage>(
        `/api/admin/kyc/queue${toQuery(filters, {
          take: String(PAGE_SIZE),
          ...(pageParam ? { cursor: pageParam } : {}),
        })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

/** One case, decrypted. `enabled` is the caller's choice — opening one is a logged read. */
export function useKycCase(userId: string | null) {
  return useQuery({
    queryKey: kycKeys.case(userId ?? ""),
    queryFn: () => api.get<KycCaseView>(`/api/admin/kyc/${userId}`),
    enabled: Boolean(userId),
    staleTime: 5_000,
  });
}

/**
 * A five-minute link to view one document. Fetched on click, not preloaded —
 * every fetch is a logged read, and a link nobody clicked should not exist.
 */
export function useKycDocumentUrl() {
  return useMutation({
    mutationFn: ({ userId, documentId }: { userId: string; documentId: string }) =>
      api.get<{ url: string; expiresInSeconds: number }>(
        `/api/admin/kyc/${userId}/documents/${documentId}/view-url`,
      ),
  });
}

export interface KycDecisionInput {
  userId: string;
  decision: "approve" | "reject";
  reason?: KycRejectionReason;
  reasonDetail?: string;
  internalNote?: string;
}

export function useKycDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: KycDecisionInput) =>
      api.post<{ userId: string; status: KycStatus; reviewedAt: string; reviewedBy: string }>(
        `/api/admin/kyc/${userId}/decision`,
        input,
      ),
    onSuccess: (_, variables) => {
      // The decided case leaves the pending queue; invalidate rather than patch
      // in place, since it may no longer belong on whatever filter is showing.
      void qc.invalidateQueries({ queryKey: ["admin", "kyc", "list"], exact: false });
      void qc.invalidateQueries({ queryKey: kycKeys.case(variables.userId) });
    },
  });
}

export const KYC_STATUS_TONE: Record<KycStatus, string> = {
  not_started: "border-border bg-secondary/70 text-muted-foreground",
  pending: "border-protected/40 bg-protected/10 text-protected",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};
