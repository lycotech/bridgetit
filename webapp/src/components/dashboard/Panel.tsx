import { useId, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card surface used across all dashboards — same radius, border and shadow.
 *
 * The heading level is a prop, defaulting to `h2`. WHY it has to be: a panel
 * nested inside another panel's content produces `h2` inside `h2`, and a screen
 * reader user navigating by heading then hears a flat list where the page has
 * structure (WCAG 1.3.1). The `<section>` is labelled by its own heading, so it
 * is announced as a named region rather than an anonymous group.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  footer,
  headingLevel = 2,
  icon,
  tone,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Shown inline before the title. */
  icon?: ReactNode;
  /** Tints the panel's border/background — the tone is conveyed by the icon too, not colour alone. */
  tone?: "info" | "warning" | "success" | "danger";
}) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const toneClass = tone
    ? {
        info: "border-primary/30 bg-primary/[0.06]",
        warning: "border-amber-500/40 bg-amber-500/[0.07]",
        success: "border-primary/40 bg-primary/[0.06]",
        danger: "border-destructive/40 bg-destructive/10",
      }[tone]
    : "border-border bg-card";
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn("overflow-hidden rounded-2xl border", toneClass, className)}
    >
      {title || action ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <Heading
                id={headingId}
                className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground"
              >
                {icon}
                {title}
              </Heading>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      {children ? <div className={cn("px-4 py-4 sm:px-5", bodyClassName)}>{children}</div> : null}
      {footer ? <footer className="border-t border-border/70 px-4 py-3 sm:px-5">{footer}</footer> : null}
    </section>
  );
}

/** Label / value row — the backbone of every review and confirmation screen. */
export function SummaryRow({
  label,
  value,
  hint,
  emphasis = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  emphasis?: boolean;
  tone?: "primary" | "success" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className={cn("text-sm", emphasis ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p> : null}
      </div>
      <p
        className={cn(
          "shrink-0 text-right tnum",
          emphasis ? "font-display text-lg font-extrabold" : "text-sm font-semibold",
          toneClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border/70", className)} aria-hidden />;
}

/** Horizontal meter. Calm fill, never alarming. */
export function ProgressMeter({
  value,
  label,
  right,
  tone = "primary",
  className,
}: {
  value: number;
  label?: string;
  right?: ReactNode;
  tone?: "primary" | "available" | "protected" | "gold" | "danger";
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const fill = {
    primary: "bg-primary",
    available: "bg-available",
    protected: "bg-protected",
    gold: "bg-gold",
    danger: "bg-destructive",
  }[tone];
  return (
    <div className={className}>
      {label || right ? (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          {label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
          {right ? <span className="text-xs font-semibold text-foreground tnum">{right}</span> : null}
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fill)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** Two-segment meter (e.g. bridged vs still available). */
export function SegmentedMeter({
  segments,
  className,
}: {
  segments: { value: number; tone: "primary" | "available" | "protected" | "gold" | "muted"; label?: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const fill: Record<string, string> = {
    primary: "bg-primary",
    available: "bg-available",
    protected: "bg-protected",
    gold: "bg-gold",
    muted: "bg-secondary",
  };
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        {segments.map((segment, i) => (
          <div
            key={i}
            className={cn("h-full transition-[width] duration-700 ease-out", fill[segment.tone])}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments
          .filter((s) => s.label)
          .map((segment, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", fill[segment.tone])} aria-hidden />
              {segment.label}
            </span>
          ))}
      </div>
    </div>
  );
}

/**
 * A short standing note: explanation, reassurance or a warning.
 *
 * Every tone above `neutral` carries an ICON as well as a colour, because the
 * tone is the information — "this is a warning" cannot be conveyed by a gold
 * border to someone who cannot see it, or to someone reading on a monochrome
 * screen in sunlight (WCAG 1.4.1).
 *
 * `role="alert"` is opt-in. Pass it when the note appeared in response to
 * something the user just did — an error, a rejection — so it is announced
 * immediately. Do NOT pass it for standing copy: an alert that is present on
 * load interrupts the page for no reason.
 */
export function InfoNote({
  children,
  tone = "neutral",
  className,
  role,
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "attention";
  className?: string;
  role?: "alert" | "status";
  /** Overrides the tone's default icon. Pass `null` to show none. */
  icon?: ReactNode | null;
}) {
  const toneClass = {
    neutral: "border-border bg-secondary/50 text-muted-foreground",
    primary: "border-primary/30 bg-primary/8 text-foreground",
    success: "border-success/35 bg-success/10 text-foreground",
    attention: "border-gold/40 bg-gold/10 text-foreground",
  }[tone];

  const defaultIcon = {
    neutral: null,
    primary: <Info className="h-3.5 w-3.5 text-primary" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
    attention: <AlertTriangle className="h-3.5 w-3.5 text-gold" />,
  }[tone];

  const shown = icon === undefined ? defaultIcon : icon;

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs leading-relaxed",
        toneClass,
        className,
      )}
    >
      {shown ? (
        <span aria-hidden className="mt-0.5 shrink-0">
          {shown}
        </span>
      ) : null}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
