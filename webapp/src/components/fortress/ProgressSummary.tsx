import { Check, CircleDashed, Loader, ShieldCheck } from "lucide-react";
import { STATUS_LABEL, fortressProgress } from "@/lib/platform/fortress";

/**
 * Headline counts for the trust page.
 *
 * WHY counts and not a percentage: a single "87% secure" figure is meaningless
 * and invites argument. Three honest numbers — in place, in build, before
 * launch — say the same thing without pretending to a precision we do not have.
 */
export function ProgressSummary() {
  const { total, live, building, planned } = fortressProgress();

  const tiles = [
    { value: total, label: "Controls tracked", icon: ShieldCheck, tone: "text-foreground" },
    { value: live, label: STATUS_LABEL.live, icon: Check, tone: "text-success" },
    { value: building, label: STATUS_LABEL.building, icon: Loader, tone: "text-gold" },
    { value: planned, label: STATUS_LABEL.planned, icon: CircleDashed, tone: "text-muted-foreground" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map(({ value, label, icon: Icon, tone }) => (
        <div
          key={label}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
          <dd className={`mt-3 font-display text-4xl font-extrabold tracking-tight ${tone}`}>
            {value}
          </dd>
          <dt className="mt-1 text-sm text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}
