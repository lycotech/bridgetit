import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLES, ROLE_LIST } from "@/lib/platform/roles";
import type { Role } from "@/lib/platform/models";
import { cn } from "@/lib/utils";

const GROUPS: Array<{ label: string; roles: Role[] }> = [
  { label: "Employee", roles: ["employee"] },
  { label: "Employer", roles: ["employer_admin", "employer_finance", "employer_hr", "employer_viewer"] },
  { label: "Investor", roles: ["investor"] },
  { label: "PayBridge internal", roles: ["ops_officer", "ops_risk", "ops_compliance", "ops_finance", "super_admin"] },
];

/**
 * Prototype-only shortcut into any of the ten roles. Skips the OTP step so the
 * whole platform can be reviewed quickly. Removed once real auth is connected.
 */
export function DemoRolePanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { signInAsDemo } = useAuth();
  const navigate = useNavigate();

  const enter = (role: Role) => {
    signInAsDemo(role);
    navigate(ROLES[role].home, { replace: true });
  };

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-gold" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Explore a demo role</span>
          <span className="block text-xs text-muted-foreground">
            Prototype preview — no password needed
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="mt-4 space-y-3.5">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => enter(role)}
                    className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {ROLES[role].shortLabel}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {ROLE_LIST.length} roles available. Internal operations access is never linked from the public
            website navigation.
          </p>
        </div>
      ) : null}
    </div>
  );
}
