import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { DemoRolePanel } from "@/components/auth/DemoRolePanel";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { CheckboxField, PasswordField, SelectField, TextField } from "@/components/dashboard/forms";
import { useAuth } from "@/lib/auth/auth-context";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { DEMO_USERS } from "@/lib/platform/mock-data";
import { PUBLIC_SIGNUP_ROLES, ROLES } from "@/lib/platform/roles";
import type { Role } from "@/lib/platform/models";

const INTERNAL_ROLES: Role[] = ["ops_officer", "ops_risk", "ops_compliance", "ops_finance", "super_admin"];

/** Matches a typed email to a demo account so the right role is pre-selected. */
function roleForEmail(email: string): Role | null {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;
  const match = Object.values(DEMO_USERS).find((user) => user.email === normalised);
  return match ? match.role : null;
}

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const staffMode = params.get("portal") === "operations";
  // Sanitise on the way IN as well as on the way out: defence in depth means a
  // hostile `next` never survives long enough to be forwarded to /verify.
  const rawNext = params.get("next");
  const next = rawNext ? safeNextPath(rawNext, "") : "";
  const roleParam = params.get("role") as Role | null;
  const roleOptions = staffMode ? INTERNAL_ROLES : PUBLIC_SIGNUP_ROLES;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(
    roleParam && ROLES[roleParam] ? roleParam : (roleOptions[0] as Role),
  );
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEmail = (value: string) => {
    setEmail(value);
    const detected = roleForEmail(value);
    if (detected && roleOptions.includes(detected)) setRole(detected);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn({ email, password, role, remember });
      const search = new URLSearchParams();
      if (next) search.set("next", next);
      navigate(`/demo/verify${search.toString() ? `?${search.toString()}` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={staffMode ? "PayBridge staff sign-in" : "Welcome back"}
      subtitle={
        staffMode
          ? "Internal access to the PayBridge operations control centre."
          : "Sign in to reach your earned pay, your payroll continuity tools or your portfolio."
      }
      footer={
        <div className="space-y-4">
          {staffMode ? null : (
            <p className="text-center text-sm text-muted-foreground">
              New to PayBridge?{" "}
              <Link to="/demo/select-role" className="font-semibold text-primary hover:underline">
                Create an account
              </Link>
            </p>
          )}
          <DemoRolePanel />
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={handleEmail}
          placeholder="you@company.com"
          autoComplete="email"
          inputMode="email"
        />
        <PasswordField value={password} onChange={setPassword} />
        <SelectField
          label={staffMode ? "Internal role" : "Sign in as"}
          value={role}
          onChange={(value) => setRole(value as Role)}
          options={roleOptions.map((option) => ({ value: option, label: ROLES[option].label }))}
          hint={ROLES[role].description}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <CheckboxField checked={remember} onChange={setRemember}>
            Remember me on this device
          </CheckboxField>
          <Link
            to="/demo/forgot-password"
            className="text-sm font-semibold text-primary transition-colors hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={busy}>
          Continue
        </ActionButton>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          We send a 6-digit code to confirm it is you. Sessions are signed out automatically after a period
          of inactivity.
        </p>
      </form>
    </AuthLayout>
  );
}
