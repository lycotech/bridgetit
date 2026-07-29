import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Journey progress used by the Bridge flow, Salary Buffer journey and KYC. */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-y-2", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center">
            <span
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                done && "border-primary/40 bg-primary/10 text-primary",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] tnum",
                  done ? "bg-primary/20" : active ? "bg-primary-foreground/20" : "bg-secondary",
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : index + 1}
              </span>
              <span className="whitespace-nowrap">{step}</span>
            </span>
            {index < steps.length - 1 ? (
              <span
                className={cn("mx-1.5 h-px w-4 sm:w-6", done ? "bg-primary/50" : "bg-border")}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Vertical timeline for transaction tracking. */
export function Timeline({
  events,
}: {
  events: Array<{ label: string; at?: string; note?: string; state: "done" | "current" | "pending" | "failed" }>;
}) {
  return (
    <ol className="relative space-y-5 pl-7">
      <span className="absolute left-[9px] top-2 bottom-2 w-px bg-border" aria-hidden />
      {events.map((event, index) => (
        <li key={index} className="relative">
          <span
            className={cn(
              "absolute -left-7 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2",
              event.state === "done" && "border-primary bg-primary text-primary-foreground",
              event.state === "current" && "border-primary bg-background",
              event.state === "pending" && "border-border bg-background",
              event.state === "failed" && "border-destructive bg-destructive/15",
            )}
          >
            {event.state === "done" ? <Check className="h-2.5 w-2.5" /> : null}
            {event.state === "current" ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            ) : null}
            {event.state === "failed" ? <span className="h-2 w-2 rounded-full bg-destructive" /> : null}
          </span>
          <p
            className={cn(
              "text-sm font-semibold",
              event.state === "pending" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {event.label}
          </p>
          {event.at ? <p className="mt-0.5 text-xs text-muted-foreground tnum">{event.at}</p> : null}
          {event.note ? (
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed",
                event.state === "failed" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {event.note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
