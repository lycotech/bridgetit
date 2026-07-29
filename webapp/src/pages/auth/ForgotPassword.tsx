import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { TextField } from "@/components/dashboard/forms";
import { useAuth } from "@/lib/auth/auth-context";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send the reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={
        sent
          ? `If an account exists for ${email}, a reset link is on its way. The link expires in 30 minutes.`
          : "Enter the email on your PayBridge account and we will send you a secure reset link."
      }
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/demo/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3.5">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Open the link on this device to finish resetting your password. We never include your password
              in an email.
            </p>
          </div>
          <ActionButton variant="secondary" fullWidth onClick={() => setSent(false)}>
            Use a different email
          </ActionButton>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
            autoComplete="email"
            inputMode="email"
          />

          {error ? (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <ActionButton type="submit" fullWidth size="lg" loading={busy}>
            Send reset link
          </ActionButton>
        </form>
      )}
    </AuthLayout>
  );
}
