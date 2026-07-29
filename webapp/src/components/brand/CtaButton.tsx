import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/**
 * Where every principal call to action on the public site goes.
 *
 * One destination, one question: "How would you like to get on the bridge?".
 * Defined once so a CTA can never drift back to a demo, a dashboard or a
 * sign-up screen. The public site collects expressions of interest only.
 */
export const BRIDGE_PATH = "/get-on-the-bridge";

/**
 * The single dominant call to action: GET ON THE BRIDGE.
 *
 * It is a real link, not a scroll handler, so it works from any page, opens in
 * a new tab on middle-click, and survives being pasted into an email or an ad.
 * `event` records where the click came from.
 */
export function CtaButton({
  event,
  label = "Get on the Bridge",
  to = BRIDGE_PATH,
  className,
  size = "default",
  variant = "primary",
}: {
  event: AnalyticsEvent;
  label?: string;
  to?: string;
  className?: string;
  size?: "default" | "lg";
  variant?: "primary" | "ghost";
}) {
  return (
    <Link
      to={to}
      onClick={() => track(event)}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none",
        size === "lg" ? "px-8 py-4 text-base" : "px-6 py-3 text-sm",
        variant === "primary"
          ? "btn-brand shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.7)] hover:shadow-[0_16px_50px_-10px_hsl(var(--primary)/0.9)] hover:-translate-y-0.5"
          : "border border-border bg-transparent text-foreground hover:border-primary/60 hover:text-primary",
        className,
      )}
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}
