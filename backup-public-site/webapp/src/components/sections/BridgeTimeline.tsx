import { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { ShieldCheck, CalendarClock } from "lucide-react";
import { useCountUp, formatNaira } from "@/hooks/use-count-up";
import { MDiv } from "@/lib/motion";
import { cn } from "@/lib/utils";

const EARNED = 180000;
const AVAILABLE = 40000;
const PROTECTED = 140000;
const WORKDAYS = 22;
const TODAY_INDEX = 20; // ~20 of 22 workdays completed
const NEXT_PAYDAY_DAYS = 10;

// Compact end-to-end progress line replacing the long text journey.
const PROGRESS = ["Work", "Earn", "Bridge", "Settle"];

export function BridgeTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();

  const earned = useCountUp(EARNED, inView);
  const available = useCountUp(AVAILABLE, inView, 1600);
  const protectedAmt = useCountUp(PROTECTED, inView, 1600);

  const availablePct = (AVAILABLE / EARNED) * 100;
  const protectedPct = (PROTECTED / EARNED) * 100;

  return (
    <div
      ref={ref}
      className="relative w-full rounded-3xl border border-border bg-card/80 p-4 shadow-2xl backdrop-blur-sm sm:p-6"
    >
      {/* soft ambient glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-60"
        style={{
          background:
            "radial-gradient(120% 80% at 80% 0%, hsl(var(--primary) / 0.12), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Illustrative example
          </span>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1">
            <CalendarClock className="h-3.5 w-3.5 text-protected" />
            <span className="text-xs font-semibold text-foreground">
              Next payday · {NEXT_PAYDAY_DAYS} days
            </span>
          </div>
        </div>

        {/* Workday strip */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Workdays completed</span>
            <span className="text-xs font-semibold text-primary tnum">
              {TODAY_INDEX}/{WORKDAYS}
            </span>
          </div>
          <div className="flex items-end gap-[3px]">
            {Array.from({ length: WORKDAYS }).map((_, i) => {
              const filled = i < TODAY_INDEX;
              const isToday = i === TODAY_INDEX - 1;
              return (
                <MDiv
                  key={i}
                  className={cn(
                    "h-6 flex-1 rounded-[3px]",
                    filled ? "bg-primary" : "bg-secondary",
                    isToday && "ring-2 ring-primary/40",
                  )}
                  initial={{ scaleY: reduce ? 1 : 0.25, opacity: reduce ? 1 : 0.3 }}
                  animate={inView ? { scaleY: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.035, ease: "easeOut" }}
                  style={{ transformOrigin: "bottom" }}
                />
              );
            })}
          </div>
        </div>

        {/* Earned total */}
        <div className="mt-5">
          <span className="text-xs text-muted-foreground">Earned so far</span>
          <div className="mt-0.5 font-display text-4xl font-extrabold tracking-tight text-foreground tnum">
            {formatNaira(earned)}
          </div>
        </div>

        {/* Segmented bar: available + protected */}
        <div className="mt-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
            <MDiv
              className="h-full bg-available"
              initial={{ width: "0%" }}
              animate={inView ? { width: `${availablePct}%` } : {}}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            />
            <MDiv
              className="h-full bg-protected"
              initial={{ width: "0%" }}
              animate={inView ? { width: `${protectedPct}%` } : {}}
              transition={{ duration: 1, delay: 0.55, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Two figures — available emphasised, protected equally visible */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-available/40 bg-available/10 p-3.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-available" aria-hidden />
              <span className="text-xs font-semibold text-foreground">Available to bridge</span>
            </div>
            <div className="mt-1 font-display text-[1.7rem] font-extrabold leading-none text-available tnum">
              {formatNaira(available)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/40 p-3.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-protected" />
              <span className="text-xs font-semibold text-foreground">Protected for payday</span>
            </div>
            <div className="mt-1 font-display text-[1.7rem] font-extrabold leading-none text-foreground tnum">
              {formatNaira(protectedAmt)}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Only an approved portion of what you have already earned can be bridged. The rest stays
          protected for payday.
        </p>

        {/* Compact end-to-end progress line */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="relative">
            <div
              className="absolute left-[12.5%] right-[12.5%] top-[5px] h-0.5 bg-gradient-to-r from-primary/60 via-primary/40 to-protected/50"
              aria-hidden
            />
            <div className="relative grid grid-cols-4">
              {PROGRESS.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full ring-4 ring-card",
                      i < PROGRESS.length - 1 ? "bg-primary" : "bg-protected",
                    )}
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
