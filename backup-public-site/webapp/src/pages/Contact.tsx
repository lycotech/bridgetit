import { Link } from "react-router-dom";
import { Mail, ArrowRight, Linkedin, Instagram, Music2 } from "lucide-react";
import { PageShell } from "@/components/sections/PageShell";

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

const Contact = () => (
  <PageShell
    title="Contact"
    intro="We would love to hear from employees, employers, HR and payroll teams, capital and financial partners, and anyone who believes payday can work better."
  >
    <div className="rounded-2xl border border-border bg-card/60 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">Email us</p>
          <a
            href="mailto:hello@getpaybridge.com"
            className="font-display text-lg font-bold text-foreground hover:text-primary"
          >
            hello@getpaybridge.com
          </a>
        </div>
      </div>
    </div>

    <div>
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Follow</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {SOCIALS.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Icon className="h-4 w-4" />
            {label}
          </a>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">@mypaybridge · getpaybridge.com</p>
    </div>

    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
      <h2 className="font-display text-xl font-bold text-foreground">Want early access?</h2>
      <p className="mt-2 text-muted-foreground">
        The best way to stay close to PayBridge is to join the waitlist.
      </p>
      <Link
        to="/#waitlist"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
      >
        Get on the Bridge
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </PageShell>
);

export default Contact;
