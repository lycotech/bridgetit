import { cn } from "@/lib/utils";

/**
 * The logo's span, enlarged as a background watermark.
 *
 * WHY reuse the exact path from the mark rather than draw "an arc": a brand
 * element only compounds if it is the same shape every time. At 6% opacity it
 * is felt more than seen — which is the point. Decorative only, so it is hidden
 * from assistive technology.
 */
export function BrandSpan({
  className,
  withUprights = false,
}: {
  className?: string;
  withUprights?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 62"
      fill="none"
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none select-none text-foreground", className)}
    >
      <path
        d="M2 56 C 22 24, 60 4, 118 34 C 64 14, 28 34, 2 56 Z"
        fill="hsl(var(--primary))"
      />
      {withUprights ? (
        <g fill="currentColor">
          <rect x="55" y="19" width="3.6" height="27" rx="1.2" />
          <rect x="68" y="16" width="3.6" height="30" rx="1.2" />
          <rect x="81" y="18" width="3.6" height="28" rx="1.2" />
        </g>
      ) : null}
    </svg>
  );
}
