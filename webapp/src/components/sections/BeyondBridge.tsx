import { ArrowUpRight, PiggyBank, TrendingUp } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* Bridge → Build → Grow is the proposition in three words, so the three tiles
   carry the palette in the same order: emerald at the near bank, bright teal
   mid-span, gold at the far one. Only the third tile is gold — the arrival —
   which is the same rule the journey timeline and the logo follow.
   (This section always sits on the dark ground, so the tones are the dark-scope
   ones; the deep teal would disappear here.) */
const PILLARS = [
  {
    icon: ArrowUpRight,
    title: "Bridge",
    body: "Responsible access to an approved portion of verified income already earned.",
    tile: "bg-primary/10 text-primary",
  },
  {
    icon: PiggyBank,
    title: "Build",
    body: "Automatic savings, emergency preparation and clearer financial visibility.",
    tile: "bg-primary-bright/10 text-primary-bright",
  },
  {
    icon: TrendingUp,
    title: "Grow",
    body: "Investment and wealth-building opportunities through appropriately regulated partners.",
    tile: "bg-gold/10 text-gold ring-1 ring-gold/25",
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
                Bridge today.
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
