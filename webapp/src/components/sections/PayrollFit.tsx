import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv, MLi } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "Employee activates PayBridge",
    body: "Eligible employees onboard following employer approval and complete the required verification.",
  },
  {
    n: "02",
    title: "Employer runs payroll once",
    body: "The employer continues using its normal payroll process.",
  },
  {
    n: "03",
    title: "PayBridge settlement",
    body: "Where the employee has used PayBridge Access, the approved settlement is processed through the PayBridge account infrastructure.",
  },
  {
    n: "04",
    title: "Employee receives the balance",
    body: "The remaining salary can be transferred to the employee's nominated everyday bank account.",
  },
];

/* Same "final step is the outcome" rule as the employee journey timeline
   (HowItWorks.tsx) — step 04 is the arrival, marked in success colour. */
const OUTCOME = "04";

export function PayrollFit() {
  return (
    <section id="payroll-fit" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <SectionLabel>The payroll fit</SectionLabel>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              How PayBridge fits
              <br />
              into payroll.
            </h2>
          </Reveal>
        </div>

        {/* Mobile / tablet: one connected vertical timeline */}
        <StaggerGroup className="relative mt-10 lg:hidden">
          <span
            className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-primary/60 via-primary/30 to-success/70"
            aria-hidden
          />
          <ol className="space-y-5">
            {STEPS.map((step) => {
              const outcome = step.n === OUTCOME;
              return (
                <MLi key={step.n} variants={staggerItem} className="relative flex items-start gap-4">
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-bold tnum ring-4 ring-background",
                      outcome
                        ? "border-success/50 bg-success/10 text-success"
                        : "border-primary/40 text-primary",
                    )}
                  >
                    {step.n}
                  </span>
                  <div className="pt-0.5">
                    <h3
                      className={cn(
                        "font-display text-lg font-bold leading-tight",
                        outcome ? "text-success" : "text-foreground",
                      )}
                    >
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </MLi>
              );
            })}
          </ol>
        </StaggerGroup>

        {/* Desktop: horizontal connected timeline */}
        <div className="relative mt-16 hidden lg:block">
          <span
            className="absolute left-[10%] right-[10%] top-[15px] h-px bg-gradient-to-r from-primary/60 via-primary/30 to-success/70"
            aria-hidden
          />
          <StaggerGroup className="relative grid grid-cols-4 gap-6">
            {STEPS.map((step) => {
              const outcome = step.n === OUTCOME;
              return (
                <MDiv key={step.n} variants={staggerItem} className="flex flex-col items-center text-center">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border bg-card text-xs font-bold tnum ring-4 ring-background",
                      outcome
                        ? "border-success/50 bg-success/10 text-success"
                        : "border-primary/40 text-primary",
                    )}
                  >
                    {step.n}
                  </span>
                  <h3
                    className={cn(
                      "mt-5 font-display text-xl font-bold",
                      outcome ? "text-success" : "text-foreground",
                    )}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </MDiv>
              );
            })}
          </StaggerGroup>
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-lg font-medium text-foreground">
            One payroll process. Minimal HR administration.{" "}
            <span className="text-muted-foreground">Designed for automated reconciliation.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
