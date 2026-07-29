import { cn } from "@/lib/utils";

/**
 * PayBridge mark — an arched bridge deck spanning four upright pillars, with
 * the second pillar in gold. Continuity and support, expressed as one calm,
 * balanced structure. Silver elements use currentColor so the mark adapts to
 * light and dark scopes; the accent pillar uses the PayBridge gold token.
 */
export function LogoMark({
  className,
  monochrome = false,
}: {
  className?: string;
  monochrome?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 76"
      fill="none"
      role="img"
      aria-label="PayBridge"
      className={cn("h-8 w-auto", className)}
    >
      {/* silver pillars */}
      <g fill="currentColor">
        <rect x="44" y="18" width="5.5" height="40" rx="1.6" />
        <rect x="64" y="14" width="5.5" height="45" rx="1.6" />
        <rect x="75" y="22" width="5.5" height="34" rx="1.6" />
      </g>
      {/* accent pillar */}
      <rect
        x="53.5"
        y="11"
        width="6.5"
        height="52"
        rx="1.8"
        fill={monochrome ? "currentColor" : "hsl(var(--gold))"}
      />
      {/* bridge arch */}
      <path
        d="M8 54 Q 60 16 112 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      {showWordmark ? (
        <span className="font-display text-[1.35rem] font-extrabold leading-none tracking-tight text-foreground">
          Pay<span className="text-primary">Bridge</span>
        </span>
      ) : null}
    </span>
  );
}
