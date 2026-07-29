import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField, TextField } from "@/components/dashboard/forms";
import { Button } from "@/components/ui/button";
import { useAdminSession, useAdminSignIn } from "@/lib/admin/portal-session";
import { ApiError } from "@/lib/api";

/**
 * Administrator sign-in, at /admin/login.
 *
 * NOT linked from the public navigation or the footer, by instruction. That is
 * an anti-nuisance measure, not a security control — every protection that
 * matters is on the server: rate limiting, per-account lockout, a mandatory
 * second factor, and a session that can reach nothing until the four first-run
 * obligations are met.
 *
 * Two steps, because a second factor cannot be collected before we know whether
 * the account has one. The password step returns MFA_REQUIRED and no session;
 * the code step re-sends both. WHY resend the password rather than hold a
 * half-authenticated session server-side: a partial session is a credential, and
 * one that exists between two screens is one an attacker can try to use.
 */
export default function AdminPortalLogin() {
  const navigate = useNavigate();
  const session = useAdminSession();
  const signIn = useAdminSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in: the shell decides between the wizard and the dashboard.
  if (session.data?.authenticated) return <Navigate to="/admin" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await signIn.mutateAsync({
        email,
        password,
        totp: needsCode && !useRecoveryCode ? code : undefined,
        recoveryCode: needsCode && useRecoveryCode ? code : undefined,
      });
      navigate("/admin", { replace: true });
    } catch (err) {
      const apiCode = err instanceof ApiError ? (err.data as { code?: string } | undefined)?.code : undefined;

      if (apiCode === "MFA_REQUIRED") {
        setNeedsCode(true);
        setError(null);
        return;
      }
      if (apiCode === "MFA_INVALID") {
        setCode("");
      }
      /*
       * Every other failure resets to the password step, including an expired
       * temporary password and a locked account. The server's message is shown
       * verbatim — it is written to be safe to display and is the only place that
       * knows how many minutes a lockout has left.
       */
      if (apiCode !== "MFA_INVALID") setNeedsCode(false);
      setError(err instanceof Error ? err.message : "We could not sign you in. Please try again.");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid opacity-[0.28]" />
        <div
          className="absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.16), transparent)" }}
        />
      </div>

      <header className="relative border-b border-border/70">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 md:px-8">
          <Logo className="h-9" />
          <span className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Internal
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-14">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              {needsCode ? <KeyRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </span>

            <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">
              {needsCode ? "Two-step verification" : "Administrator sign-in"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {needsCode
                ? useRecoveryCode
                  ? "Enter one of the recovery codes you saved when you set up your authenticator. Each code works once."
                  : "Enter the 6-digit code from your authenticator app."
                : "PayBridge operations portal. Every sign-in and every action taken here is recorded."}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              {needsCode ? (
                <>
                  <TextField
                    label={useRecoveryCode ? "Recovery code" : "Authentication code"}
                    value={code}
                    onChange={setCode}
                    placeholder={useRecoveryCode ? "XXXXX-XXXXX" : "123456"}
                    autoComplete="one-time-code"
                    inputMode={useRecoveryCode ? "text" : "numeric"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecoveryCode((prev) => !prev);
                      setCode("");
                      setError(null);
                    }}
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {useRecoveryCode
                      ? "Use my authenticator app instead"
                      : "I do not have my authenticator — use a recovery code"}
                  </button>
                </>
              ) : (
                <>
                  <TextField
                    label="Work email address"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@commerceallianceholdings.com"
                    autoComplete="username"
                    inputMode="email"
                  />
                  <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
                </>
              )}

              {error ? (
                <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              ) : null}

              <ActionButton type="submit" fullWidth size="lg" loading={signIn.isPending}>
                {needsCode ? "Verify and continue" : "Continue"}
              </ActionButton>

              {needsCode ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => {
                    setNeedsCode(false);
                    setCode("");
                    setPassword("");
                    setError(null);
                  }}
                >
                  Start again
                </Button>
              ) : null}
            </form>

            <p className="mt-7 flex items-start gap-2 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Repeated failed attempts lock the account for 15 minutes. Administrator sessions end after 8 hours, or 30
              minutes of inactivity.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            This portal is for PayBridge staff. Customers sign in at{" "}
            <a href="/sign-in" className="font-semibold text-foreground underline-offset-4 hover:underline">
              getpaybridge.com/sign-in
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
