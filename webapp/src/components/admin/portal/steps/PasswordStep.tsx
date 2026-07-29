import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField } from "@/components/dashboard/forms";
import { useAdminChangePassword } from "@/lib/admin/portal-session";
import { cn } from "@/lib/utils";

/**
 * Step one: replace the temporary password.
 *
 * The rules are shown as live checks rather than a paragraph of small print,
 * because the server will reject a non-conforming password and a rejection that
 * arrives after submitting teaches nothing. These checks mirror
 * backend/src/security/passwords.ts — the server remains the authority, and it
 * additionally refuses passwords containing your own name or email, which is
 * why that failure can still appear below.
 */
const RULES = [
  { test: (v: string) => v.length >= 12, label: "At least 12 characters" },
  { test: (v: string) => /[a-z]/.test(v), label: "A lower-case letter" },
  { test: (v: string) => /[A-Z]/.test(v), label: "An upper-case letter" },
  { test: (v: string) => /\d/.test(v), label: "A number" },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: "A symbol" },
];

export function PasswordStep() {
  const changePassword = useAdminChangePassword();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const satisfied = RULES.every((rule) => rule.test(newPassword));
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword, confirmPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not change your password.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <PasswordField
        label="Temporary password"
        value={currentPassword}
        onChange={setCurrent}
        autoComplete="current-password"
      />

      <div className="h-px bg-border" />

      <PasswordField label="New password" value={newPassword} onChange={setNext} autoComplete="new-password" />

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {RULES.map((rule) => {
          const ok = rule.test(newPassword);
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                ok ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full ring-1",
                  ok ? "bg-primary/15 ring-primary/40" : "ring-border",
                )}
              >
                {ok ? <Check className="h-2.5 w-2.5" /> : null}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>

      <PasswordField
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirm}
        autoComplete="new-password"
        error={confirmPassword.length > 0 && !matches ? "The two passwords do not match." : undefined}
      />

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <ActionButton
        type="submit"
        size="lg"
        loading={changePassword.isPending}
        disabled={!satisfied || !matches || currentPassword.length === 0}
      >
        Set password and continue
      </ActionButton>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Changing your password signs out every other session on your account and sends you an email confirming the
        time and IP address it was changed from.
      </p>
    </form>
  );
}
