import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField, TextField } from "@/components/dashboard/forms";
import { useEmployerLogin } from "@/lib/employer/session";
import { ApiError } from "@/lib/api";

/** Sign-in for a company's PayBridge team — not a customer, not the demo. */
export default function EmployerPortalLogin() {
  const navigate = useNavigate();
  const login = useEmployerLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({
        email,
        password,
        ...(mfaRequired ? (useRecoveryCode ? { recoveryCode: code } : { totp: code }) : {}),
      });
      navigate("/employer-portal", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && (err.data as { code?: string } | undefined)?.code === "MFA_REQUIRED") {
        setMfaRequired(true);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : "We could not sign you in. Please try again.");
    }
  };

  if (mfaRequired) {
    return (
      <AuthLayout
        title="Enter your authenticator code"
        subtitle="Your password was correct. Enter the 6-digit code from your authenticator app to finish signing in."
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField
            label={useRecoveryCode ? "Recovery code" : "6-digit code"}
            value={code}
            onChange={setCode}
            placeholder={useRecoveryCode ? "xxxx-xxxx" : "123456"}
            inputMode={useRecoveryCode ? "text" : "numeric"}
            autoComplete="one-time-code"
          />
          {error ? (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <ActionButton type="submit" fullWidth size="lg" loading={login.isPending}>
            Continue
          </ActionButton>
          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode((v) => !v);
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-sm font-semibold text-primary hover:underline"
          >
            {useRecoveryCode ? "Use my authenticator app instead" : "Use a recovery code instead"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in to your company's PayBridge account"
      subtitle="For your company's admin and team — not a personal PayBridge account."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          New company?{" "}
          <Link to="/employer-portal/register" className="font-semibold text-primary hover:underline">
            Create your company account
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

        <ActionButton type="submit" fullWidth size="lg" loading={login.isPending}>
          Sign in
        </ActionButton>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Repeated failed attempts temporarily lock the account.
        </p>
      </form>
    </AuthLayout>
  );
}
