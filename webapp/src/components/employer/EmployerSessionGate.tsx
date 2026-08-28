import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmployerLogout, useEmployerSession } from "@/lib/employer/session";
import { EmployerCredentialsForm } from "@/components/employer/EmployerCredentialsForm";

/**
 * Requires a real company (employer-portal) session before revealing its
 * children, inline, without leaving the page it sits on.
 *
 * Mirrors `components/admin/AdminSessionGate.tsx` for the employer side: the
 * mock `/employer/*` demo dashboard is reachable through the same instant
 * demo login every prospect uses, so the real employer-portal data behind it
 * (payroll, salary account requests) stays behind a genuine company sign-in
 * rather than being exposed to any demo guest. The server is the real
 * boundary either way — every /api/employer/* route refuses without a real
 * session — this component just makes that refusal legible instead of a wall
 * of failed requests.
 */
export function EmployerSessionGate({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const session = useEmployerSession();
  const logout = useEmployerLogout();

  if (session.isPending) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking company access…</span>
      </div>
    );
  }

  if (!session.data?.authenticated) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <KeyRound className="h-5 w-5" />
        </span>

        <h2 className="mt-5 font-display text-xl font-extrabold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-6">
          <EmployerCredentialsForm idPrefix="ops-employer" />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          A demonstration invitation is not a company account. Everything done here is recorded
          against the account that signs in.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Live data unlocked for{" "}
          <span className="font-semibold text-foreground">{session.data.employerName ?? session.data.email}</span>.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => queryClient.removeQueries({ queryKey: ["employer"], exact: false }),
            })
          }
          disabled={logout.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Lock
        </Button>
      </div>

      {children}
    </div>
  );
}
