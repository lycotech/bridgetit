import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { BrandSpan } from "@/components/brand/BrandSpan";
import { Logo } from "@/components/brand/Logo";

/**
 * Shell for every authentication screen. Keeps the public site's navy surface,
 * grid texture and typography so signing in feels like the same product.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  aside,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid opacity-[0.35]" />
        <div
          className="absolute -top-40 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent)" }}
        />
        <BrandSpan
          withUprights
          className="absolute -top-6 left-1/2 w-[1200px] max-w-none -translate-x-1/2 opacity-[0.06]"
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="PayBridge home">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
        </div>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-12">
          <div className="order-2 hidden lg:order-1 lg:block">{aside ?? <DefaultAside />}</div>

          <div className="order-1 lg:order-2">
            <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              ) : null}
              <div className="mt-6">{children}</div>
              {footer ? <div className="mt-6 border-t border-border/70 pt-5">{footer}</div> : null}
            </div>

            <p className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 text-center text-xs text-muted-foreground/80">
              <Lock className="h-3 w-3" />
              Your session is encrypted. PayBridge never asks for your bank password or card PIN.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultAside() {
  return (
    <div className="max-w-md">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">The PayBridge platform</p>
      <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground">
        One bridge.
        <br />
        <span className="text-primary">Four vantage points.</span>
      </h2>
      <p className="mt-5 text-base leading-relaxed text-muted-foreground">
        Employees reach the pay they have already earned. Employers protect payroll continuity.
        Investors put capital to work where salaries are earned. PayBridge keeps every naira
        accounted for.
      </p>
      <ul className="mt-7 space-y-3.5">
        {[
          "Earned pay, not credit — always shown before you confirm",
          "Employer-enabled and payroll-verified",
          "Transparent charges on every screen",
        ].map((line) => (
          <li key={line} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
