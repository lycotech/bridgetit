import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi, adminKeys } from "@/lib/admin";
import { AdminCredentialsForm } from "@/components/admin/AdminCredentialsForm";

/**
 * Requires a real STAFF session before revealing its children, inline, without
 * leaving the page it sits on.
 *
 * WHY this is necessary and not belt-and-braces. The Operations dashboard sits
 * inside the demonstration environment: everyone viewing it holds a demo
 * invitation. Putting the power to ISSUE demo invitations on a page that every
 * demo viewer can reach would mean any invited guest could invite the next
 * person, and the guest list would grow without anyone authorising it — the one
 * thing the private demo is designed to prevent.
 *
 * So the page is reachable, and visibly exists, but the controls on it are
 * behind PayBridge staff credentials. The real boundary is the server: every
 * /api/admin/* route refuses without an admin session, so a guest who forges
 * their way past this component still cannot issue anything. This component
 * exists to make that refusal legible instead of a wall of failed requests.
 */
export function AdminSessionGate({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: adminKeys.session,
    queryFn: adminApi.session,
    staleTime: 0,
    retry: false,
  });

  const signOut = useMutation({
    mutationFn: adminApi.logout,
    onSuccess: async () => {
      // Drop every cached admin response, not just the session: those caches
      // hold registrant personal data and must not survive a sign-out.
      queryClient.removeQueries({ queryKey: ["admin"] });
      await queryClient.invalidateQueries({ queryKey: adminKeys.session });
    },
  });

  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking staff access…</span>
      </div>
    );
  }

  if (!data?.authenticated) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <KeyRound className="h-5 w-5" />
        </span>

        <h2 className="mt-5 font-display text-xl font-extrabold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-6">
          <AdminCredentialsForm idPrefix="ops-staff" />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          A demonstration invitation is not staff access. Everything done here is recorded against
          the account that signs in.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Staff controls unlocked as{" "}
          <span className="font-semibold text-foreground">{data.username}</span>. Actions are
          recorded.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Lock
        </Button>
      </div>

      {children}
    </div>
  );
}
