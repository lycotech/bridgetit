import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField } from "@/components/dashboard/forms";
import { useAcceptEmployerInvite } from "@/lib/employer/session";

/** Where a colleague lands after clicking the invite link in their email. */
export default function EmployerPortalAcceptInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const accept = useAcceptEmployerInvite();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await accept.mutateAsync({ token, password });
      navigate("/employer-portal", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That invitation link is invalid or has expired.");
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invitation link incomplete" subtitle="This link is missing its invitation token.">
        <p className="text-sm text-muted-foreground">
          Ask whoever invited you to send the invitation again from Team settings.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" subtitle="Finish joining your company's PayBridge account.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <ActionButton type="submit" fullWidth size="lg" loading={accept.isPending}>
          Join the team
        </ActionButton>
      </form>
    </AuthLayout>
  );
}
