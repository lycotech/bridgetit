import { Check, Lock } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MLi } from "@/lib/motion";

/* Never claim "your employer sees nothing" — not operationally accurate.
   The honest claim is a scoped one: employers see only what administering
   the programme requires, everything else stays private. */
const EMPLOYER_RECEIVES = [
  "Eligibility",
  "Payroll settlement",
  "Reconciliation",
  "Programme administration",
];

const STAYS_PRIVATE = [
  "Personal spending",
  "Savings choices",
  "Investment decisions",
  "Financial goals",
];

export function HrPrivacy() {
  return (
    <section id="privacy" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex justify-center">
              <SectionLabel>Privacy and trust</SectionLabel>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Financial support without
              <br />
              unnecessary exposure.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Your employer does not need to know why you use PayBridge Access or what you do with
              your money.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Employers receive only what's needed for
            </h3>
            <StaggerGroup className="mt-4 space-y-3">
              {EMPLOYER_RECEIVES.map((item) => (
                <MLi key={item} variants={staggerItem} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </MLi>
              ))}
            </StaggerGroup>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Always stays private
            </h3>
            <StaggerGroup className="mt-4 space-y-3">
              {STAYS_PRIVATE.map((item) => (
                <MLi key={item} variants={staggerItem} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-foreground/70 ring-1 ring-border">
                    <Lock className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </MLi>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
