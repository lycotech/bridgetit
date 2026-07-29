import { Check } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { CtaButton } from "@/components/brand/CtaButton";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MLi } from "@/lib/motion";

const CAPABILITIES = [
  "Structured eligibility rules",
  "Approved bridge limits",
  "Payroll integration",
  "Transparent deductions",
  "Employee self-service",
  "Reporting and reconciliation",
  "Financial-wellness support",
  "Future Salary Buffer capabilities",
];

export function EmployerStory() {
  return (
    <section className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionLabel>For employers</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-[2.9rem]">
                A stronger workforce needs better financial infrastructure.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Employees often bring transport pressure, emergency needs and financial uncertainty
                into work. Employers cannot solve every personal need, but they can provide a better
                system.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-xl text-xl font-medium leading-relaxed text-foreground">
                Support your people without turning payroll into an informal lending desk.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-9">
                <CtaButton event="midpage_cta_click" size="lg" label="Get on the Bridge" />
              </div>
            </Reveal>
          </div>

          <StaggerGroup className="grid grid-cols-1 gap-3 self-center sm:grid-cols-2">
            {CAPABILITIES.map((cap) => (
              <MLi
                key={cap}
                variants={staggerItem}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium text-foreground">{cap}</span>
              </MLi>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
