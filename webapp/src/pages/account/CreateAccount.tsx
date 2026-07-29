import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { CheckboxField, PasswordField, SelectField, TextField } from "@/components/dashboard/forms";
import { useRegister } from "@/lib/account/session";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "../../../../backend/src/types";

/**
 * Public customer registration. Real: it creates a database record, hashes the
 * password server-side and emails a verification code.
 */

const RULES: Array<{ label: string; test: (v: string) => boolean }> = [
  { label: "At least 12 characters", test: (v) => v.length >= 12 },
  { label: "An upper-case and a lower-case letter", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number", test: (v) => /[0-9]/.test(v) },
  { label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function CreateAccount() {
  const navigate = useNavigate();
  const register = useRegister();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("employee");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!privacyAccepted) {
      setError("You must accept the privacy policy to create an account.");
      return;
    }
    try {
      const result = await register.mutateAsync({
        fullName,
        email,
        phone,
        password,
        accountType,
        privacyAccepted: true,
      });
      /*
       * Hand the dispatch note to the next screen through router state rather
       * than a query string: it can carry the code when email delivery is not
       * configured, and a URL is bookmarked, logged by proxies and pasted into
       * chats. Router state lives in memory only.
       */
      navigate("/verify-email", { replace: true, state: { verification: result.verification } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create your account. Please try again.");
    }
  };

  return (
    <AuthLayout
      title="Create your PayBridge account"
      subtitle="Confirm your email, verify your identity, and your account opens once verification is approved."
      footer={
        <div className="space-y-3 text-center text-sm">
          <p className="text-muted-foreground">
            Already registered?{" "}
            <Link to="/sign-in" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
          {/* The softer path, for someone not ready to hand over documents yet. */}
          <p className="text-muted-foreground">
            Only want to express interest for now?{" "}
            <Link to="/get-on-the-bridge" className="font-semibold text-primary hover:underline">
              Get on the Bridge
            </Link>{" "}
            instead — no password or documents needed.
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="As it appears on your ID"
          autoComplete="name"
        />
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          autoComplete="email"
          inputMode="email"
        />
        <TextField
          label="Phone number"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="0801 234 5678"
          autoComplete="tel"
          inputMode="tel"
        />
        <SelectField
          label="I am registering as"
          value={accountType}
          onChange={(value) => setAccountType(value as AccountType)}
          options={ACCOUNT_TYPES.map((type) => ({ value: type, label: ACCOUNT_TYPE_LABELS[type] }))}
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />

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

        <CheckboxField checked={privacyAccepted} onChange={setPrivacyAccepted}>
          I have read and accept the{" "}
          <Link to="/privacy" className="font-semibold text-primary hover:underline">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link to="/terms" className="font-semibold text-primary hover:underline">
            terms of service
          </Link>
          .
        </CheckboxField>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <ActionButton type="submit" fullWidth size="lg" loading={register.isPending}>
          Create account
        </ActionButton>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          We send a 6-digit code to confirm your email address. Identity documents are encrypted before they are
          stored.
        </p>
      </form>
    </AuthLayout>
  );
}
