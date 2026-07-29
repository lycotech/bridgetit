import { Sprout, Scale, ShieldCheck } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { CtaButton } from "@/components/brand/CtaButton";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv } from "@/lib/motion";

const PRINCIPLES = [
  {
    icon: Sprout,
    title: "Earned",
    body: "Based on verified work and earnings already accumulated.",
  },
  {
    icon: Scale,
    title: "Responsible",
    body: "Limits, charges and payday impact are shown before confirmation.",
  },
  {
    icon: ShieldCheck,
    title: "Protected",
    body: "Only an approved portion may be bridged, helping preserve income for payday.",
  },
];

export function BridgeIt() {
  return (
    <section className="theme-light section relative overflow-hidden border-t border-border bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.5]" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-5 text-center md:px-8">
        <Reveal>
          <div className="flex justify-center">
            <SectionLabel>A new way to think about payday</SectionLabel>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            When life cannot wait,
            <br />
            <span className="text-primary">bridge it.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            PayBridge helps eligible employees use an approved portion of verified earnings already
            accumulated through a structured employer-enabled programme.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mx-auto mt-4 font-display text-base font-semibold text-primary">
            A different experience from conventional payday lending.
          </p>
        </Reveal>

        <StaggerGroup className="mt-12 grid gap-4 text-left sm:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <MDiv
              key={title}
              variants={staggerItem}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </MDiv>
          ))}
        </StaggerGroup>

        <Reveal delay={0.15}>
          <div className="mt-10 flex justify-center">
            <CtaButton event="midpage_cta_click" size="lg" label="Get on the Bridge" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
