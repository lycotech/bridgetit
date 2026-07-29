import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BRIDGE_PATH } from "@/components/brand/CtaButton";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Mobile-only sticky call to action.
 * Appears once the hero has scrolled out of view and hides again when the
 * segment chooser enters view, so it never competes with the primary CTAs.
 * Respects device safe areas and stays out of the way otherwise.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const chooser = document.getElementById("get-on-the-bridge");

    let heroOut = false;
    let chooserIn = false;
    const update = () => setVisible(heroOut && !chooserIn);

    const heroObs = new IntersectionObserver(
      ([entry]) => {
        heroOut = !entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    const chooserObs = new IntersectionObserver(
      ([entry]) => {
        chooserIn = entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );

    if (hero) heroObs.observe(hero);
    if (chooser) chooserObs.observe(chooser);

    return () => {
      heroObs.disconnect();
      chooserObs.disconnect();
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
        <Link
          to={BRIDGE_PATH}
          tabIndex={visible ? 0 : -1}
          onClick={() => track("nav_cta_click")}
          className="group flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full btn-brand text-base font-semibold shadow-[0_-6px_30px_-12px_hsl(var(--primary)/0.8)]"
        >
          Get on the Bridge
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
