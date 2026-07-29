import { useState } from "react";
import { AlertCircle, MailWarning } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { OtpField, TextField } from "@/components/dashboard/forms";
import { Button } from "@/components/ui/button";
import { useAdminRecoveryConfirm, useAdminRecoveryStart, type RecoveryDispatch } from "@/lib/admin/portal-session";

/**
 * Step three: nominate a second address and prove you can read it.
 *
 * The address is only accepted once a code sent to it comes back. An unproven
 * recovery address is either a typo — which quietly removes your way back into a
 * privileged account — or somebody else's inbox that has just become one.
 */
export function RecoveryStep() {
  const start = useAdminRecoveryStart();
  const confirm = useAdminRecoveryConfirm();

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<RecoveryDispatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      setSent(await start.mutateAsync({ recoveryEmail }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send the code.");
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await confirm.mutateAsync({ code });
    } catch (err) {
      setCode("");
      setError(err instanceof Error ? err.message : "That code was not accepted.");
    }
  };

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-5" noValidate>
        <TextField
          label="Recovery email address"
          type="email"
          value={recoveryEmail}
          onChange={setRecoveryEmail}
          placeholder="another-address@example.com"
          autoComplete="email"
          inputMode="email"
          hint="Must be different from your sign-in address — a recovery address in the same inbox recovers nothing."
        />

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" size="lg" loading={start.isPending} disabled={recoveryEmail.trim().length < 5}>
          Send confirmation code
        </ActionButton>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-5" noValidate>
      <p className="text-sm leading-relaxed text-muted-foreground">
        We sent a 6-digit code to <span className="font-semibold text-foreground">{sent.destination}</span>. It expires
        in 15 minutes.
      </p>

      {/*
        Development only: with no mail transport configured the server hands back
        the code it could not deliver, so the setup can be completed. It is never
        present once mail is live — the field simply does not exist in the
        response. See backend/src/routes/admin-auth.ts.
      */}
      {sent.devCode ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm text-foreground">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            No mail service is connected yet, so nothing was actually sent. Your code is{" "}
            <span className="font-mono font-bold tracking-wider">{sent.devCode}</span>.
          </span>
        </p>
      ) : null}

      <OtpField label="Confirmation code" value={code} onChange={setCode} />

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton type="submit" size="lg" loading={confirm.isPending} disabled={code.trim().length < 6}>
          Confirm address
        </ActionButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSent(null);
            setCode("");
            setError(null);
          }}
        >
          Use a different address
        </Button>
      </div>
    </form>
  );
}
