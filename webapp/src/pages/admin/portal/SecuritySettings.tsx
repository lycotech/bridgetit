import { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField } from "@/components/dashboard/forms";
import { MfaStep } from "@/components/admin/portal/steps/MfaStep";
import { AdminDisplaySettings } from "@/components/admin/portal/DisplaySettings";
import { Button } from "@/components/ui/button";
import { useAdminChangePassword, useAdminSession } from "@/lib/admin/portal-session";
import { ADMIN_ROLE_LABELS } from "../../../../../backend/src/types";

/**
 * Security settings — the same controls as the first-run wizard, available
 * afterwards.
 *
 * Change Password reuses the identical endpoint the wizard uses, so the rules,
 * the session invalidation and the notification email cannot drift between
 * "first time" and "every time after".
 */
function ChangePassword() {
  const changePassword = useAdminChangePassword();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDone(false);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword, confirmPassword });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not change your password.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <PasswordField
        label="Current password"
        value={currentPassword}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <PasswordField
        label="New password"
        value={newPassword}
        onChange={setNext}
        autoComplete="new-password"
        hint="At least 12 characters, with upper and lower case, a number and a symbol."
      />
      <PasswordField
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirm}
        autoComplete="new-password"
        error={confirmPassword.length > 0 && confirmPassword !== newPassword ? "The two passwords do not match." : undefined}
      />

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-3 text-sm font-medium text-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Password changed. Every other session on your account has been signed out and a confirmation email has been
          sent.
        </p>
      ) : null}

      <ActionButton
        type="submit"
        loading={changePassword.isPending}
        disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
      >
        Change password
      </ActionButton>
    </form>
  );
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof KeyRound;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SecuritySettings() {
  const session = useAdminSession();
  const [replacingMfa, setReplacingMfa] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security settings"
        description="Your credentials, your second factor, your session and how the console is displayed."
      />

      <section className="rounded-2xl border border-border bg-card/60 p-5 md:p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Administrator</dt>
            <dd className="mt-1.5 text-sm font-semibold text-foreground">{session.data?.name}</dd>
            <dd className="text-xs text-muted-foreground">{session.data?.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Role</dt>
            <dd className="mt-1.5 text-sm font-semibold text-foreground">
              {session.data?.role ? ADMIN_ROLE_LABELS[session.data.role] : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Last sign-in</dt>
            <dd className="mt-1.5 text-sm font-semibold text-foreground">
              {session.data?.lastLoginAt ? new Date(session.data.lastLoginAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Ahead of the credential panels on purpose: an administrator who
          cannot comfortably read this page needs the control that fixes that
          before anything asking them to type a password carefully. */}
      <Panel
        title="Display & accessibility"
        description="How the Admin Console is drawn. These are display settings only — they change nothing about your account or permissions."
        icon={Eye}
      >
        <AdminDisplaySettings />
      </Panel>

      <Panel
        title="Change password"
        description="Changing your password signs out every other session and emails you a confirmation with the time and IP address."
        icon={KeyRound}
      >
        <ChangePassword />
      </Panel>

      <Panel
        title="Authenticator app"
        description="A time-based code from your phone, required at every sign-in."
        icon={Smartphone}
      >
        {replacingMfa ? (
          <div className="space-y-4">
            {/* A working authenticator can only be replaced by proving the password. */}
            <MfaStep requirePassword={session.data?.mfaEnabled ?? false} />
            <Button variant="ghost" size="sm" onClick={() => setReplacingMfa(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {session.data?.mfaEnabled ? "An authenticator is enrolled on this account." : "No authenticator enrolled."}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Replacing it issues a new secret and a new set of recovery codes; the old ones stop working immediately.
              You will be asked for your password first.
            </p>
            <Button variant="outline" size="sm" onClick={() => setReplacingMfa(true)}>
              Replace authenticator
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
