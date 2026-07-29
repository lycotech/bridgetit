import { Reveal } from "@/components/motion/Reveal";
import { Logo } from "@/components/brand/Logo";

const LINES = [
  "You should not have to stop living",
  "because payday has not arrived.",
];

const BEATS = [
  "You have already shown up.",
  "You have already done the work.",
  "Your earnings are already building.",
];

export function Manifesto() {
  return (
    <section className="relative overflow-hidden border-t border-border py-20 md:py-32">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, hsl(var(--primary) / 0.10), transparent)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-4xl px-5 text-center md:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-5xl">
            {LINES.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
        </Reveal>

        <div className="mx-auto mt-10 max-w-2xl space-y-3">
          {BEATS.map((beat, i) => (
            <Reveal key={beat} delay={i * 0.08}>
              <p className="text-xl font-medium text-muted-foreground sm:text-2xl">{beat}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-12 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            When life cannot wait,
            <br />
            <span className="text-primary">bridge it.</span>
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-12 flex flex-col items-center gap-3">
            <Logo markClassName="h-11" className="scale-110" />
            <p className="text-sm text-muted-foreground">A better financial system around work.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
