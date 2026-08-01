import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { PasswordField, TextField } from "@/components/dashboard/forms";
import { useEmployerRegister } from "@/lib/employer/session";

const RULES: Array<{ label: string; test: (v: string) => boolean }> = [
  { label: "At least 12 characters", test: (v) => v.length >= 12 },
  { label: "An upper-case and a lower-case letter", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number", test: (v) => /[0-9]/.test(v) },
  { label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/**
 * Real employer company onboarding. NOT the pre-launch "Get on the Bridge"
 * interest form (registrations.ts / lib/registrations.ts) — that captures a
 * lead for the pilot pipeline and creates no account. This creates a real
 * `Employer` company record and its first `employer_admin` team member.
 */
export default function EmployerPortalRegister() {
  const navigate = useNavigate();
  const register = useEmployerRegister();

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({ companyName, fullName, email, phone, password });
      navigate("/employer-portal", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create your company account. Please try again.");
    }
  };

  return (
    <AuthLayout
      title="Create your company's PayBridge account"
      subtitle="You'll be the admin for this account and can invite colleagues from your team once you're in."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have a company account?{" "}
          <Link to="/employer-portal/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Company name" value={companyName} onChange={setCompanyName} placeholder="Acme Nigeria Ltd" />
        <TextField label="Your full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <TextField
          label="Work email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          autoComplete="email"
          inputMode="email"
        />
        <TextField
          label="Phone number (optional)"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="0801 234 5678"
          autoComplete="tel"
          inputMode="tel"
        />
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />

        <ul className="grid gap-1.5 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
          {RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs font-medium ${met ? "text-primary" : "text-muted-foreground"}`}
              >
                <Check className={`h-3.5 w-3.5 ${met ? "opacity-100" : "opacity-30"}`} />
                {rule.label}
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={register.isPending}>
          Create company account
        </ActionButton>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          This creates your company's account for real — not a demo. Your company profile can be completed after
          you sign in.
        </p>
      </form>
    </AuthLayout>
  );
}
