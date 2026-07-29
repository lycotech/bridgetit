import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Footer } from "@/components/sections/Footer";
import { SegmentChooser } from "@/components/registration/SegmentChooser";

/**
 * The single destination for the principal "Get on the Bridge" call to action.
 *
 * It exists as its own route (rather than only as a homepage section) so the
 * CTA works identically from the navbar, the footer, a campaign link or an
 * email, without depending on scroll position.
 */
const GetOnTheBridge = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/" aria-label="PayBridge home">
            <Logo className="h-9" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full blur-[130px]"
            style={{
              background: "radial-gradient(closest-side, hsl(var(--primary) / 0.14), transparent)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <SegmentChooser />

          <p className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-foreground/80">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            Register interest now. Complete verification when activation begins.
          </p>

          {/*
            The two paths are genuinely different and a visitor cannot tell from
            the navigation labels alone, so each page points at the other.

            Get on the Bridge = tell us you are interested. No password, no
            documents; we come back to you when your segment activates.
            Register = open the account now: password, email confirmation and
            identity verification.
          */}
          <p className="mx-auto mt-5 max-w-xl text-center text-sm text-muted-foreground">
            Ready to open your account today instead?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Register and verify your identity
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default GetOnTheBridge;
