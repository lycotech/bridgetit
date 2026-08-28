import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@/lib/account/session";
import { ApiError } from "@/lib/api";

/**
 * The customer email/password (+ optional TOTP) form on its own, with no
 * surrounding page — the inline counterpart to the full-page sign-in at
 * /sign-in. Mirrors `AdminCredentialsForm`/`EmployerCredentialsForm`: same
 * reasoning, a different real session underneath (`lib/account/session.ts` —
 * the same login a real capital-partner account uses on `/account`).
 */
export function InvestorCredentialsForm({ idPrefix = "investor" }: { idPrefix?: string }) {
  const login = useSignIn();

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
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 401 &&
        (err.data as { code?: string } | undefined)?.code === "MFA_REQUIRED"
      ) {
        setMfaRequired(true);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : "We could not sign you in. Please try again.");
    }
  };

  if (mfaRequired) {
    return (
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor={`${idPrefix}-mfa-code`}>{useRecoveryCode ? "Recovery code" : "6-digit code"}</Label>
          <Input
            id={`${idPrefix}-mfa-code`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            placeholder={useRecoveryCode ? "xxxx-xxxx" : "123456"}
            className="mt-2 h-11 rounded-xl bg-secondary/40"
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={login.isPending || !code} className="h-11 w-full rounded-full btn-brand text-sm font-semibold">
          {login.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            "Continue"
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            setUseRecoveryCode((v) => !v);
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-xs font-semibold text-primary hover:underline"
        >
          {useRecoveryCode ? "Use my authenticator app instead" : "Use a recovery code instead"}
        </button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <Label htmlFor={`${idPrefix}-email`}>Email address</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          placeholder="you@example.com"
          className="mt-2 h-11 rounded-xl bg-secondary/40"
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-2 h-11 rounded-xl bg-secondary/40"
        />
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={login.isPending || !email.trim() || !password}
        className="h-11 w-full rounded-full btn-brand text-sm font-semibold"
      >
        {login.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
