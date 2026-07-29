import { BrandSpan } from "@/components/brand/BrandSpan";
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
        {/* Both teals are present at the fold: the deep tone as a broad, low
            field and the emerald as a tighter light above it. One colour at
            two depths is what stops a flat wash of teal. */}
        <div
          className="absolute -top-24 left-0 h-[620px] w-[760px] rounded-full blur-[150px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary-deep) / 0.30), transparent)" }}
        />
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent)" }}
        />
        {/* Gold sits bottom-right, where the deck lands. The fold reads left
            to right as teal → gold — cool mechanism to warm outcome — which is
            the whole proposition. Held at 0.18: a warm glow carries further
            than a cool one, and it must not tint the type above it. */}
        <div
          className="absolute -bottom-16 right-0 h-[520px] w-[560px] rounded-full blur-[140px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--gold) / 0.18), transparent)" }}
        />
        {/* The mark's span, enlarged as a watermark across the fold. */}
        <BrandSpan
          withUprights
          className="absolute -top-10 left-1/2 w-[1500px] max-w-none -translate-x-1/2 opacity-[0.07] blur-[1px] md:-top-24"
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
