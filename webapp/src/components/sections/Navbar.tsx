import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { BRIDGE_PATH, CtaButton } from "@/components/brand/CtaButton";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Why PayBridge", href: "#why" },
  { label: "How It Works", href: "#how" },
  { label: "Who It Serves", href: "#who" },
  { label: "Trust", href: "#trust" },
  { label: "FAQs", href: "#faqs" },
];

/**
 * Routed nav items. "Employers" is required by name; it goes to the employer
 * registration page rather than a marketing anchor because that page is where
 * an HR or payroll lead actually needs to land.
 */
const NAV_ROUTES = [
  { label: "Employers", to: "/employers" },
  { label: "Capital Partners", to: "/capital-partners" },
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
          <Logo className={cn("transition-all duration-300", scrolled ? "h-7" : "h-9")} />
        </a>

        <div className="hidden items-center gap-7 lg:flex">
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
          {NAV_ROUTES.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/*
          The three public entry points, in order of commitment: Register (open
          an account), Sign in (already have one), Get on the Bridge (the loud
          action, for people who are not yet ready to register).

          Register and Sign in are quiet text links so the primary CTA keeps its
          weight. There is deliberately NO demonstration link here — the private
          demonstration is reachable only from the small footer link, because it
          is invitation-only and must not read as a public product tour.
        */}
        <div className="flex items-center gap-4">
          <Link
            to="/register"
            onClick={() => track("nav_register_click")}
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Register
          </Link>
          <Link
            to="/sign-in"
            onClick={() => track("nav_sign_in_click")}
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>

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
                {NAV_ROUTES.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link
                      to={link.to}
                      className="rounded-lg px-3 py-3 text-left text-lg font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </div>
              <div className="mt-8 space-y-3">
                <SheetClose asChild>
                  <Link
                    to={BRIDGE_PATH}
                    onClick={() => track("nav_cta_click")}
                    className="inline-flex w-full items-center justify-center rounded-full btn-brand px-6 py-3.5 text-sm font-semibold"
                  >
                    Get on the Bridge
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/register"
                    onClick={() => track("nav_register_click")}
                    className="inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-3.5 text-sm font-semibold text-foreground"
                  >
                    Register
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/sign-in"
                    onClick={() => track("nav_sign_in_click")}
                    className="inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-3.5 text-sm font-semibold text-foreground"
                  >
                    Sign in
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/contact"
                    className="inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-3.5 text-sm font-semibold text-foreground"
                  >
                    Contact us
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
