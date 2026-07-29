import { Check, CircleDashed, Loader } from "lucide-react";
import {
  STATUS_LABEL,
  type ControlStatus,
  type FortressPillar,
} from "@/lib/platform/fortress";
import { cn } from "@/lib/utils";

/**
 * Status chip.
 *
 * WHY three states rather than a tick or nothing: a page where every line has a
 * green tick is not read as reassuring, it is read as marketing. Showing what is
 * still being built is what makes the "in place" claims credible — and it is the
 * answer an enterprise security questionnaire asks for anyway.
 */
const STATUS_STYLE: Record<ControlStatus, { chip: string; icon: typeof Check }> = {
  live: {
    chip: "border-primary/30 bg-primary/10 text-primary",
    icon: Check,
  },
  building: {
    chip: "border-gold/40 bg-gold/10 text-gold",
    icon: Loader,
  },
  planned: {
    chip: "border-border bg-muted/60 text-muted-foreground",
    icon: CircleDashed,
  },
};

export function StatusChip({ status }: { status: ControlStatus }) {
  const { chip, icon: Icon } = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wider",
        chip,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PillarCard({ pillar }: { pillar: FortressPillar }) {
  return (
    <article
      id={pillar.id}
      className="scroll-mt-24 rounded-3xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-display text-3xl font-extrabold tracking-tight text-primary/30">
          {pillar.number}
        </span>
        <h3 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          {pillar.title}
        </h3>
      </div>

      <p className="mt-2 text-base font-medium text-foreground/80">{pillar.summary}</p>

      <p className="mt-5 border-l-2 border-primary/40 pl-4 font-display text-lg font-semibold italic text-foreground">
        {pillar.question}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{pillar.why}</p>

      <ul className="mt-7 space-y-4 border-t border-border pt-6">
        {pillar.controls.map((control) => (
          <li key={control.name}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <h4 className="text-sm font-semibold text-foreground">{control.name}</h4>
              <StatusChip status={control.status} />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {control.detail}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
