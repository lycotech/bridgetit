import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Footer } from "@/components/sections/Footer";

/** Shared shell for static sub-pages (privacy, terms, contact). */
export function PageShell({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-5 md:px-8">
          <Link to="/" aria-label="PayBridge home">
            <Logo markClassName="h-9" />
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

      <main className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        {updated ? (
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>
        ) : null}
        {intro ? (
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        ) : null}

        <div className="prose-legal mt-10 space-y-8">{children}</div>
      </main>

      <Footer />
    </div>
  );
}

export function LegalBlock({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
