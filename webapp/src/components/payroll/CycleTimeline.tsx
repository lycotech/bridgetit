import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAYROLL_STAGES } from "@/lib/platform/models";
import type { PayrollStage } from "@/lib/platform/models";

/**
 * The payroll cycle, start to close. Horizontal on desktop, a compact vertical
 * rail on mobile — the same ten stages either way so nobody loses their place.
 */
export function CycleTimeline({ stage, className }: { stage: PayrollStage; className?: string }) {
  const current = PAYROLL_STAGES.indexOf(stage);

  return (
    <ol className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-5", className)}>
      {PAYROLL_STAGES.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
              done && "border-primary/30 bg-primary/6",
              active && "border-primary bg-primary/10 shadow-sm",
              !done && !active && "border-border/70 bg-secondary/40",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tnum",
                done && "bg-primary/20 text-primary",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-semibold leading-tight",
                active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
