import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreatePayrollCycleInput,
  EmployeeRecordView,
  PayrollCycleDetailView,
  PayrollCycleView,
  PayrollModel,
  PayrollModelView,
} from "../../../../backend/src/types";

export function usePayrollCycles(enabled: boolean) {
  return useQuery({
    queryKey: ["employer", "payroll", "cycles"] as const,
    queryFn: () => api.get<{ items: PayrollCycleView[] }>("/api/employer/payroll/cycles"),
    enabled,
  });
}

export function usePayrollCycle(cycleId: string | null) {
  return useQuery({
    queryKey: ["employer", "payroll", "cycle", cycleId ?? ""] as const,
    queryFn: () => api.get<PayrollCycleDetailView>(`/api/employer/payroll/cycles/${cycleId}`),
    enabled: Boolean(cycleId),
  });
}

export function useCreatePayrollCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePayrollCycleInput) => api.post<PayrollCycleView>("/api/employer/payroll/cycles", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["employer", "payroll", "cycles"] }),
  });
}

/** CSV upload uses `api.raw` — multipart, not JSON. */
export function useUploadPayrollCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, file }: { cycleId: string; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      const response = await api.raw(`/api/employer/payroll/cycles/${cycleId}/upload`, { method: "POST", body });
      const json = (await response.json().catch(() => null)) as
        | { data?: { recordsImported: number }; error?: { message?: string } }
        | null;
      if (!response.ok) throw new Error(json?.error?.message ?? "That file could not be uploaded.");
      return json?.data;
    },
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["employer", "payroll", "cycles"] });
      void qc.invalidateQueries({ queryKey: ["employer", "payroll", "cycle", variables.cycleId] });
      void qc.invalidateQueries({ queryKey: ["employer", "payroll", "employees"] });
    },
  });
}

export function usePayrollEmployees(enabled: boolean) {
  return useQuery({
    queryKey: ["employer", "payroll", "employees"] as const,
    queryFn: () => api.get<{ items: EmployeeRecordView[] }>("/api/employer/payroll/employees"),
    enabled,
  });
}

export function useInviteEmployeeLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeRecordId, email }: { employeeRecordId: string; email: string }) =>
      api.post<{ ok: boolean }>(`/api/employer/payroll/employees/${employeeRecordId}/invite`, { email }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["employer", "payroll", "employees"] }),
  });
}

export function usePayrollModel(enabled: boolean) {
  return useQuery({
    queryKey: ["employer", "payroll", "model"] as const,
    queryFn: () => api.get<PayrollModelView>("/api/employer/payroll/model"),
    enabled,
  });
}

export function useUpdatePayrollModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payrollModel: PayrollModel) =>
      api.patch<PayrollModelView>("/api/employer/payroll/model", { payrollModel }),
    onSuccess: (data) => qc.setQueryData(["employer", "payroll", "model"], data),
  });
}
