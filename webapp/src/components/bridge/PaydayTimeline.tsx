import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime, longDate, naira } from "@/lib/platform/format";
import type { BridgeRequest } from "@/lib/platform/models";

type StageState = "done" | "current" | "pending" | "failed";

interface Stage {
  label: string;
  at?: string;
  estimate: string;
  note?: string;
  state: StageState;
}

/**
 * The six stages an employee actually cares about, from today to payroll
 * settlement. Derived from the request rather than stored, so a status change
 * anywhere reshapes the journey without touching data.
 */
export function paydayJourney(request: BridgeRequest): Stage[] {
  const failed = request.status === "Failed" || request.status === "Reversed";
  const reached = failed
    ? 2
    : {
        Initiated: 1,
        Approved: 2,
        Processing: 3,
        Disbursed: 5,
        Settled: 6,
        Failed: 2,
        Reversed: 2,
        Overdue: 5,
      }[request.status];

  const stageState = (index: number): StageState => {
    if (failed && index === 3) return "failed";
    if (index < reached) return "done";
    if (index === reached) return "current";
    return "pending";
  };

  return [
    {
      label: "Today",
      at: dateTime(request.createdAt),
      estimate: "You moved your Bridge Gauge",
      state: stageState(0),
    },
    {
      label: "Bridge approved",
      at: dateTime(request.createdAt),
      estimate: "Instant — checked against pay you have already earned",
      state: stageState(1),
    },
    {
      label: "Processing",
      estimate: "Under a minute with our payout partner",
      state: stageState(2),
    },
    {
      label: "Bank transfer",
      estimate: `Sent to ${request.destination}`,
      note: failed
        ? "The transfer did not complete and no payroll deduction applies. Nothing was charged to you."
        : undefined,
      state: stageState(3),
    },
    {
      label: "Funds received",
      at: request.disbursedAt ? dateTime(request.disbursedAt) : undefined,
      estimate: `${naira(request.netAmount)} in your account — usually within minutes`,
      state: stageState(4),
    },
    {
      label: "Payroll settlement",
      at: longDate(request.settlementDate),
      estimate: `${naira(request.settlementAmount)} settles from your salary automatically`,
      state: stageState(5),
    },
  ];
}

/** Vertical journey with estimated times. Calm, certain, never alarming. */
export function PaydayTimeline({ request, className }: { request: BridgeRequest; className?: string }) {
  const stages = paydayJourney(request);
  return (
    <ol className={cn("relative space-y-4 pl-8", className)}>
      <span className="absolute left-[11px] top-2 bottom-3 w-px bg-border" aria-hidden />
      {stages.map((stage, index) => (
        <li key={stage.label} className="relative">
          <span
            className={cn(
              "absolute -left-8 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors",
              stage.state === "done" && "border-primary bg-primary text-primary-foreground",
              stage.state === "current" && "border-primary bg-background",
              stage.state === "pending" && "border-border bg-background",
              stage.state === "failed" && "border-destructive bg-destructive/15 text-destructive",
            )}
          >
            {stage.state === "done" ? <Check className="h-3 w-3" /> : null}
            {stage.state === "current" ? (
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            ) : null}
            {stage.state === "failed" ? <X className="h-3 w-3" /> : null}
            {stage.state === "pending" ? (
              <span className="h-1.5 w-1.5 rounded-full bg-border" aria-hidden />
            ) : null}
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p
              className={cn(
                "text-sm font-semibold",
                stage.state === "pending" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {stage.label}
            </p>
            {stage.at ? (
              <p className="text-xs text-muted-foreground tnum">{stage.at}</p>
            ) : stage.state === "pending" ? (
              <p className="text-xs text-muted-foreground/70">Expected</p>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{stage.estimate}</p>
          {stage.note ? (
            <p className="mt-1 text-xs leading-relaxed text-destructive">{stage.note}</p>
          ) : null}
          {index === stages.length - 1 ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
              Your employer sees only the payroll deduction — never the reason for it.
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
