import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { CheckboxField, PasswordField, SelectField, TextField } from "@/components/dashboard/forms";
import { useAuth } from "@/lib/auth/auth-context";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { checkPassword } from "@/lib/security/password-policy";
import { AUDIENCES, ROLES } from "@/lib/platform/roles";
import type { Role } from "@/lib/platform/models";

type AudienceKey = "employee" | "employer" | "investor";

const ROLE_CHOICES: Record<AudienceKey, Role[]> = {
  employee: ["employee"],
  employer: ["employer_admin", "employer_finance", "employer_hr", "employer_viewer"],
  investor: ["investor"],
};

const ORG_LABEL: Record<AudienceKey, string> = {
  employee: "Employer name",
  employer: "Company name",
  investor: "Investing entity",
};

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { register } = useAuth();

  const audience = ((params.get("audience") as AudienceKey | null) ?? "employee") as AudienceKey;
  const meta = useMemo(() => AUDIENCES.find((a) => a.key === audience) ?? AUDIENCES[0], [audience]);
  const choices = ROLE_CHOICES[audience] ?? ROLE_CHOICES.employee;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [role, setRole] = useState<Role>(choices[0]);
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mirrors the policy enforced in register(). Shown as a disabled button so
  // the requirement is visible before submission, never as the only gate.
  const passwordOk = checkPassword(password, { email, fullName }).ok;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please accept the Terms of Service and Privacy Policy to continue");
      return;
    }
    setBusy(true);
    try {
      await register({ fullName, email, password, role, organisation, phone });
      navigate("/demo/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={`Create your ${meta.title.toLowerCase()} account`}
      subtitle={meta.blurb}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/demo/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
          <span className="mx-2 text-muted-foreground/50">·</span>
          <Link to="/demo/select-role" className="font-semibold text-primary hover:underline">
            Change account type
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Adaeze Okonkwo"
          autoComplete="name"
        />
        <TextField
          label="Work email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          autoComplete="email"
          inputMode="email"
          hint={
            audience === "employee"
              ? "Use the email your employer has on your payroll record."
              : undefined
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Phone number"
            value={phone}
            onChange={setPhone}
            placeholder="0801 234 5678"
            autoComplete="tel"
            inputMode="tel"
            optional
          />
          <TextField
            label={ORG_LABEL[audience]}
            value={organisation}
            onChange={setOrganisation}
            placeholder={audience === "investor" ? "Ardent Capital Partners" : "Kaduna Foods Limited"}
          />
        </div>

        {choices.length > 1 ? (
          <SelectField
            label="Your role"
            value={role}
            onChange={(value) => setRole(value as Role)}
            options={choices.map((choice) => ({ value: choice, label: ROLES[choice].label }))}
            hint={ROLES[role].description}
          />
        ) : null}

        <div className="space-y-2.5">
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordStrength password={password} email={email} fullName={fullName} />
        </div>

        <CheckboxField checked={consent} onChange={setConsent}>
          I agree to the{" "}
          <Link to="/terms" className="font-semibold text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          , and I consent to PayBridge verifying my details with my {audience === "investor" ? "entity" : "employer"}.
        </CheckboxField>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={busy} disabled={!passwordOk}>
          Create account
        </ActionButton>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {audience === "investor"
            ? "Investment products remain subject to legal, regulatory and investment-manager approval."
            : "Access is enabled by your employer. Nothing is charged to you for creating an account."}
        </p>
      </form>
    </AuthLayout>
  );
}
