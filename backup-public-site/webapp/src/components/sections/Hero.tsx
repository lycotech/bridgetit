import { CtaButton } from "@/components/brand/CtaButton";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { BridgeTimeline } from "./BridgeTimeline";
import { Reveal } from "@/components/motion/Reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-20 md:pt-32">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid opacity-[0.4]" />
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--protected) / 0.16), transparent)" }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-24">
        {/* Copy */}
        <div>
          <Reveal>
            <SectionLabel>The future of payday</SectionLabel>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-5 font-display text-[2.7rem] font-extrabold leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]">
              You work every day.
              <br />
              <span className="text-primary">Why wait</span> until payday?
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              PayBridge helps eligible employees bridge an approved portion of verified earnings
              already accumulated—responsibly, transparently and through participating employers.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-7">
              <CtaButton event="hero_cta_click" size="lg" label="Get on the Bridge" />
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <p className="mt-5 text-sm font-medium tracking-wide text-muted-foreground">
              Employer-enabled · Verified earnings · Approved limits apply
            </p>
          </Reveal>
        </div>

        {/* Visual */}
        <Reveal delay={0.15} className="w-full">
          <BridgeTimeline />
        </Reveal>
      </div>
    </section>
  );
}
