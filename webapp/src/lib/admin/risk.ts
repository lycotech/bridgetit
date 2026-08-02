import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  AuthorityDecisionView,
  BridgeDrawView,
  CreditDecisionView,
  RecordCreditDecisionInput,
  RiskEmployerListItem,
  RiskScoreView,
} from "../../../../backend/src/types";

export function useRiskEmployers(q: string) {
  return useQuery({
    queryKey: ["admin", "risk", "employers", q] as const,
    queryFn: () => api.get<{ items: RiskEmployerListItem[] }>(`/api/admin/risk/employers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    staleTime: 10_000,
  });
}

export function useRiskScore(employerId: string | null) {
  return useQuery({
    queryKey: ["admin", "risk", "score", employerId ?? ""] as const,
    queryFn: () => api.get<RiskScoreView | null>(`/api/admin/risk/employers/${employerId}/score`),
    enabled: Boolean(employerId),
  });
}

export function useCalculateScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employerId: string) => api.post<RiskScoreView>(`/api/admin/risk/employers/${employerId}/score`),
    onSuccess: (data, employerId) => {
      qc.setQueryData(["admin", "risk", "score", employerId], data);
      void qc.invalidateQueries({ queryKey: ["admin", "risk", "employers"], exact: false });
    },
  });
}

/** Pulls the authority explanation out of a failed decision, if the server sent one. */
export function authorityFromError(err: unknown): AuthorityDecisionView | undefined {
  if (err instanceof ApiError && err.data && typeof err.data === "object" && "authority" in err.data) {
    return (err.data as { authority?: AuthorityDecisionView }).authority;
  }
  return undefined;
}

export function useRecordDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employerId, ...input }: RecordCreditDecisionInput & { employerId: string }) =>
      api.post<CreditDecisionView>(`/api/admin/risk/employers/${employerId}/decision`, input),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["admin", "risk", "decisions", variables.employerId] });
      void qc.invalidateQueries({ queryKey: ["admin", "risk", "employers"], exact: false });
    },
  });
}

export function useDecisions(employerId: string | null) {
  return useQuery({
    queryKey: ["admin", "risk", "decisions", employerId ?? ""] as const,
    queryFn: () => api.get<{ items: CreditDecisionView[] }>(`/api/admin/risk/employers/${employerId}/decisions`),
    enabled: Boolean(employerId),
  });
}

export function useEmployerDraws(employerId: string | null) {
  return useQuery({
    queryKey: ["admin", "risk", "draws", employerId ?? ""] as const,
    queryFn: () => api.get<{ items: BridgeDrawView[] }>(`/api/admin/risk/employers/${employerId}/draws`),
    enabled: Boolean(employerId),
  });
}

export interface AdminCreditLimitView {
  id: string;
  product: string;
  approvedAmount: number;
  availableAmount: number;
  status: string;
  effectiveFrom: string;
}

export function useEmployerLimits(employerId: string | null) {
  return useQuery({
    queryKey: ["admin", "risk", "limits", employerId ?? ""] as const,
    queryFn: () => api.get<{ items: AdminCreditLimitView[] }>(`/api/admin/risk/employers/${employerId}/limits`),
    enabled: Boolean(employerId),
  });
}

export function useSecondDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employerId, decisionId }: { employerId: string; decisionId: string }) =>
      api.post<CreditDecisionView>(`/api/admin/risk/employers/${employerId}/decision/${decisionId}/second`),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["admin", "risk", "decisions", variables.employerId] });
      void qc.invalidateQueries({ queryKey: ["admin", "risk", "employers"], exact: false });
    },
  });
}
