import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";
import { MonthTimeline } from "./MonthTimeline";

export function PaydayGap() {
  return (
    <section id="why" className="section relative border-t border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <Reveal>
              <SectionLabel>The payday gap</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Work happens daily.
                <br />
                Life does too.
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Transport, food, medical needs and opportunities
                </span>{" "}
                do not always wait for payday.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Yet many workers must wait until the end of the pay cycle before accumulated
                earnings become available.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-6 max-w-lg text-xl font-medium leading-relaxed text-foreground">
                PayBridge is building a more responsible bridge between work and money.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="rounded-3xl border border-border bg-card/60 p-5 sm:p-8">
            <MonthTimeline />
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> Earnings building
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gold" aria-hidden /> A need today
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-protected" aria-hidden /> Payday
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
