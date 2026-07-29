import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { ADMIN_ONBOARDING_STEPS } from "../../../../../backend/src/types";
import type { AdminOnboardingStep } from "../../../../../backend/src/types";
import { ONBOARDING_LABELS } from "@/lib/admin/portal-session";

/**
 * Frame for the four first-run steps.
 *
 * The stepper reads its state from the server's `outstanding` list, not from
 * local progress: these steps are a security requirement, so which ones are done
 * is the server's answer. A refresh mid-wizard therefore resumes exactly where
 * the account actually is, and a step cannot be skipped by navigating.
 */
export function OnboardingShell({
  step,
  outstanding,
  title,
  intro,
  children,
}: {
  step: AdminOnboardingStep;
  outstanding: AdminOnboardingStep[];
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const done = (candidate: AdminOnboardingStep) => !outstanding.includes(candidate);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid opacity-[0.25]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 md:px-8">
        <Logo className="h-8" />

        <div className="mt-10 grid flex-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Setup progress">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Account setup
            </p>
            <ol className="mt-5 space-y-1">
              {ADMIN_ONBOARDING_STEPS.map((candidate, index) => {
                const isDone = done(candidate);
                const isCurrent = candidate === step;
                return (
                  <li
                    key={candidate}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isCurrent ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1",
                        isDone
                          ? "bg-primary text-primary-foreground ring-primary"
                          : isCurrent
                            ? "bg-primary/15 text-primary ring-primary/40"
                            : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    {ONBOARDING_LABELS[candidate]}
                  </li>
                );
              })}
            </ol>

            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              All four steps are required before the portal opens. Nothing else is reachable until they are complete.
            </p>
          </nav>

          <main className="max-w-xl pb-16">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</p>
            <div className="mt-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
