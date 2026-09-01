import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ResetTestAccessPasswordInput,
  TestAccessPasswordResetResult,
  TestAccessProvisionResult,
  TestAccessStatusView,
} from "../../../../backend/src/types";

const STATUS_KEY = ["admin", "test-access", "status"] as const;

export function useTestAccessStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => api.get<TestAccessStatusView>("/api/admin/test-access/status"),
  });
}

export function useProvisionTestAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<TestAccessProvisionResult>("/api/admin/test-access/provision", {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

export function useResetTestAccessPassword() {
  return useMutation({
    mutationFn: (input: ResetTestAccessPasswordInput) =>
      api.post<TestAccessPasswordResetResult>("/api/admin/test-access/reset-password", input),
  });
}
