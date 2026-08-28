import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession, useSignOut } from "@/lib/account/session";
import { InvestorCredentialsForm } from "@/components/investor/InvestorCredentialsForm";

/**
 * Requires a real, active capital-partner (investor) account before revealing
 * its children, inline, without leaving the page it sits on.
 *
 * Mirrors `AdminSessionGate`/`EmployerSessionGate` for the investor side, with
 * one extra step the other two don't need: there is no separate real investor
 * login at all — investing lives on the same customer session as `/account`
 * (`lib/account/session.ts`), gated by `accountType === "investor"` AND a
 * `gate` that must actually reach "active" (verified + KYC approved) before
 * `/api/investments/*` will do anything. A demo guest signing in as any other
 * account type, or a real account still mid-verification, gets an honest
 * explanation here instead of an empty/erroring panel.
 */
export function InvestorSessionGate({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const session = useSession();
  const signOut = useSignOut();

  if (session.isPending) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking account access…</span>
      </div>
    );
  }

  const data = session.data;
  const authenticated = Boolean(data && data.gate !== "anonymous");

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <KeyRound className="h-5 w-5" />
        </span>

        <h2 className="mt-5 font-display text-xl font-extrabold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-6">
          <InvestorCredentialsForm idPrefix="ops-investor" />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          A demonstration invitation is not a real PayBridge account. Everything done here is
          recorded against the account that signs in.
        </p>
      </div>
    );
  }

  const notInvestor = data!.user?.accountType !== "investor";
  const notActive = data!.gate !== "active";

  const lockButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        signOut.mutate(undefined, {
          onSuccess: () => queryClient.removeQueries({ queryKey: ["account"], exact: false }),
        })
      }
      disabled={signOut.isPending}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Lock
    </Button>
  );

  if (notInvestor || notActive) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <h2 className="mt-5 font-display text-xl font-extrabold text-foreground">
          {notInvestor ? "Not a capital-partner account" : "Account not yet active"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {notInvestor
            ? "This account is signed in, but it is not registered as a capital-partner (investor) account, so there is no investment data to show."
            : "This account has not finished verification yet, so investment features are not unlocked. Complete verification on the real /account page first."}
        </p>
        <div className="mt-6">{lockButton}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Live data unlocked for{" "}
          <span className="font-semibold text-foreground">{data!.user?.fullName ?? data!.user?.email}</span>.
        </p>
        {lockButton}
      </div>

      {children}
    </div>
  );
}
