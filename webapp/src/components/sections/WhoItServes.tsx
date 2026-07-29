import { Link } from "react-router-dom";
import { Users, Building2, Landmark, Boxes, ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { CtaButton } from "@/components/brand/CtaButton";
import { LogoMark } from "@/components/brand/Logo";
import { Reveal, StaggerGroup, staggerItem } from "@/components/motion/Reveal";
import { MDiv } from "@/lib/motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Each audience links straight to its own registration form. These used to
// point at /register?audience=… — account creation, which now lives inside
// the private demonstration. The public site registers interest; it does not
// open accounts.
const AUDIENCES = [
  {
    icon: Users,
    tag: "Employees",
    title: "More control between paydays.",
    body: "Bridge eligible earnings responsibly, understand what remains for payday and build stronger financial habits over time.",
    link: { to: "/get-on-the-bridge/employee", label: "Get on the Bridge" },
  },
  {
    icon: Building2,
    tag: "Employers",
    title: "Support your people without becoming their lender.",
    body: "Offer structured financial-wellness support, reduce informal salary requests and improve payroll visibility.",
    link: { to: "/employers", label: "Bring PayBridge to your workforce" },
  },
  {
    icon: Landmark,
    tag: "Capital & financial partners",
    title: "Capital that follows structure.",
    body: "Support monitored workforce-finance programmes built around verified data, clear limits, settlement controls and transparent reporting.",
    link: { to: "/capital-partners", label: "Register capital partnership interest" },
  },
  {
    icon: Boxes,
    tag: "Ecosystem partners",
    title: "Build better financial services around work.",
    body: "Connect payroll, payments, banking, insurance, savings, investments and employee benefits through the PayBridge ecosystem.",
    link: null,
  },
];

export function WhoItServes() {
  return (
    <section
      id="who"
      className="theme-light section relative border-t border-border bg-background text-foreground"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <SectionLabel>One bridge. Shared value.</SectionLabel>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Better for everyone around payroll.
            </h2>
          </Reveal>
        </div>

        {/* Mobile: compact accordion cards, first expanded */}
        <Reveal delay={0.1} className="lg:hidden">
          <Accordion
            type="single"
            collapsible
            defaultValue="item-0"
            className="mt-8 space-y-3"
          >
            {AUDIENCES.map(({ icon: Icon, tag, title, body, link }, i) => (
              <AccordionItem
                key={tag}
                value={`item-${i}`}
                className="overflow-hidden rounded-2xl border border-border bg-card px-4 shadow-sm"
              >
                <AccordionTrigger className="min-h-[56px] py-3.5 hover:no-underline">
                  <span className="flex items-center gap-3 text-left">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                        {tag}
                      </span>
                      <span className="font-display text-base font-bold leading-snug text-foreground">
                        {title}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pl-12 text-sm leading-relaxed text-muted-foreground">
                  {body}
                  {link ? (
                    <Link
                      to={link.to}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                    >
                      {link.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>

        {/* Desktop: 2×2 connected ecosystem */}
        <div className="relative mx-auto mt-14 hidden max-w-4xl lg:block">
          {/* cross connectors (visible only in the gaps between cards) */}
          <span
            className="absolute bottom-6 left-1/2 top-6 w-px -translate-x-1/2 bg-border"
            aria-hidden
          />
          <span
            className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-border"
            aria-hidden
          />
          {/* central hub */}
          {/* The hub is a rounded deck rather than a circle: the mark is about
              three and a half times wider than it is tall, so at any height that
              reads it burst straight out of a 64px round hole. */}
          <span className="absolute left-1/2 top-1/2 z-10 flex h-14 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-primary/40 bg-card text-primary ring-8 ring-background">
            <LogoMark className="h-auto w-14" />
          </span>

          <StaggerGroup className="grid grid-cols-2 gap-6">
            {AUDIENCES.map(({ icon: Icon, tag, title, body, link }) => (
              <MDiv
                key={tag}
                variants={staggerItem}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">
                  {tag}
                </span>
                <h3 className="mt-2 font-display text-lg font-bold leading-snug text-foreground">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                {link ? (
                  <Link
                    to={link.to}
                    className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    {link.label}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                ) : null}
              </MDiv>
            ))}
          </StaggerGroup>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 flex justify-center">
            <CtaButton event="midpage_cta_click" size="lg" label="Get on the Bridge" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
