import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Shared field primitives for the four registration forms. */

export const inputClass =
  "h-12 rounded-xl border-border bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export function Field({
  id,
  label,
  hint,
  optional,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-sm text-foreground">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span> : null}
      </Label>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      <FieldError message={error} />
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  optional,
  error,
  className,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  registration,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  className?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  registration: Record<string, unknown>;
}) {
  return (
    <Field id={id} label={label} hint={hint} optional={optional} error={error} className={className}>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        className={inputClass}
        {...registration}
      />
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  optional,
  error,
  className,
  rows = 4,
  placeholder,
  registration,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  className?: string;
  rows?: number;
  placeholder?: string;
  registration: Record<string, unknown>;
}) {
  return (
    <Field id={id} label={label} hint={hint} optional={optional} error={error} className={className}>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="min-h-[104px] rounded-xl border-border bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary"
        {...registration}
      />
    </Field>
  );
}

export function SelectField({
  id,
  label,
  hint,
  optional,
  error,
  className,
  placeholder = "Choose one",
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  options: readonly string[];
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} hint={hint} optional={optional} error={error} className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={Boolean(error)} className={inputClass}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function CheckboxField({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(c) => onChange(c === true)}
          aria-invalid={Boolean(error)}
          className="mt-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <Label htmlFor={id} className="text-sm font-normal leading-relaxed text-muted-foreground">
          {children}
        </Label>
      </div>
      <FieldError message={error} />
    </div>
  );
}

/**
 * The two consent checkboxes, always rendered together and always separate.
 *
 * The privacy acknowledgement is required. The updates opt-in is not, and the
 * form submits perfectly well without it — that is what makes it consent.
 */
export function ConsentFields({
  idPrefix,
  privacyAccepted,
  marketingConsent,
  onPrivacyChange,
  onMarketingChange,
  privacyError,
  marketingLabel,
}: {
  idPrefix: string;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  onPrivacyChange: (checked: boolean) => void;
  onMarketingChange: (checked: boolean) => void;
  privacyError?: string;
  marketingLabel: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-secondary/25 p-5">
      <CheckboxField
        id={`${idPrefix}-privacy`}
        checked={privacyAccepted}
        onChange={onPrivacyChange}
        error={privacyError}
      >
        I have read and understood the{" "}
        <Link to="/privacy" target="_blank" className="font-medium text-primary hover:underline">
          privacy policy
        </Link>{" "}
        and consent to PayBridge storing these details to process my registration of interest.
      </CheckboxField>

      <CheckboxField
        id={`${idPrefix}-marketing`}
        checked={marketingConsent}
        onChange={onMarketingChange}
      >
        {marketingLabel}
      </CheckboxField>
    </div>
  );
}

/**
 * Honeypot input. Hidden from sight AND from assistive technology, so it is
 * invisible to every real visitor; automated submitters fill it and are
 * silently discarded server-side.
 */
export function HoneypotField({ registration }: { registration: Record<string, unknown> }) {
  return (
    <div className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
      <label htmlFor="pb-website">Do not fill this in</label>
      <input id="pb-website" type="text" tabIndex={-1} autoComplete="off" {...registration} />
    </div>
  );
}

/**
 * The standing promise on every public form: we do not ask for identity or
 * banking documents here. Stated on the page, not just in the privacy policy,
 * because the people most at risk of a document-harvesting scam in our name
 * are the ones least likely to read a policy page.
 */
export function NoDocumentsNotice({ variant = "employee" }: { variant?: "employee" | "employer" | "capital" }) {
  const line =
    variant === "employer"
      ? "We do not ask for corporate documents at registration. Certificates of incorporation, payroll files and bank details are only requested later, through a secure channel, once a pilot is agreed."
      : variant === "capital"
        ? "We do not ask for identity documents, bank statements or source-of-funds records at registration. Those are only requested later, through a secure verification process, if a structured discussion proceeds."
        : "We will never ask for your BVN, NIN, identity documents, bank statements, payslips or bank login details on this form — or by email. Verification happens later, in a secure portal, only when your employer activates PayBridge.";

  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground")}>
      <span className="font-semibold text-foreground">Your security: </span>
      {line}
    </p>
  );
}
