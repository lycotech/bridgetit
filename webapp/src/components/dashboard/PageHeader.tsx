import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Consistent page intro for every dashboard route. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

/** Primary / secondary / ghost buttons matching the public site's CTA styling. */
export function ActionButton({
  children,
  onClick,
  to,
  variant = "primary",
  size = "default",
  icon,
  disabled,
  loading,
  type = "button",
  className,
  fullWidth,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** Renders the button as a router link. */
  to?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
  fullWidth?: boolean;
}) {
  const variantClass = {
    primary:
      "btn-brand shadow-[0_10px_30px_-14px_hsl(var(--primary)/0.8)] hover:shadow-[0_14px_38px_-12px_hsl(var(--primary)/0.9)] hover:-translate-y-px",
    secondary: "border border-border bg-secondary/60 text-foreground hover:border-primary/50 hover:text-primary",
    ghost: "border border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    danger: "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
  }[variant];

  const sizeClass = {
    sm: "px-3.5 py-2 text-xs",
    default: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  }[size];

  const shellClass = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-55",
    variantClass,
    sizeClass,
    fullWidth && "w-full",
    className,
  );

  const inner = (
    <>
      {loading ? (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon
      )}
      {children}
    </>
  );

  if (to && !disabled && !loading) {
    return (
      <Link to={to} onClick={onClick} className={shellClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={shellClass}>
      {inner}
    </button>
  );
}
