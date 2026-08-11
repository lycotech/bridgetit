import { ClipboardCheck, Workflow, ShieldCheck, HeartHandshake } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv } from "@/lib/motion";

const BENEFITS = [
  {
    icon: ClipboardCheck,
    title: "Reduce salary-advance administration",
    body: "Replace informal requests, emails and manual approvals with a structured employee benefit.",
  },
  {
    icon: Workflow,
    title: "Keep payroll simple",
    body: "PayBridge is designed to work around existing payroll rather than create a second payroll process.",
  },
  {
    icon: ShieldCheck,
    title: "Protect employee privacy",
    body: "HR receives only information necessary to administer and reconcile the programme.",
  },
  {
    icon: HeartHandshake,
    title: "Support financial wellbeing",
    body: "Give employees access to tools covering short-term liquidity, savings, investments and financial education.",
  },
];

export function EmployerBenefits() {
  return (
    <section id="employer-benefits" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex justify-center">
              <SectionLabel>Why employers choose PayBridge</SectionLabel>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Built to remove work
              <br />
              from HR, not create it.
            </h2>
          </Reveal>
        </div>

        <StaggerGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, body }, i) => (
            <MDiv
              key={title}
              variants={staggerItem}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-xs font-bold text-muted-foreground tnum">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold leading-snug text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </MDiv>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
