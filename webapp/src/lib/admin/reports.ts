import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdminReportsOverviewView } from "../../../../backend/src/types";

export function useReportsOverview() {
  return useQuery({
    queryKey: ["admin", "reports", "overview"] as const,
    queryFn: () => api.get<AdminReportsOverviewView>("/api/admin/reports/overview"),
    staleTime: 30_000,
  });
}
