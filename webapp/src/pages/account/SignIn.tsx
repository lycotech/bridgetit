import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField, TextField } from "@/components/dashboard/forms";
import { GATE_ROUTE, useSignIn } from "@/lib/account/session";

/** Ordinary customer sign-in. Not the demonstration, and not the admin portal. */
export default function SignIn() {
  const navigate = useNavigate();
  const signIn = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const state = await signIn.mutateAsync({ email, password });
      navigate(GATE_ROUTE[state.gate], { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not sign you in. Please try again.");
    }
  };

  return (
    <AuthLayout
      title="Sign in to PayBridge"
      subtitle="Access your account, your verification status and — once approved — your dashboard."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          New to PayBridge?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
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
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={signIn.isPending}>
          Sign in
        </ActionButton>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Repeated failed attempts temporarily lock the account. Sessions expire after a period of inactivity.
        </p>
      </form>
    </AuthLayout>
  );
}
