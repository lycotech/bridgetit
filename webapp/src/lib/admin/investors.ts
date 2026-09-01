import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AdminInvestorListItem } from "../../../../backend/src/types";

export function useAdminInvestors(q: string) {
  return useQuery({
    queryKey: ["admin", "investors", q] as const,
    queryFn: () => api.get<{ items: AdminInvestorListItem[] }>(`/api/admin/investors${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    staleTime: 10_000,
  });
}
