import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  HeartPulse,
  Landmark,
  LineChart,
  Lock,
  PiggyBank,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

/**
 * `/demonew` — a PREVIEW of the proposed new public homepage.
 *
 * Not wired to anything and not linked from the live site: `/` still renders
 * `pages/Index.tsx` untouched. This exists so the design can be judged in a
 * browser before anyone decides to replace the homepage.
 *
 * The whole page is wrapped in `.theme-light` (src/index.css) rather than
 * hard-coded hex values. That class is the product's existing warm-paper
 * palette — cream ground, navy ink, the darkened teal that actually passes
 * contrast on white — so this preview inherits real brand tokens and responds
 * to High contrast like every other page, instead of being a one-off stylesheet
 * that drifts the moment the brand moves.
 *
 * TWO THINGS FROM THE SUPPLIED MOCK ARE DELIBERATELY NOT BUILT — see the notes
 * at `ProofBar` and `Testimonial` below. Both would put a claim on a public
 * marketing page that PayBridge cannot substantiate.
 *
 * PHOTOGRAPHY: three brand photographs, converted from the ~1.8MB PNG originals
 * to WebP at display width — 5.4MB of source became 168KB, which is the
 * difference between a homepage that loads on Nigerian mobile data and one that
 * does not. `PhotoSlot` still falls back to a labelled placeholder if a path is
 * ever unset, so the layout cannot collapse behind a missing file.
 */

const HERO_PHOTO: string | null = "/brand/photos/hero-employee.webp";
const EMPLOYER_PHOTO: string | null = "/brand/photos/employer-briefing.webp";
const EMPLOYEES_PHOTO: string | null = "/brand/photos/employees-at-home.webp";

/* ------------------------------------------------------------------ shared */

function PhotoSlot({
  src,
  alt,
  label,
  className,
  priority = false,
}: {
  src: string | null;
  alt: string;
  label: string;
  className?: string;
  /** The hero is above the fold and must not be lazy-loaded; everything else is. */
  priority?: boolean;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    );
  }
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/[0.10] via-secondary to-secondary/60 text-center ${className ?? ""}`}
      aria-hidden
    >
      <Sparkles className="h-6 w-6 text-primary/70" />
      <p className="px-6 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[0.78rem] font-extrabold uppercase tracking-[0.2em] text-primary ${className ?? ""}`}>
      {children}
    </p>
  );
}

/* --------------------------------------------------------------------- nav */

function PreviewNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled ? "border-b border-border bg-background/95 backdrop-blur-xl" : "border-b border-transparent bg-background"
      }`}
    >
      <div className="mx-auto flex h-[78px] w-[min(1180px,92vw)] items-center justify-between gap-7">
        <img src="/brand/paybridge-logo-on-light.svg" alt="PayBridge" className="h-8 w-auto" />
        <div className="hidden items-center gap-7 text-[0.95rem] font-medium text-foreground lg:flex">
          <a href="#employees" className="hover:text-primary">Employees</a>
          <a href="#employers" className="hover:text-primary">Employers</a>
          <a href="#how" className="hover:text-primary">How it works</a>
          <a href="#trust" className="hover:text-primary">Trust</a>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/sign-in" className="hidden px-2.5 py-3 text-sm font-bold text-foreground hover:text-primary sm:inline-flex">
            Sign in
          </Link>
          <a
            href="#contact"
            className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-5 py-3 text-sm font-extrabold text-background transition-transform hover:-translate-y-px"
          >
            Get on the Bridge <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------- hero */

function FloatCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute z-10 rounded-[18px] border border-white/70 bg-card/95 p-4 shadow-[0_18px_50px_rgba(4,30,45,0.14)] backdrop-blur ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function Hero() {
  return (
    <header className="overflow-hidden border-b border-border">
      <div className="mx-auto grid w-[min(1180px,92vw)] items-stretch gap-0 lg:min-h-[690px] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="py-16 lg:py-24 lg:pr-12">
          <Eyebrow>Financial wellbeing, built around work.</Eyebrow>
          <h1 className="mt-4 max-w-[730px] font-serif text-[clamp(3rem,6vw,6.3rem)] font-bold leading-[0.94] tracking-[-0.055em] text-foreground">
            Life does not always wait for payday.
          </h1>
          <p className="mt-7 max-w-[650px] text-lg leading-relaxed text-muted-foreground">
            PayBridge helps eligible employees responsibly access part of their verified earned income when needed,
            while building stronger financial habits through savings, investments and practical financial education.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#employees"
              className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-5 py-3.5 text-sm font-extrabold text-background transition-transform hover:-translate-y-px"
            >
              I am an employee <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#employers"
              className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-extrabold text-foreground transition-colors hover:border-primary/50"
            >
              I represent an employer
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Employer-enabled · Verified earnings · Approved limits apply
          </p>
        </div>

        <div className="relative min-h-[520px] lg:min-h-[690px]">
          <PhotoSlot
            src={HERO_PHOTO}
            alt="An employee in a PayBridge hoodie checking her phone outside her workplace"
            label="Hero photography"
            priority
            className="h-full w-full rounded-3xl object-cover object-top lg:rounded-none"
          />

          <FloatCard className="right-5 top-16 min-w-[215px]">
            <span className="flex items-center gap-2 text-[0.85rem] font-extrabold text-primary">
              <i className="h-2.5 w-2.5 rounded-full bg-primary" />
              Illustrative access
            </span>
            <b className="mt-1 block font-display text-[1.65rem] font-extrabold tracking-tight text-foreground tnum">
              ₦40,000
            </b>
            <p className="text-sm text-muted-foreground">of verified earned income</p>
          </FloatCard>

          <FloatCard className="right-12 top-52 min-w-[215px]">
            <span className="flex items-center gap-2 text-[0.85rem] font-extrabold text-gold">
              <i className="h-2.5 w-2.5 rounded-full bg-gold" />
              Protected for payday
            </span>
            <b className="mt-1 block font-display text-[1.65rem] font-extrabold tracking-tight text-foreground tnum">
              ₦140,000
            </b>
            <p className="text-sm text-muted-foreground">remains after the bridge</p>
          </FloatCard>

          <Testimonial />
        </div>
      </div>
    </header>
  );
}

/**
 * The mock's quote, kept — but marked "Illustrative".
 *
 * An unattributed testimonial on a public page reads as a real customer saying
 * a real thing. PayBridge has no such customer yet, and a fabricated one is a
 * false claim about the product's results, not a design flourish. The product
 * already labels invented figures "ILLUSTRATIVE EXAMPLE" on the dashboard; this
 * is the same rule applied to words. Swap in a real, consented quote and the
 * label comes off.
 */
function Testimonial() {
  return (
    <FloatCard className="bottom-14 left-4 max-w-[330px]">
      <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
        Illustrative
      </span>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">
        “A little breathing room can protect a whole day.”
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Transport. Food. Family. Emergencies. Life.</p>
    </FloatCard>
  );
}

/**
 * The mock puts a "TRUSTED BY FORWARD THINKING EMPLOYERS" strip here, showing
 * the Access, Dangote, MTN, Flutterwave, PwC and Microsoft marks.
 *
 * NOT BUILT, and it should not be. None of those companies is a PayBridge
 * customer, so the strip asserts a commercial relationship that does not
 * exist — to visitors, and to the employers being named without permission.
 * That is a false endorsement and an unlicensed use of six trademarks, on the
 * one page whose entire job is to be believed.
 *
 * What replaces it is the mock's own proof bar: four claims PayBridge can
 * actually stand behind today. When there are real customers who have agreed
 * in writing to be named, a logo strip becomes honest and can go back.
 */
function ProofBar() {
  const items = [
    { title: "Employer enabled", body: "Designed around work, not outside it." },
    { title: "Verified earnings", body: "Access is linked to income already earned." },
    { title: "Privacy first", body: "Only necessary programme information reaches HR." },
    { title: "Built beyond access", body: "Save. Invest. Learn. Build resilience over time." },
  ];
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto grid w-[min(1180px,92vw)] sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.title}
            className={`px-5 py-7 ${i < items.length - 1 ? "border-b border-border sm:border-b-0 lg:border-r" : ""}`}
          >
            <b className="block text-base font-bold text-foreground">{item.title}</b>
            <span className="text-[0.88rem] text-muted-foreground">{item.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

function Section({
  id,
  soft,
  children,
}: {
  id?: string;
  soft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`py-20 lg:py-24 ${soft ? "bg-secondary/40" : ""}`}>
      <div className="mx-auto w-[min(1180px,92vw)]">{children}</div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="my-3 font-serif text-[clamp(2.2rem,4.5vw,4.6rem)] font-bold leading-none tracking-[-0.04em] text-foreground">
      {children}
    </h2>
  );
}

function HumanSide() {
  const moments = [
    { icon: Users, title: "Getting to work", body: "A transport need should not have to become an HR emergency." },
    { icon: HeartPulse, title: "Unexpected needs", body: "Life can happen before payday. Clear limits help create room without losing sight of payday." },
    { icon: Building2, title: "Family responsibilities", body: "Financial pressure is personal, but its effects can follow people into work." },
    { icon: Sparkles, title: "Building forward", body: "Short-term access should sit beside tools that support longer-term resilience." },
  ];

  return (
    <Section id="employees" soft>
      <Eyebrow>The human side of payroll</Eyebrow>
      <SectionTitle>
        Work happens daily.
        <br />
        Life does too.
      </SectionTitle>
      <p className="max-w-[720px] text-[1.08rem] leading-relaxed text-muted-foreground">
        A fixed payday can create a real timing gap. PayBridge is designed around the everyday realities employees
        carry into work, without asking employers to become lenders.
      </p>

      {/* The emotional beat of this section, given its own width: the point is
          that this happens at home, not at a desk. */}
      <figure className="relative mt-11 overflow-hidden rounded-[26px]">
        <PhotoSlot
          src={EMPLOYEES_PHOTO}
          alt="Two people at home looking at a phone together"
          label="Employee lifestyle photography"
          className="h-[300px] w-full object-cover object-[center_28%] lg:h-[420px]"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[hsl(214_60%_9%)]/90 to-transparent px-6 pb-6 pt-16 lg:px-10">
          <p className="max-w-[540px] font-serif text-xl font-bold leading-snug text-white lg:text-2xl">
            The money conversations that matter most rarely happen at a desk.
          </p>
        </figcaption>
      </figure>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="relative min-h-[390px] overflow-hidden rounded-[26px] bg-[hsl(214_56%_12%)] p-10 text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.2em] text-[#8fe0cb]">A simple idea</p>
          <h3 className="my-4 max-w-[560px] font-serif text-[2.25rem] font-bold leading-[1.04]">
            You have already shown up. Your earnings are already building.
          </h3>
          <p className="max-w-[560px] leading-relaxed text-[#dbe6ec]">
            When life cannot wait, eligible employees can see what they have earned, understand what may be
            responsibly bridged and know what remains protected for payday.
          </p>
          <a
            href="#how"
            className="mt-6 inline-flex items-center gap-2.5 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-white/10"
          >
            See how the bridge works <ArrowRight className="h-4 w-4" />
          </a>
        </article>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {moments.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[22px] border border-border bg-card p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h4 className="mt-2 text-[1.15rem] font-bold text-foreground">{title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Pillars() {
  const pillars = [
    { num: "01", title: "Access", accent: "bg-primary", icon: Wallet, body: "Responsible access to an approved portion of verified income already earned." },
    { num: "02", title: "Save", accent: "bg-protected", icon: PiggyBank, body: "Build a financial buffer through regulated savings products made available through partners." },
    { num: "03", title: "Invest", accent: "bg-gold", icon: LineChart, body: "Explore investment options suited to goals and risk profile through appropriately regulated providers." },
    { num: "04", title: "Learn", accent: "bg-[#8067c8]", icon: BookOpen, body: "Practical financial education built around real decisions about income, savings and investing." },
  ];

  return (
    <Section>
      <Eyebrow>Access today. Build tomorrow.</Eyebrow>
      <SectionTitle>One workplace. Four ways to move forward.</SectionTitle>
      <p className="max-w-[720px] text-[1.08rem] leading-relaxed text-muted-foreground">
        PayBridge is built to do more than solve the days before payday. The broader idea is to turn payroll into a
        pathway for resilience, confidence and long-term progress.
      </p>

      <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map(({ num, title, accent, icon: Icon, body }) => (
          <div key={title} className="relative min-h-[235px] overflow-hidden rounded-[22px] border border-border bg-card p-7">
            <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
            <div className="flex items-center justify-between">
              <span className="text-[0.76rem] font-black tracking-[0.12em] text-muted-foreground">{num}</span>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-8 text-[1.55rem] font-bold tracking-tight text-foreground">{title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Employers() {
  const benefits = [
    { title: "Less salary-advance administration", body: "Reduce emails, exceptions and manual approvals." },
    { title: "Keep payroll simple", body: "Your existing payroll process remains the anchor." },
    { title: "Protect employee privacy", body: "HR sees only what is necessary for programme administration and settlement." },
    { title: "Build a broader benefit", body: "Access can sit alongside saving, investing and financial education." },
  ];

  return (
    <Section id="employers" soft>
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <PhotoSlot
          src={EMPLOYER_PHOTO}
          alt="A PayBridge team member briefing an employer's staff on Access, Save, Invest and Learn"
          label="Employer photography"
          className="h-[420px] w-full overflow-hidden rounded-[30px] object-cover object-[center_25%] lg:h-[510px]"
        />
        <div>
          <Eyebrow>For employers</Eyebrow>
          <SectionTitle>Support your people without becoming their lender.</SectionTitle>
          <p className="max-w-[720px] text-[1.08rem] leading-relaxed text-muted-foreground">
            Replace informal salary-advance requests with a structured financial wellbeing programme designed around
            existing payroll, agreed controls and minimal HR intervention.
          </p>
          <div className="my-7 grid gap-3.5 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-2xl border border-border bg-card/70 p-5">
                <b className="mb-1 block text-sm font-bold text-foreground">{benefit.title}</b>
                <span className="text-sm text-muted-foreground">{benefit.body}</span>
              </div>
            ))}
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-5 py-3.5 text-sm font-extrabold text-background transition-transform hover:-translate-y-px"
          >
            Bring PayBridge to your workforce <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Employee activates PayBridge", body: "Eligible employees onboard following employer approval and complete required verification." },
    { title: "Employer runs payroll once", body: "Your salary process stays where it is. No second payroll for HR to manage." },
    { title: "PayBridge handles settlement", body: "Approved programme transactions are reconciled through the agreed infrastructure." },
    { title: "Employee receives the balance", body: "The remaining salary can continue to the employee's nominated everyday bank account." },
  ];

  return (
    <Section id="how">
      <Eyebrow>How PayBridge fits into payroll</Eyebrow>
      <SectionTitle>One payroll. No duplicate work.</SectionTitle>
      <p className="max-w-[720px] text-[1.08rem] leading-relaxed text-muted-foreground">
        The employer keeps its normal payroll process. PayBridge is designed to handle the financial wellbeing layer
        around it within agreed employer rules and programme controls.
      </p>

      <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((stepItem, i) => (
          <div key={stepItem.title} className="rounded-[20px] border border-border bg-card p-7">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-black text-primary-foreground">
              {i + 1}
            </span>
            <h4 className="mb-2 mt-4 text-[1.1rem] font-bold text-foreground">{stepItem.title}</h4>
            <p className="text-[0.92rem] leading-relaxed text-muted-foreground">{stepItem.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AccountSection() {
  return (
    <Section soft>
      <div className="grid items-center gap-11 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Eyebrow>The PayBridge Account</Eyebrow>
          <SectionTitle>A clearer view of work, money and payday.</SectionTitle>
          <p className="max-w-[720px] text-[1.08rem] leading-relaxed text-muted-foreground">
            Every verified user can receive a dedicated account linked to their PayBridge profile through regulated
            banking infrastructure. The employee does not have to abandon their existing bank.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Receive eligible workplace payments",
              "Support PayBridge Access settlement where activated",
              "Fund savings and investment products through partners",
              "Transfer balances to a nominated bank account where supported",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[1.02rem] leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[34px] border border-border bg-gradient-to-b from-primary/[0.06] to-card p-7 shadow-[0_20px_55px_rgba(11,55,61,0.08)]">
          <div className="rounded-[28px] border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Illustrative example</p>
            <p className="my-1.5 font-display text-[2.35rem] font-black tracking-tight text-foreground tnum">₦180,000</p>
            <p className="text-sm text-muted-foreground">Earned so far</p>
            <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full w-[72%] rounded-full bg-gradient-to-r from-primary to-[#4bbca0]" />
            </div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
              <span>20 of 22 workdays</span>
              <span>Next payday: 10 days</span>
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3">
            {[
              { label: "Available to bridge", value: "₦40,000" },
              { label: "Protected for payday", value: "₦140,000" },
              { label: "Save", value: "Build a buffer" },
              { label: "Invest", value: "Build forward" },
            ].map((mini) => (
              <div key={mini.label} className="rounded-[18px] border border-border bg-card p-4">
                <span className="text-xs text-muted-foreground">{mini.label}</span>
                <b className="mt-0.5 block text-lg font-bold text-foreground">{mini.value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function Trust() {
  const items = [
    { icon: Lock, title: "Data minimisation", body: "Collect only what is necessary." },
    { icon: Users, title: "Role-based access", body: "Restrict information by responsibility." },
    { icon: ScrollText, title: "Transparent pricing", body: "Show charges and payday impact before confirmation." },
    { icon: Landmark, title: "Reconciliation", body: "Keep programme movements clear and auditable." },
    { icon: ShieldCheck, title: "Employee privacy", body: "Spending and personal goals remain private." },
    { icon: Building2, title: "Regulated partners", body: "Partner services are provided through appropriate regulated entities where applicable." },
  ];

  return (
    <section id="trust" className="bg-[hsl(214_56%_12%)] py-20 text-white lg:py-24">
      <div className="mx-auto grid w-[min(1180px,92vw)] gap-12 lg:grid-cols-2">
        <div>
          <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.2em] text-[#8fe0cb]">Built for trust</p>
          <h2 className="my-3 font-serif text-[clamp(2.2rem,4.5vw,4.6rem)] font-bold leading-none tracking-[-0.04em]">
            Financial support without unnecessary exposure.
          </h2>
          <p className="max-w-[720px] text-[1.08rem] leading-relaxed text-[#d8e3e9]">
            The employer should see only what is required to administer the programme. Personal financial choices
            remain personal.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-white/15 p-5 text-[#e3edf2]">
              <Icon className="mb-2 h-4 w-4 text-[#8fe0cb]" />
              <b className="block text-white">{title}</b>
              <span className="text-sm">{body}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="contact" className="bg-gradient-to-br from-secondary to-background py-20 lg:py-24">
      <div className="mx-auto w-[min(1180px,92vw)]">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[30px] border border-border bg-card/60 p-8 lg:flex-row lg:items-center lg:p-12">
          <div>
            <Eyebrow>Get on the Bridge</Eyebrow>
            <h2 className="my-3 max-w-[760px] font-serif text-[clamp(2rem,3.4vw,3.3rem)] font-bold leading-tight tracking-[-0.03em] text-foreground">
              A better financial system around work.
            </h2>
            <p className="max-w-[620px] leading-relaxed text-muted-foreground">
              Start with a conversation about your workforce, payroll process and the lightest operating model that
              can work safely.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/get-on-the-bridge"
              className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-5 py-3.5 text-sm font-extrabold text-background transition-transform hover:-translate-y-px"
            >
              Talk to our team <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:hello@getpaybridge.com"
              className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-extrabold text-foreground transition-colors hover:border-primary/50"
            >
              hello@getpaybridge.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewFooter() {
  return (
    <footer className="bg-[hsl(214_60%_9%)] px-0 py-12 text-[#d8e2e8]">
      <div className="mx-auto w-[min(1180px,92vw)]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <img
              src="/brand/paybridge-logo-white.svg"
              alt="PayBridge"
              className="h-8 w-auto"
            />
            <p className="mt-4 max-w-[300px] text-sm leading-relaxed">Financial wellbeing, built around work.</p>
          </div>
          <div>
            <h5 className="mb-3 font-bold text-white">Explore</h5>
            {[["Employees", "#employees"], ["Employers", "#employers"], ["How it works", "#how"]].map(([label, href]) => (
              <a key={label} href={href} className="my-2 block text-sm text-[#b9c7d0] hover:text-white">
                {label}
              </a>
            ))}
          </div>
          <div>
            <h5 className="mb-3 font-bold text-white">Company</h5>
            <a href="#trust" className="my-2 block text-sm text-[#b9c7d0] hover:text-white">Security &amp; Trust</a>
            <Link to="/contact" className="my-2 block text-sm text-[#b9c7d0] hover:text-white">Contact</Link>
            <Link to="/privacy" className="my-2 block text-sm text-[#b9c7d0] hover:text-white">Privacy</Link>
          </div>
          <div>
            <h5 className="mb-3 font-bold text-white">Get on the Bridge</h5>
            {["Employees", "Employers", "Capital Partners"].map((label) => (
              <Link key={label} to="/get-on-the-bridge" className="my-2 block text-sm text-[#b9c7d0] hover:text-white">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-7 border-t border-white/10 pt-6 text-xs leading-relaxed text-[#8fa2ae]">
          PayBridge is a product and trademark of PennyVest Technologies Limited. Access to earned income is subject
          to employer participation, verification, eligibility, approved limits, charges and applicable terms.
          Partner services remain subject to applicable regulation and provider terms.
        </p>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------------- page */

export default function DemoNew() {
  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <div className="bg-foreground px-4 py-2 text-center text-xs font-semibold text-background">
        Preview of a proposed new homepage · not live · the current homepage is unchanged at /
      </div>
      <PreviewNav />
      <Hero />
      <ProofBar />
      <HumanSide />
      <Pillars />
      <Employers />
      <HowItWorks />
      <AccountSection />
      <Trust />
      <FinalCta />
      <PreviewFooter />
    </div>
  );
}
