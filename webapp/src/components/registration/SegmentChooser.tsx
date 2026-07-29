import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Building2, Landmark } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * The segmented entry point. Every principal call to action on the public site
 * ends here, and this is the only fork: employee, employer, capital partner.
 *
 * Nothing on this screen implies approval, eligibility or a credit decision.
 * It asks one question and routes to one form.
 */

export const SEGMENT_OPTIONS = [
  {
    key: "employee" as const,
    icon: Briefcase,
    choice: "I am an Employee",
    community: "Bridgers",
    to: "/get-on-the-bridge/employee",
    cta: "Get on the Bridge",
    blurb:
      "Join the early PayBridge community and help shape a more responsible connection between work, income and financial wellbeing.",
  },
  {
    key: "employer" as const,
    icon: Building2,
    choice: "I represent an Employer",
    community: "Bridge Partners",
    to: "/employers",
    cta: "Bring PayBridge to your workforce",
    blurb:
      "Support your people through financial pressure without turning your organisation into a lender.",
  },
  {
    key: "capital_partner" as const,
    icon: Landmark,
    choice: "I am a Capital Partner",
    community: "Bridge Capital Partners",
    to: "/capital-partners",
    cta: "Register capital partnership interest",
    blurb:
      "Explore structured capital partnerships supporting responsible payroll access and workforce financial wellbeing.",
  },
];

function SegmentCard({
  option,
  index,
}: {
  option: (typeof SEGMENT_OPTIONS)[number];
  index: number;
}) {
  const Icon = option.icon;
  return (
    <Reveal delay={0.06 * index}>
      <Link
        to={option.to}
        onClick={() => track("segment_select", { segment: option.key })}
        className={cn(
          "group flex h-full flex-col rounded-3xl border border-border bg-card/60 p-6 text-left transition-all duration-300",
          "hover:-translate-y-1 hover:border-primary/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" />
        </span>

        <h3 className="mt-5 font-display text-xl font-bold text-foreground">{option.choice}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-primary">
          {option.community}
        </p>
        <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{option.blurb}</p>

        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {option.cta}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Link>
    </Reveal>
  );
}

export function SegmentChooser({ heading = true }: { heading?: boolean }) {
  return (
    <div>
      {heading ? (
        <div className="text-center">
          <Reveal>
            <div className="flex justify-center">
              <SectionLabel>Get on the Bridge</SectionLabel>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-prosperity mt-6 font-display text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              How would you like to get on the bridge?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Choose the route that fits you. Each one takes a couple of minutes and registers your
              interest only — no documents, no credit checks, no commitment.
            </p>
          </Reveal>
        </div>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {SEGMENT_OPTIONS.map((option, i) => (
          <SegmentCard key={option.key} option={option} index={i} />
        ))}
      </div>

      <Reveal delay={0.25}>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Registering is an expression of interest. It does not create an account, an approval or any
          form of credit, and verification only begins when activation does.{" "}
          <Link to="/contact" className="font-medium text-primary hover:underline">
            Something else on your mind?
          </Link>
        </p>
      </Reveal>
    </div>
  );
}
