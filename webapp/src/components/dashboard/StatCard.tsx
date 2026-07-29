import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Metric tile. Value first, context second — no decoration for decoration's sake. */
export function StatCard({
  label,
  value,
  hint,
  delta,
  tone = "default",
  icon,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: string; direction: "up" | "down"; positive?: boolean };
  tone?: "default" | "primary" | "success" | "attention" | "protected";
  icon?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const toneRing = {
    default: "border-border",
    primary: "border-primary/35 bg-primary/[0.06]",
    success: "border-success/40 bg-success/[0.07]",
    attention: "border-gold/40 bg-gold/[0.06]",
    protected: "border-protected/35 bg-protected/[0.06]",
  }[tone];

  /* A teal outline and a teal figure are the same promise, so the value
     picks up the tone too — a card that is only outlined reads as decoration,
     one whose figure carries the colour reads as a result. */
  const toneValue = tone === "success" ? "text-success" : "text-foreground";

  const deltaPositive = delta?.positive ?? delta?.direction === "up";

  return (
    <div className={cn("rounded-2xl border bg-card p-4 sm:p-5", toneRing, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      </div>
      <p
        className={cn(
          "mt-3 font-display text-[1.65rem] font-extrabold leading-none tracking-tight tnum sm:text-3xl",
          toneValue,
        )}
      >
        {value}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold",
              deltaPositive ? "text-success" : "text-gold",
            )}
          >
            {delta.direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {delta.value}
          </span>
        ) : null}
        {hint ? <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span> : null}
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 xl:grid-cols-4",
  }[columns];
  return <div className={cn("grid gap-3 sm:gap-4", cols)}>{children}</div>;
}
