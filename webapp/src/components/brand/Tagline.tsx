import { cn } from "@/lib/utils";
import { TAGLINE_LOCKUP } from "@/lib/brand";

/**
 * The tagline, set as live text rather than as part of the logo artwork.
 *
 * The SVG lockup carries the tagline too, but it is sized off the wordmark:
 * at any header or footer size the caps land around three pixels and read as
 * dirt. This is the same line — teal rule, tracked caps, gold rule — drawn at
 * a size a person can actually read, so "from payroll to prosperity" is a
 * claim on the page instead of a texture inside a logo.
 */
export function Tagline({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/70",
        className,
      )}
    >
      <span className="h-px w-6 shrink-0 bg-primary" aria-hidden />
      {TAGLINE_LOCKUP}
      {/* The far rule is gold — the same one-word colour change the logo
          makes, and the only warm mark in the line. */}
      <span className="h-px w-6 shrink-0 bg-gold" aria-hidden />
    </div>
  );
}
