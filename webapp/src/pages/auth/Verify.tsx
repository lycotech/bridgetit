import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, MailCheck, Smartphone } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { OtpField } from "@/components/dashboard/forms";
import { useAuth, homeRouteFor } from "@/lib/auth/auth-context";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { ROLES } from "@/lib/platform/roles";

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pending, ready, verify, resendCode } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (ready && !pending) navigate("/demo/login", { replace: true });
  }, [ready, pending, navigate]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await verify(code);
      // Open-redirect fix. `next.startsWith("/")` used to be the only check,
      // which accepts "//evil.com" — a protocol-relative URL the browser
      // happily treats as off-site. safeNextPath resolves the candidate with
      // the URL parser and keeps it only if it stays on our origin.
      navigate(safeNextPath(params.get("next"), homeRouteFor(user)), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    await resendCode();
    setResent(true);
    setSeconds(30);
  };

  const destination = pending?.email ?? "your email address";

  return (
    <AuthLayout
      title="Confirm it's you"
      subtitle={`We sent a 6-digit code to ${destination}.`}
      footer={
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {seconds > 0 ? (
              <span className="tnum">You can request a new code in {seconds}s</span>
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                className="font-semibold text-primary transition-colors hover:underline"
              >
                Send a new code
              </button>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Wrong address?{" "}
            <Link to="/demo/login" className="font-semibold text-primary hover:underline">
              Start again
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3.5">
          <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <MailCheck className="h-4 w-4 shrink-0 text-primary" />
            {pending?.intent === "register"
              ? "Verifying your new account"
              : `Signing in as ${pending ? ROLES[pending.role].label : "your role"}`}
          </p>
        </div>

        <OtpField
          value={code}
          onChange={setCode}
          error={error ?? undefined}
          hint="For this prototype, any 6 digits will work — try 123456."
        />

        {resent ? (
          <p className="text-xs font-medium text-primary">A new code is on its way.</p>
        ) : null}

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={busy}>
          Verify and continue
        </ActionButton>

        <div className="rounded-2xl border border-dashed border-border px-4 py-3.5">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            <span>
              <span className="font-semibold text-foreground">Authenticator app (coming soon).</span> You will
              be able to add two-factor authentication from your profile once it is available.
            </span>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
