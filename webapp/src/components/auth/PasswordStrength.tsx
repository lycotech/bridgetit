import { Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/security/password-policy";
import { cn } from "@/lib/utils";

/**
 * Password strength meter.
 *
 * WHY show this rather than silently rejecting on submit: a policy the user
 * discovers only after failing is a policy they work around ("Payroll2026!").
 * Live feedback moves the decision to before they commit to a password, which
 * is the difference between a policy that raises real-world strength and one
 * that just annoys people into predictable patterns.
 *
 * WHY the rules are shown as guidance, not as a checklist of character classes:
 * we grade on length and unpredictability (see password-policy.ts). Showing
 * "needs 1 uppercase" trains the exact behaviour that makes passwords weak.
 */
export function PasswordStrength({
  password,
  email,
  fullName,
}: {
  password: string;
  email?: string;
  fullName?: string;
}) {
  if (!password) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Use at least {PASSWORD_MIN_LENGTH} characters. A passphrase of four unrelated words is easier to
        remember and much harder to guess than a short password with symbols.
      </p>
    );
  }

  const verdict = checkPassword(password, { email, fullName });
  const tone =
    verdict.score <= 1
      ? "bg-destructive"
      : verdict.score === 2
        ? "bg-gold"
        : verdict.score === 3
          ? "bg-primary"
          : "bg-success";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1" role="presentation">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("h-full flex-1 rounded-full transition-colors", i < verdict.score ? tone : "bg-border")}
            />
          ))}
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold",
            verdict.ok ? "text-foreground" : "text-destructive",
          )}
          aria-live="polite"
        >
          {verdict.label}
        </span>
      </div>

      {verdict.errors.length ? (
        <ul className="space-y-1">
          {verdict.errors.map((error) => (
            <li key={error} className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive">
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
              {error}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
          Strong enough to use. {verdict.hints[0] ?? "Store it in a password manager."}
        </p>
      )}

      {verdict.ok && verdict.score === 4 ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="h-3 w-3" /> Excellent — this would take an attacker an impractical amount of time.
        </p>
      ) : null}
    </div>
  );
}
