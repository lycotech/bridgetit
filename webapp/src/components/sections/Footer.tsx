import { Link } from "react-router-dom";
import { Linkedin, Instagram, Music2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Tagline } from "@/components/brand/Tagline";
import { track } from "@/lib/analytics";

// X (Twitter) mark — lucide has no dedicated X icon.
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/mypaybridge", icon: Linkedin },
  { label: "Instagram", href: "https://www.instagram.com/mypaybridge", icon: Instagram },
  { label: "X", href: "https://x.com/mypaybridge", icon: XIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@mypaybridge", icon: Music2 },
];

function scrollToId(id: string) {
  document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-background">
      {/* The same payroll→prosperity ramp that closes the share card, drawn as a
          hairline across the top of the footer. Fades at both ends so it reads
          as light on an edge rather than a stripe. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--primary)) 18%, hsl(var(--success)) 82%, transparent)",
        }}
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <Tagline className="mt-4" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A better financial system around work.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
            <p className="mt-5 text-sm text-muted-foreground">@mypaybridge</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Explore
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <button onClick={() => scrollToId("#why")} className="text-foreground/80 transition-colors hover:text-primary">
                  About
                </button>
              </li>
              <li>
                <button onClick={() => scrollToId("#how")} className="text-foreground/80 transition-colors hover:text-primary">
                  How It Works
                </button>
              </li>
              <li>
                <button onClick={() => scrollToId("#faqs")} className="text-foreground/80 transition-colors hover:text-primary">
                  FAQs
                </button>
              </li>
              <li>
                <a
                  href="#beyond"
                  onClick={(e) => {
                    e.preventDefault();
                    track("product_concept_click");
                    scrollToId("#beyond");
                  }}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  View Product Concept
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Company
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/security" className="text-foreground/80 transition-colors hover:text-primary">
                  Security &amp; Trust
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-foreground/80 transition-colors hover:text-primary">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-foreground/80 transition-colors hover:text-primary">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-foreground/80 transition-colors hover:text-primary">
                  Contact
                </Link>
              </li>
              <li>
                <a
                  href="https://getpaybridge.com"
                  className="text-foreground/80 transition-colors hover:text-primary"
                >
                  getpaybridge.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Get on the Bridge
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  to="/get-on-the-bridge/employee"
                  className="text-foreground/80 transition-colors hover:text-primary"
                >
                  Employees · Bridgers
                </Link>
              </li>
              <li>
                <Link to="/employers" className="text-foreground/80 transition-colors hover:text-primary">
                  Employers · Bridge Partners
                </Link>
              </li>
              <li>
                <Link
                  to="/capital-partners"
                  className="text-foreground/80 transition-colors hover:text-primary"
                >
                  Capital Partners
                </Link>
              </li>
              <li>
                <Link
                  to="/get-on-the-bridge"
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  Not sure which? Start here
                </Link>
              </li>
              <li>
                <Link to="/brand" className="text-muted-foreground transition-colors hover:text-primary">
                  Brand &amp; logo files
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/*
          Account and demonstration links, kept apart from the marketing columns.

          "Private Demonstration" is deliberately here and nowhere else — small,
          in the footer, below the fold. The demonstration is invitation-only, so a
          prominent button in the navigation or on the homepage would advertise an
          environment almost every visitor cannot enter. The page it opens asks for
          an email address and an invitation code; it is not reachable through
          registration or ordinary customer sign-in.

          The administrator portal is NOT listed here, or anywhere else on the
          public site.
        */}
        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-8 text-sm">
          <Link to="/register" className="font-medium text-foreground/80 transition-colors hover:text-primary">
            Register
          </Link>
          <Link to="/sign-in" className="font-medium text-foreground/80 transition-colors hover:text-primary">
            Sign in
          </Link>
          <Link
            to="/private-demo"
            className="text-xs text-muted-foreground/70 transition-colors hover:text-primary"
          >
            Private Demonstration
          </Link>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground/80">
            PayBridge is currently being developed. Features, eligibility, pricing and partner
            services may change before launch. The ability to bridge earned income will be subject
            to employer participation, verification, eligibility, approved limits, charges and
            applicable terms. Lending is carried out under an FCCPC lender’s licence. Investment
            funds are managed by Invest-Trust Asset Management Limited, a SEC-licensed asset
            manager, and remain subject to suitability requirements and risks.
          </p>
          <p className="mt-6 text-xs text-muted-foreground/70">
            © {new Date().getFullYear()} PennyVest Technologies Limited. All rights reserved.
            PayBridge is a product and trademark of PennyVest Technologies Limited.
          </p>
        </div>
      </div>
    </footer>
  );
}
