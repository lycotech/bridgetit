import { ArrowUpRight, PiggyBank, TrendingUp, GraduationCap } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* The four pillars from the brand brief: Access → Save → Invest → Learn.
   Gold stays on the third tile (Invest) as the "arrival" accent — the same
   rule the journey timeline and the logo follow elsewhere in this codebase.
   The new fourth tile (Learn) uses --protected (a cool blue, already used
   elsewhere for calm/informational moments) rather than reusing a teal or
   gold already spoken for by the other three tiles.
   (This section always sits on the dark ground, so the tones are the
   dark-scope ones; the deep teal would disappear here.) */
const PILLARS = [
  {
    icon: ArrowUpRight,
    title: "Access",
    body: "Responsible access to an approved portion of verified income already earned.",
    tile: "bg-primary/10 text-primary",
  },
  {
    icon: PiggyBank,
    title: "Save",
    body: "Build a financial buffer through regulated savings products made available through PayBridge partners.",
    tile: "bg-primary-bright/10 text-primary-bright",
  },
  {
    icon: TrendingUp,
    title: "Invest",
    body: "Explore investment options suited to your goals and risk profile through appropriately regulated providers.",
    tile: "bg-gold/10 text-gold ring-1 ring-gold/25",
  },
  {
    icon: GraduationCap,
    title: "Learn",
    body: "Practical financial education built around the real decisions you make about income, savings and investment.",
    tile: "bg-protected/10 text-protected",
  },
];

export function BeyondBridge() {
  return (
    <section id="beyond" className="section relative scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionLabel>More than early pay</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Access today.
                <br />
                <span className="text-primary">Build tomorrow.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
                PayBridge is being built to do more than help employees manage the days before
                payday.
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
                The broader vision is to turn payroll into a pathway for resilience, financial
                confidence and long-term progress.
              </p>
            </Reveal>
          </div>

          <StaggerGroup className="flex flex-col gap-4">
            {PILLARS.map(({ icon: Icon, title, body, tile }, i) => (
              <MDiv
                key={title}
                variants={staggerItem}
                className="flex items-start gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    tile,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-xs font-bold text-muted-foreground tnum">
                      0{i + 1}
                    </span>
                    <h3 className="font-display text-2xl font-bold text-foreground">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </MDiv>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
