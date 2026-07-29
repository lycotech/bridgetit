import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Footer } from "@/components/sections/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { PillarCard } from "@/components/fortress/PillarCard";
import { PillarNav } from "@/components/fortress/PillarNav";
import { ProgressSummary } from "@/components/fortress/ProgressSummary";
import { FORTRESS_PILLARS, STATUS_LABEL } from "@/lib/platform/fortress";

/**
 * Public trust page — the outward face of Project Fortress.
 *
 * Wider than PageShell (max-w-5xl rather than 3xl) because the pillar cards
 * carry two columns of information; the legal shell would squeeze them.
 */
const Security = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 md:px-8">
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

      <main className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <SectionLabel>Project Fortress</SectionLabel>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            Security and trust,
            <br />
            written down honestly.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            PayBridge holds the most sensitive information most people have: what they earn, what
            they owe, and when they run short. This page is the whole security programme — eight
            pillars, every control, and the real status of each one.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mt-12">
          <ProgressSummary />
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          <section className="rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <h2 className="flex items-center gap-3 font-display text-xl font-bold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              Why we publish the unfinished ones
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              A page where every line has a green tick is not read as reassuring — it is read as
              marketing. So every control below carries its real maturity.{" "}
              <strong className="font-semibold text-primary">{STATUS_LABEL.live}</strong> means it
              is running in the product today.{" "}
              <strong className="font-semibold text-gold">{STATUS_LABEL.building}</strong> means it
              is partially delivered.{" "}
              <strong className="font-semibold text-foreground">{STATUS_LABEL.planned}</strong>{" "}
              means it is designed and scheduled, and will be in place before we handle live
              payroll. A buyer's security questionnaire asks for all three anyway.
            </p>
          </section>
        </Reveal>

        <Reveal delay={0.05} className="mt-12">
          <PillarNav />
        </Reveal>

        <div className="mt-12 space-y-6">
          {FORTRESS_PILLARS.map((pillar) => (
            <Reveal key={pillar.id} y={16}>
              <PillarCard pillar={pillar} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              Found something? Tell us.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              We would far rather hear about a weakness from you than from an attacker. Report
              anything you find and we will acknowledge it and act — no legal threats, no silence.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="mailto:hello@getpaybridge.com?subject=Security%20report"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Mail className="h-4 w-4" aria-hidden />
                hello@getpaybridge.com
              </a>
              <Link
                to="/privacy"
                className="inline-flex min-h-[44px] items-center rounded-full border border-border px-6 text-sm font-semibold text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
              >
                Read the privacy policy
              </Link>
            </div>
            <p className="mt-8 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground/80">
              PayBridge is currently being developed. Controls marked{" "}
              {STATUS_LABEL.building.toLowerCase()} or {STATUS_LABEL.planned.toLowerCase()} are not
              yet fully in place, and this page is updated as that changes. Nothing here is a
              warranty against every possible incident — it is a description of the controls we
              operate and the ones we have committed to.
            </p>
          </section>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
};

export default Security;
