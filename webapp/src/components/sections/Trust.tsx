import { Link } from "react-router-dom";
import {
  Building2,
  BadgeCheck,
  SlidersHorizontal,
  Receipt,
  Eye,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv } from "@/lib/motion";

const PRINCIPLES = [
  { icon: Building2, label: "Employer enabled" },
  { icon: BadgeCheck, label: "Verified earnings" },
  { icon: SlidersHorizontal, label: "Approved limits" },
  { icon: Receipt, label: "Charges shown clearly" },
  { icon: Eye, label: "Payday impact visible" },
  { icon: RefreshCcw, label: "Monitoring and reconciliation" },
];

export function Trust() {
  return (
    <section
      id="trust"
      className="theme-light section relative border-t border-border bg-background text-foreground"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex justify-center">
              <SectionLabel>Built for trust</SectionLabel>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Not free money.
              <br />
              A responsible bridge.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              PayBridge helps eligible employees bridge an approved portion of verified income
              already earned, subject to employer participation, eligibility, limits, charges and
              applicable terms.
            </p>
          </Reveal>
        </div>

        <StaggerGroup className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, label }) => (
            <MDiv
              key={label}
              variants={staggerItem}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-medium text-foreground">{label}</span>
            </MDiv>
          ))}
        </StaggerGroup>

        <Reveal delay={0.1}>
          <p className="mt-12 text-center font-display text-xl font-semibold text-foreground">
            Built for trust, <span className="text-primary">not just speed.</span>
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/security"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              See the full security programme
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
