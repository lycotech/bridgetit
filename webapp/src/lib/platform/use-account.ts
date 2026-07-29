import { useAuth } from "@/lib/auth/auth-context";
import { DEMO_IDS } from "./mock-service";

/**
 * Resolves which record the signed-in user acts on behalf of. Falls back to the
 * demo record so a freshly registered prototype account still has data to show.
 */
export function useAccountId(kind: "employee" | "employer" | "investor"): string {
  const { user } = useAuth();
  return user?.accountId ?? DEMO_IDS[kind];
}

export function useActorName(): string {
  const { user } = useAuth();
  return user?.fullName ?? "PayBridge user";
}
