import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";

/* The employer objection this site exists to answer: "does this mean we run
   a second payroll?" No — so the visual says that in two boxes and an arrow,
   not a diagram of the whole system. */
export function OnePayroll() {
  return (
    <section id="one-payroll" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <div>
            <Reveal>
              <SectionLabel>For employers</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                One payroll.
                <br />
                <span className="text-primary">No duplicate work.</span>
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Your payroll stays where it is.</span>{" "}
                PayBridge is designed to work around your existing payroll process rather than
                create another one.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Eligible employees can activate PayBridge through their employer and receive
                access to the PayBridge financial ecosystem without requiring HR to run a second
                payroll or manually process individual salary-advance requests.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                PayBridge is being designed to automate eligibility, settlement and reconciliation
                within agreed employer rules.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-5">
              <div className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-center sm:w-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  You
                </p>
                <p className="mt-1 font-display text-lg font-bold text-foreground">
                  Run payroll once
                </p>
              </div>
              <ArrowRight
                className="h-5 w-5 shrink-0 rotate-90 text-primary sm:rotate-0"
                aria-hidden
              />
              <div className="w-full rounded-2xl border border-primary/40 bg-primary/5 px-5 py-4 text-center sm:w-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  PayBridge
                </p>
                <p className="mt-1 font-display text-lg font-bold text-foreground">
                  Handles the rest around it
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-lg font-medium leading-relaxed text-foreground">
              You run payroll once. PayBridge handles the rest around it.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
