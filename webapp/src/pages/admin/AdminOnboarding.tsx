import { OnboardingShell } from "@/components/admin/portal/OnboardingShell";
import { MfaStep } from "@/components/admin/portal/steps/MfaStep";
import { PasswordStep } from "@/components/admin/portal/steps/PasswordStep";
import { PolicyStep } from "@/components/admin/portal/steps/PolicyStep";
import { RecoveryStep } from "@/components/admin/portal/steps/RecoveryStep";
import type { AdminOnboardingStep, AdminSessionView } from "../../../../backend/src/types";

const COPY: Record<AdminOnboardingStep, { title: string; intro: string }> = {
  password: {
    title: "Choose your own password",
    intro:
      "The password you signed in with was generated for this deployment and has now been used, so it no longer works. Set one only you know.",
  },
  mfa: {
    title: "Add a second factor",
    intro:
      "A password alone is one stolen laptop away from full access to customer identity documents. An authenticator app closes that gap and is required for every administrator.",
  },
  recovery: {
    title: "Confirm a recovery email",
    intro:
      "A second address we can reach you at if you lose access to this one — and where security notices about your account are also sent.",
  },
  policy: {
    title: "Administrator security policy",
    intro: "Six commitments, then the portal opens. Your acceptance is recorded against your account.",
  },
};

/**
 * The first-run wizard, shown whenever the server says a step is outstanding.
 *
 * Which step appears is decided entirely by `session.outstanding` — the client
 * never advances on its own. A completed step disappears from that list on the
 * next response, so the wizard moves forward as a consequence of the server
 * agreeing that it should.
 */
export function AdminOnboarding({ session }: { session: AdminSessionView }) {
  const step = session.outstanding[0];
  if (!step) return null;

  const copy = COPY[step];

  return (
    <OnboardingShell step={step} outstanding={session.outstanding} title={copy.title} intro={copy.intro}>
      {step === "password" ? <PasswordStep /> : null}
      {step === "mfa" ? <MfaStep /> : null}
      {step === "recovery" ? <RecoveryStep /> : null}
      {step === "policy" ? <PolicyStep /> : null}
    </OnboardingShell>
  );
}
