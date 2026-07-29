import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, TrendingUp, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AUDIENCES } from "@/lib/platform/roles";

const ICONS: Record<string, LucideIcon> = {
  employee: User,
  employer: Building2,
  investor: TrendingUp,
};

const DETAIL: Record<string, string[]> = {
  employee: ["See your Available to Bridge", "Bridge It in minutes", "Track settlement on payday"],
  employer: ["Enable your team", "Protect payroll continuity", "Access a Salary Buffer"],
  investor: ["Review mandates", "Capital working where it matters", "Portfolio performance"],
};

export default function SelectRole() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Join PayBridge"
      subtitle="Tell us who you are and we will set up the right workspace for you."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/demo/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-3">
        {AUDIENCES.map((audience) => {
          const Icon = ICONS[audience.key] ?? User;
          return (
            <button
              key={audience.key}
              type="button"
              onClick={() => navigate(`/demo/register?audience=${audience.key}`)}
              className="group flex w-full items-start gap-4 rounded-2xl border border-border bg-background p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/[0.04]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                  {audience.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {audience.blurb}
                </span>
                <span className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                  {(DETAIL[audience.key] ?? []).map((item) => (
                    <span key={item} className="text-[11px] font-medium text-muted-foreground/80">
                      · {item}
                    </span>
                  ))}
                </span>
              </span>
              <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          );
        })}
      </div>

      <p className="disclaimer mt-5">
        PayBridge gives employees access to salary they have already earned, enabled by their employer.
        It is not a loan product for individuals.
      </p>
    </AuthLayout>
  );
}
