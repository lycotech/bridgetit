import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Footer } from "@/components/sections/Footer";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Shared shell for the registration pages.
 *
 * Every one of these pages carries the same operating principle in the same
 * place: register interest now, verify later. It is repeated rather than said
 * once because each page is a separate entry point from a separate campaign,
 * and nobody reads the site in order.
 */
export function RegistrationLayout({
  label,
  title,
  intro,
  aside,
  children,
}: {
  label: string;
  title: ReactNode;
  intro: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
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
            style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.14), transparent)" }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="flex justify-center">
                <SectionLabel>{label}</SectionLabel>
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-prosperity mt-6 font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl">
                {title}
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {intro}
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mx-auto mt-6 inline-flex max-w-xl items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-xs font-medium text-foreground/80">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                Register interest now. Complete verification when activation begins.
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <Reveal delay={0.16}>
              <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-2xl backdrop-blur-sm sm:p-9">
                {children}
              </div>
            </Reveal>
            {aside ? (
              <Reveal delay={0.2}>
                <div className="space-y-5 lg:sticky lg:top-8">{aside}</div>
              </Reveal>
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** A small card for the right-hand column: context, not persuasion. */
export function AsideCard({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "caution";
}) {
  return (
    <div
      className={
        tone === "caution"
          ? "rounded-2xl border border-gold/30 bg-gold/5 p-5"
          : "rounded-2xl border border-border bg-card/50 p-5"
      }
    >
      <h2 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
