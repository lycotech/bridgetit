import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv, MLi } from "@/lib/motion";

const STEPS = [
  { n: "01", title: "Work", body: "You complete eligible work through a participating employer." },
  { n: "02", title: "Earn", body: "Verified earnings accumulate through the pay cycle." },
  { n: "03", title: "See", body: "PayBridge shows what has been earned and what may be responsibly bridged." },
  { n: "04", title: "Bridge", body: "Choose an approved amount and review the full cost and payday impact." },
  { n: "05", title: "Settle", body: "Payroll completes the cycle and reconciliation happens transparently." },
];

export function HowItWorks() {
  return (
    <section id="how" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <SectionLabel>The PayBridge journey</SectionLabel>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              From work completed
              <br />
              to life continuing.
            </h2>
          </Reveal>
        </div>

        {/* Mobile / tablet: one connected vertical timeline */}
        <StaggerGroup className="relative mt-10 lg:hidden">
          <span
            className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-primary/60 via-border to-border"
            aria-hidden
          />
          <ol className="space-y-5">
            {STEPS.map((step) => (
              <MLi key={step.n} variants={staggerItem} className="relative flex items-start gap-4">
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-card text-xs font-bold text-primary tnum ring-4 ring-background">
                  {step.n}
                </span>
                <div className="pt-0.5">
                  <h3 className="font-display text-lg font-bold leading-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </MLi>
            ))}
          </ol>
        </StaggerGroup>

        {/* Desktop: horizontal connected timeline */}
        <div className="relative mt-16 hidden lg:block">
          <span
            className="absolute left-[10%] right-[10%] top-[15px] h-px bg-gradient-to-r from-primary/60 via-border to-border"
            aria-hidden
          />
          <StaggerGroup className="relative grid grid-cols-5 gap-6">
            {STEPS.map((step) => (
              <MDiv key={step.n} variants={staggerItem} className="flex flex-col items-center text-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-card text-xs font-bold text-primary tnum ring-4 ring-background">
                  {step.n}
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </MDiv>
            ))}
          </StaggerGroup>
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-lg font-medium text-foreground">
            Simple to understand.{" "}
            <span className="text-muted-foreground">Structured to protect everyone involved.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
