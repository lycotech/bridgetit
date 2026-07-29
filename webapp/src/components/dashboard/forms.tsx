import { useId, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { AlertCircle, Check, Eye, EyeOff, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitiseFileName, validateFiles, type FileRejection } from "@/lib/security/file-upload";
import { naira } from "@/lib/platform/format";

/** Form primitives shared by the auth screens and every dashboard form. */

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/60 focus:outline-none disabled:opacity-60";

/**
 * The ids a field's help text and error message are published under.
 *
 * Derived from the control's own id rather than generated separately, so a
 * control and its description can never end up pointing at different elements
 * — which is the usual way `aria-describedby` silently stops working.
 */
export function fieldIds(id: string) {
  return { errorId: `${id}-error`, hintId: `${id}-hint` };
}

/**
 * What to put in `aria-describedby`. The error wins: when a field is wrong, the
 * correction is the only thing a screen reader needs to hear, and reading the
 * placeholder hint first buries it.
 */
export function describedBy(id: string, state: { error?: string; hint?: string }): string | undefined {
  const { errorId, hintId } = fieldIds(id);
  if (state.error) return errorId;
  if (state.hint) return hintId;
  return undefined;
}

/**
 * Label, help text and error message for one control.
 *
 * Three accessibility decisions live here, so every form in PayBridge inherits
 * them rather than remembering them:
 *
 *   1. "Required" and "Optional" are WORDS, not a coloured asterisk. An asterisk
 *      is a convention a first-time smartphone user has not learned, and colour
 *      alone communicates nothing to someone who cannot see it (WCAG 1.4.1).
 *   2. The error carries `role="alert"`, so it is announced the moment it
 *      appears — a message that is only visible is not an error message for a
 *      screen-reader user (3.3.1).
 *   3. The error also carries an icon and text, never colour alone.
 */
export function FieldShell({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
  required,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  /** Renders a visible "Required" marker. Set `aria-required` on the control too. */
  required?: boolean;
  className?: string;
}) {
  const ids = htmlFor ? fieldIds(htmlFor) : { errorId: undefined, hintId: undefined };
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {optional ? (
          <span className="text-xs text-muted-foreground">Optional</span>
        ) : required ? (
          <span className="text-xs text-muted-foreground">Required</span>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p
          id={ids.errorId}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={ids.hintId} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  error,
  optional,
  required,
  autoComplete,
  inputMode,
  className,
  disabled,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric" | "tel";
  className?: string;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      htmlFor={id}
      optional={optional}
      required={required}
      className={className}
    >
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD_CLASS, error && "border-destructive/60")}
      />
    </FieldShell>
  );
}

/**
 * Password entry with a reveal toggle.
 *
 * The reveal is an accessibility feature as much as a convenience: WCAG 2.2's
 * Accessible Authentication (3.3.8) is about not forcing a cognitive test, and
 * being able to SEE what you typed is how someone who cannot touch-type, or who
 * is copying a temporary password off a phone screen, gets in without help.
 * `aria-pressed` publishes the toggle's state so it is not a mystery button.
 */
export function PasswordField({
  label = "Password",
  value,
  onChange,
  hint,
  error,
  autoComplete = "current-password",
  required,
  name,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  name?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} required={required}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { error, hint })}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD_CLASS, "pr-12", error && "border-destructive/60")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  className,
  required,
  disabled,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  error?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      htmlFor={id}
      className={className}
      required={required}
    >
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD_CLASS, error && "border-destructive/60")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  rows = 4,
  optional,
  required,
  maxLength,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  rows?: number;
  optional?: boolean;
  required?: boolean;
  maxLength?: number;
  name?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id} optional={optional} required={required}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/60 focus:outline-none",
          error && "border-destructive/60",
        )}
      />
    </FieldShell>
  );
}

/** Naira amount field with live formatting and quick-amount chips. */
export function MoneyField({
  label,
  value,
  onChange,
  max,
  min = 0,
  hint,
  error,
  quickAmounts,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
  hint?: string;
  error?: string;
  quickAmounts?: number[];
}) {
  const id = useId();
  const [raw, setRaw] = useState(value ? String(value) : "");

  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, "");
    setRaw(digits);
    onChange(digits ? Number(digits) : 0);
  };

  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-base font-bold text-muted-foreground">
          ₦
        </span>
        <input
          id={id}
          inputMode="numeric"
          value={raw ? Number(raw).toLocaleString("en-NG") : ""}
          onChange={handle}
          placeholder="0"
          className={cn(
            FIELD_CLASS,
            "h-14 pl-9 font-display text-xl font-extrabold tnum",
            error && "border-destructive/60",
          )}
        />
      </div>
      {quickAmounts?.length ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setRaw(String(amount));
                onChange(amount);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                value === amount
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {naira(amount)}
            </button>
          ))}
          {max !== undefined ? (
            <button
              type="button"
              onClick={() => {
                setRaw(String(max));
                onChange(max);
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Maximum
            </button>
          ) : null}
        </div>
      ) : null}
      {min > 0 ? null : null}
    </FieldShell>
  );
}

