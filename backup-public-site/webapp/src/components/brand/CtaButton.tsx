import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { track, type AnalyticsEvent } from "@/lib/analytics";

export function scrollToWaitlist() {
  const el = document.getElementById("waitlist");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move focus to the first field for keyboard users after the scroll settles.
    window.setTimeout(() => {
      const field = document.getElementById("wl-fullName");
      field?.focus({ preventScroll: true });
    }, 700);
  }
}

/**
 * The single dominant call to action: GET ON THE BRIDGE.
 * Always routes to the waitlist. `event` records where the click came from.
 */
export function CtaButton({
  event,
  label = "Get on the Bridge",
  className,
  size = "default",
  variant = "primary",
}: {
  event: AnalyticsEvent;
  label?: string;
  className?: string;
  size?: "default" | "lg";
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={() => {
        track(event);
        scrollToWaitlist();
      }}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none",
        size === "lg" ? "px-8 py-4 text-base" : "px-6 py-3 text-sm",
        variant === "primary"
          ? "bg-primary text-primary-foreground shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.7)] hover:shadow-[0_16px_50px_-10px_hsl(var(--primary)/0.85)] hover:-translate-y-0.5"
          : "border border-border bg-transparent text-foreground hover:border-primary/60 hover:text-primary",
        className,
      )}
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}
