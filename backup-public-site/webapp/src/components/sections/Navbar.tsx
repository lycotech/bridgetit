import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { CtaButton, scrollToWaitlist } from "@/components/brand/CtaButton";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Why PayBridge", href: "#why" },
  { label: "How It Works", href: "#how" },
  { label: "Who It Serves", href: "#who" },
  { label: "Trust", href: "#trust" },
  { label: "FAQs", href: "#faqs" },
];

function scrollToId(href: string) {
  const el = document.querySelector(href);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between px-5 transition-all duration-300 md:px-8",
          scrolled ? "h-12 md:h-16" : "h-14 md:h-20",
        )}
      >
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="shrink-0"
          aria-label="PayBridge home"
        >
          <Logo
            markClassName={cn("transition-all duration-300", scrolled ? "h-[26px]" : "h-8")}
          />
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => scrollToId(link.href)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <CtaButton event="nav_cta_click" label="Get on the Bridge" />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm border-border bg-background">
              <div className="mt-4 mb-8">
                <Logo />
              </div>
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <button
                      type="button"
                      onClick={() => scrollToId(link.href)}
                      className="rounded-lg px-3 py-3 text-left text-lg font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      {link.label}
                    </button>
                  </SheetClose>
                ))}
              </div>
              <div className="mt-8">
                <SheetClose asChild>
                  <button
                    type="button"
                    onClick={() => {
                      track("nav_cta_click");
                      scrollToWaitlist();
                    }}
                    className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground"
                  >
                    Get on the Bridge
                  </button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
