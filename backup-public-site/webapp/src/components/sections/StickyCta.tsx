import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { scrollToWaitlist } from "@/components/brand/CtaButton";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Mobile-only sticky call to action.
 * Appears once the hero has scrolled out of view and hides again when the
 * waitlist form enters view, so it never competes with the primary CTAs.
 * Respects device safe areas and stays out of the way otherwise.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const waitlist = document.getElementById("waitlist");

    let heroOut = false;
    let waitlistIn = false;
    const update = () => setVisible(heroOut && !waitlistIn);

    const heroObs = new IntersectionObserver(
      ([entry]) => {
        heroOut = !entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    const wlObs = new IntersectionObserver(
      ([entry]) => {
        waitlistIn = entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );

    if (hero) heroObs.observe(hero);
    if (waitlist) wlObs.observe(waitlist);

    return () => {
      heroObs.disconnect();
      wlObs.disconnect();
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 lg:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={!visible}
    >
      <div className="border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={() => {
            track("nav_cta_click");
            scrollToWaitlist();
          }}
          className="group flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-[0_-6px_30px_-12px_hsl(var(--primary)/0.8)]"
        >
          Get on the Bridge
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
