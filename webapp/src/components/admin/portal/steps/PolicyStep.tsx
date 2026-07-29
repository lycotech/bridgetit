import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { useAdminAcceptPolicy } from "@/lib/admin/portal-session";

/**
 * Step four: accept the administrator security policy.
 *
 * The acceptance is stored with a version string, so revising this text makes
 * every existing acceptance stale and the step reappears for everyone. That is
 * why the clauses live here as content rather than in a linked PDF nobody opens:
 * what an administrator agreed to has to be the same thing the record says they
 * agreed to.
 */
const CLAUSES = [
  {
    title: "Your credentials are yours alone",
    body: "Never share your password, your authenticator or a recovery code — not with a colleague, not with PayBridge support, not with anyone claiming to be either. No one at PayBridge will ever ask you for them.",
  },
  {
    title: "Customer data is looked at for a reason",
    body: "Open a customer record, a KYC document or an audit entry only when your work requires it. Every view is logged against your name. Curiosity about a person's identity documents is not a reason.",
  },
  {
    title: "Decisions are attributable",
    body: "Approving or rejecting KYC, suspending an account and issuing a demonstration invitation are recorded with your administrator ID, the time, your IP address and the previous and new status. Act as though every decision will be read back to you.",
  },
  {
    title: "Least privilege, always",
    body: "Ask for the narrowest role that lets you do your job, and say so when your access is wider than your work. Do not use another administrator's session, even with their permission.",
  },
  {
    title: "Report anything that looks wrong",
    body: "A sign-in notification you did not cause, a password change you did not make, a device you do not recognise, a colleague's credentials in a message: tell the Super Admin the same day. Reporting early is never penalised.",
  },
  {
    title: "Devices and sessions",
    body: "Use a device with an up-to-date operating system and a screen lock. Sign out on shared machines. Administrator sessions end after 8 hours or 30 minutes of inactivity, and this is not a substitute for signing out.",
  },
];

export function PolicyStep() {
  const accept = useAdminAcceptPolicy();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await accept.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not record your acceptance.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <ol className="space-y-4">
        {CLAUSES.map((clause, index) => (
          <li key={clause.title} className="rounded-2xl border border-border bg-card/60 p-4">
            <p className="flex items-start gap-2.5 text-sm font-semibold text-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-bold text-primary">
                {index + 1}
              </span>
              {clause.title}
            </p>
            <p className="mt-2 pl-8 text-sm leading-relaxed text-muted-foreground">{clause.body}</p>
          </li>
        ))}
      </ol>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm text-foreground">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        I have read the administrator security policy and I accept it.
      </label>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <ActionButton type="submit" size="lg" loading={accept.isPending} disabled={!agreed}>
        Accept and open the portal
      </ActionButton>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Your acceptance is recorded against your administrator account with the date and time. If this policy is
        revised, you will be asked to accept the new version before continuing.
      </p>
    </form>
  );
}
