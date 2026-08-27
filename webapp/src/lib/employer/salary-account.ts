import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  DecideSalaryAccountRequestInput,
  SalaryAccountRequestDetailView,
  SalaryAccountStatus,
} from "../../../../backend/src/types";

/** List-row shape returned by GET /api/employer/salary-accounts/requests. */
export interface SalaryAccountRequestRow {
  id: string;
  reference: string;
  status: SalaryAccountStatus;
  employeeName: string | null;
  staffRef: string;
  newBankName: string;
  newAccountMasked: string;
  requestedAt: string;
  decidedAt: string | null;
}

export function salaryAccountStatusLabel(status: SalaryAccountStatus): string {
  if (status === "pending_review") return "Pending review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function useSalaryAccountRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["employer", "salary-account", "requests"] as const,
    queryFn: () => api.get<{ items: SalaryAccountRequestRow[] }>("/api/employer/salary-accounts/requests"),
    enabled,
  });
}

export function useSalaryAccountRequest(id: string | null) {
  return useQuery({
    queryKey: ["employer", "salary-account", "request", id ?? ""] as const,
    queryFn: () => api.get<SalaryAccountRequestDetailView>(`/api/employer/salary-accounts/requests/${id}`),
    enabled: Boolean(id),
  });
}

export function useDecideSalaryAccountRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideSalaryAccountRequestInput }) =>
      api.post<{ ok: boolean; status: string }>(`/api/employer/salary-accounts/requests/${id}/decide`, input),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["employer", "salary-account", "request", variables.id] });
      void qc.invalidateQueries({ queryKey: ["employer", "salary-account", "requests"] });
      void qc.invalidateQueries({ queryKey: ["employer", "payroll", "model"] });
      void qc.invalidateQueries({ queryKey: ["employer", "payroll", "employees"] });
    },
  });
}
