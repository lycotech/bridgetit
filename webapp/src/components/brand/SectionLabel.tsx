import { cn } from "@/lib/utils";

/**
 * Small uppercase eyebrow with a short leading rule.
 *
 * The rule is the tagline lockup's teal-then-gold pair, compressed into a
 * single 28px hairline: it starts in the brand teal and lands in the gold.
 * It is the smallest possible statement of "from payroll to prosperity", and
 * because every section carries one, the gold is everywhere without ever
 * being more than a few pixels of it.
 */
export function SectionLabel({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("eyebrow", className)}>
      <span
        className="h-px w-7 bg-gradient-to-r from-primary-bright/70 to-gold"
        aria-hidden
      />
      {children}
    </div>
  );
}
