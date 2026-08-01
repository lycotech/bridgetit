import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  EmployerProfileView,
  EmployerTeamMemberView,
  EmployerTeamRole,
  InviteEmployerTeamMemberInput,
  UpdateEmployerProfileInput,
} from "../../../../backend/src/types";

export function useEmployerProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["employer", "profile"] as const,
    queryFn: () => api.get<EmployerProfileView>("/api/employer/profile"),
    enabled,
  });
}

export function useUpdateEmployerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmployerProfileInput) => api.patch<EmployerProfileView>("/api/employer/profile", input),
    onSuccess: (data) => {
      qc.setQueryData(["employer", "profile"], data);
      void qc.invalidateQueries({ queryKey: ["employer", "session"] });
    },
  });
}

export function useEmployerTeam(enabled: boolean) {
  return useQuery({
    queryKey: ["employer", "team"] as const,
    queryFn: () => api.get<{ items: EmployerTeamMemberView[] }>("/api/employer/team"),
    enabled,
  });
}

export function useInviteEmployerTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteEmployerTeamMemberInput) =>
      api.post<{ id: string; email: string; fullName: string; role: EmployerTeamRole; status: string }>(
        "/api/employer/team/invite",
        input,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["employer", "team"] }),
  });
}