/**
 * Checkbox with a custom box.
 *
 * The real `<input type="checkbox">` is present and merely visually hidden, so
 * the control keeps its native keyboard behaviour (space to toggle), its native
 * role, and its position in the tab order. A `<div role="checkbox">` would have
 * had to reimplement all three, and usually reimplements two.
 *
 * `peer-focus-visible` moves the focus ring onto the box the sighted user is
 * actually looking at — the input itself is 0×0, so its own outline would be
 * invisible.
 */
export function CheckboxField({
  label,
  checked,
  onChange,
  error,
  children,
  required,
  name,
}: {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children?: ReactNode;
  required?: boolean;
  name?: string;
}) {
  const id = useId();
  const { errorId } = fieldIds(id);
  return (
    <div>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--ring))]",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
            error && !checked && "border-destructive/60",
          )}
        >
          {checked ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
        <span className="text-sm leading-relaxed text-muted-foreground">{children ?? label}</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * 6-box OTP / PIN entry with paste support.
 *
 * WHY paste is explicitly supported rather than blocked: WCAG 2.2 Accessible
 * Authentication (3.3.8) treats "transcribe this code by hand" as a cognitive
 * function test. Blocking paste — a common and well-meant anti-phishing habit —
 * is exactly the failure. Someone using a password manager, a screen reader, or
 * one working hand pastes the code; everyone else types it.
 *
 * The boxes are wrapped in a `<fieldset>` with a real `<legend>` so a screen
 * reader announces "Verification code, Digit 1 of 6" rather than six unrelated
 * one-character inputs, and `autoComplete="one-time-code"` lets the phone offer
 * the SMS code itself.
 */
export function OtpField({
  value,
  onChange,
  length = 6,
  label = "Verification code",
  error,
  hint,
  secure = false,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  error?: string;
  hint?: string;
  secure?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const setDigit = (index: number, digit: string) => {
    const next = value.split("");
    next[index] = digit;
    const joined = next.join("").replace(/\s/g, "").slice(0, length);
    onChange(joined);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  };

  const groupId = useId();
  const { errorId, hintId } = fieldIds(groupId);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <div className="mt-2 flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            value={digit.trim()}
            type={secure ? "password" : "text"}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            onChange={(e) => setDigit(index, e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[index].trim() && index > 0) {
                refs.current[index - 1]?.focus();
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text").replace(/[^\d]/g, "").slice(0, length);
              if (pasted) onChange(pasted);
            }}
            className={cn(
              "h-14 w-full rounded-xl border border-border bg-background text-center font-display text-xl font-extrabold text-foreground transition-colors focus:border-primary/60 focus:outline-none",
              error && "border-destructive/60",
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

export interface SimulatedFile {
  name: string;
  sizeKb: number;
  category: string;
}

/** File / CSV upload simulation used by payroll, buffer documents and KYC. */
export function UploadDropzone({
  label,
  hint,
  accept = ".csv,.xlsx,.pdf,.png,.jpg",
  category = "Document",
  files,
  onFilesChange,
  multiple = true,
}: {
  label: string;
  hint?: string;
  accept?: string;
  category?: string;
  files: SimulatedFile[];
  onFilesChange: (files: SimulatedFile[]) => void;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rejections, setRejections] = useState<FileRejection[]>([]);

  // Derive the enforced allowlist from the same `accept` string the picker
  // shows, so the hint the user sees and the rule we apply cannot drift apart.
  const allowedExtensions = accept
    .split(",")
    .map((part) => part.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);

  /*
   * Every file is validated before it is accepted.
   *
   * WHY here and not only on the <input accept> attribute: `accept` is a
   * file-picker hint. Drag-and-drop ignores it completely, and so does anyone
   * scripting the page. This runs on BOTH paths (drop and picker) because the
   * drop handler is exactly the one an attacker uses.
   *
   * WHY the filename is sanitised even though this is a client-side
   * simulation: the name is rendered back into the UI and would be sent to the
   * server on the real implementation. "../../payroll.csv" and names carrying
   * control characters must never survive to either.
   *
   * The server MUST repeat all of this — magic-byte sniffing, size limit, and
   * storage outside the web root with a generated name. Client validation is
   * for fast feedback; it is not the control.
   */
  const ingest = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setRejections([]);

    const { accepted, rejected } = validateFiles(list, { allowedExtensions: allowedExtensions });

    const incoming: SimulatedFile[] = accepted.map((file) => ({
      name: sanitiseFileName(file.name),
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      category,
    }));

    await new Promise((resolve) => setTimeout(resolve, 900));
    if (incoming.length) onFilesChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
    if (rejected.length) setRejections(rejected);
    setBusy(false);
  };

  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void ingest(e.dataTransfer.files);
        }}
        className={cn(
          "mt-2 rounded-2xl border border-dashed px-4 py-7 text-center transition-colors",
          dragging ? "border-primary/70 bg-primary/[0.06]" : "border-border bg-secondary/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => void ingest(e.target.files)}
        />
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">
          {busy ? "Reading your file…" : "Drop your file here"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint ?? "CSV, XLSX or PDF up to 10MB"}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          Choose file
        </button>
      </div>

      {files.length ? (
        <ul className="mt-3 space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground tnum">
                  {file.sizeKb.toLocaleString()} KB · {file.category}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onFilesChange(files.filter((_, index) => index !== i))}
                aria-label={`Remove ${file.name}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {rejections.length ? (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {rejections.map((rejection) => (
            <li
              key={`${rejection.fileName}-${rejection.reason}`}
              className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/[0.07] px-3 py-2 text-xs font-medium text-destructive"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{rejection.fileName}</span>
                {rejection.reason}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Toggle used in settings screens.
 *
 * Three things make it usable without sight or fine motor control:
 *
 *   - The hit area is 44×44 CSS px even though the track is 24 px tall. The
 *     track stays small because that is what the design wants; the target does
 *     not, because a 24 px target is a miss for anyone with a tremor.
 *   - `role="switch"` + `aria-checked` means a screen reader says "on" / "off"
 *     rather than leaving the state to the visual position of a dot.
 *   - A visible On / Off word sits beside it, so the state is never carried by
 *     colour and position alone (WCAG 1.4.1).
 *
 * The description is wired up with `aria-describedby` rather than folded into
 * the label: it is context, not the name of the control.
 */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  /** Words for the two states, when "On / Off" is not the clearest pair. */
  stateLabels = ["On", "Off"],
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  stateLabels?: [string, string];
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={id} className="text-sm font-semibold text-foreground">
          {title}
        </p>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "hidden text-xs font-semibold sm:inline",
            checked ? "text-primary" : "text-muted-foreground",
          )}
        >
          {checked ? stateLabels[0] : stateLabels[1]}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}
          aria-describedby={description ? descriptionId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        >
          <span
            aria-hidden
            className={cn(
              "relative block h-6 w-11 rounded-full transition-colors",
              checked ? "bg-primary" : "bg-secondary ring-1 ring-inset ring-border",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                checked ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * A group of large, tappable choices — one selected at a time.
 *
 * Built on real radio inputs inside a `<fieldset>`, so arrow keys move between
 * options, the group announces its own question, and the whole card is a 44 px+
 * target. Used for the accessibility questions, where the alternative — a
 * `<select>` of abstract labels — is exactly what a first-time smartphone user
 * cannot operate.
 */
export function RadioCards<T extends string>({
  legend,
  hint,
  value,
  onChange,
  options,
  columns = 1,
  name,
}: {
  legend: string;
  hint?: string;
  value: T | "";
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; description?: string; icon?: ReactNode }>;
  columns?: 1 | 2;
  name?: string;
}) {
  const id = useId();
  const groupName = name ?? id;
  const hintId = `${id}-hint`;

  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <div className={cn("mt-3 grid gap-2.5", columns === 2 && "sm:grid-cols-2")}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                selected
                  ? "border-primary/60 bg-primary/[0.07]"
                  : "border-border bg-secondary/25 hover:border-primary/40",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--ring))]",
                  selected ? "border-primary" : "border-border",
                )}
              >
                {selected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {option.icon ? (
                    <span aria-hidden className="text-muted-foreground">
                      {option.icon}
                    </span>
                  ) : null}
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
