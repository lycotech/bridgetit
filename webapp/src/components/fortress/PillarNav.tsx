import { FORTRESS_PILLARS } from "@/lib/platform/fortress";

/**
 * Jump links to the eight pillars.
 *
 * WHY: this page is long by design — an enterprise security review reads it top
 * to bottom, but most visitors arrive with one question ("who can see my
 * data?"). The nav gets them to the answer in one tap instead of a scroll.
 */
export function PillarNav() {
  return (
    <nav aria-label="Security pillars" className="flex flex-wrap gap-2">
      {FORTRESS_PILLARS.map((pillar) => (
        <a
          key={pillar.id}
          href={`#${pillar.id}`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
        >
          <span className="font-display text-xs font-bold text-primary/50">{pillar.number}</span>
          {pillar.title}
        </a>
      ))}
    </nav>
  );
}
