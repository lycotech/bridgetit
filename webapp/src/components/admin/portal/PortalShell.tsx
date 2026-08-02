import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  Building2,
  FileClock,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  ShieldHalf,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminSignOut } from "@/lib/admin/portal-session";
import { SkipLink } from "@/components/a11y/SkipLink";
import { ADMIN_ROLE_LABELS } from "../../../../../backend/src/types";
import type { AdminSessionView } from "../../../../../backend/src/types";

/**
 * The portal's eight sections, mirroring PORTAL_SECTIONS in
 * backend/src/security/admin-roles.ts. The `permission` on each entry decides
 * whether it is rendered.
 *
 * This is navigation hygiene, NOT access control: hiding a link stops an
 * auditor being shown an Approve button they cannot use, and does nothing
 * whatsoever to stop them calling the endpoint. Every route behind these links
 * re-checks the permission server-side on each request.
 */
const SECTIONS: { to: string; label: string; permission: string; icon: LucideIcon }[] = [
  { to: "/admin", label: "Overview", permission: "portal.overview.view", icon: LayoutDashboard },
  { to: "/admin/users", label: "Registered users", permission: "users.view", icon: Users },
  { to: "/admin/kyc", label: "KYC review", permission: "kyc.view", icon: ClipboardCheck },
  { to: "/admin/employers", label: "Employers", permission: "employers.view", icon: Building2 },
  { to: "/admin/risk", label: "Credit risk", permission: "risk.view", icon: Gauge },
  { to: "/admin/reports", label: "Reports", permission: "reports.view", icon: BarChart3 },
  { to: "/admin/invitations", label: "Demo invitations", permission: "invitations.view", icon: Ticket },
  { to: "/admin/support", label: "Support requests", permission: "support.view", icon: LifeBuoy },
  { to: "/admin/admins", label: "Admin users", permission: "admins.view", icon: UserCog },
  { to: "/admin/audit", label: "Audit logs", permission: "audit.view", icon: FileClock },
  { to: "/admin/security", label: "Security settings", permission: "security.view", icon: ShieldHalf },
  { to: "/admin/mail", label: "Outgoing mail", permission: "security.view", icon: Mail },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PortalShell({ session }: { session: AdminSessionView }) {
  const navigate = useNavigate();
  const signOut = useAdminSignOut();

  const visible = SECTIONS.filter((section) => session.permissions.includes(section.permission));

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <SkipLink />
      <aside className="border-b border-border bg-card/40 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-6 p-5">
          <div className="flex items-center justify-between">
            <Logo className="h-8" />
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Ops
            </span>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {visible.map((section) => (
              <NavLink
                key={section.to}
                to={section.to}
                end={section.to === "/admin"}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/12 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )
                }
              >
                <section.icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{section.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="hidden border-t border-border pt-4 lg:block">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                {initials(session.name ?? "?")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{session.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.role ? ADMIN_ROLE_LABELS[session.role] : ""}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start text-muted-foreground"
              onClick={() => {
                signOut.mutate(undefined, { onSuccess: () => navigate("/admin/login", { replace: true }) });
              }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <main id="pb-main" tabIndex={-1} className="min-w-0 outline-none">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
