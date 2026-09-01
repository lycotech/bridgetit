import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { SkipLink } from "@/components/a11y/SkipLink";
import { useSession, useSignOut } from "@/lib/account/session";
import { AIAssistWidget } from "@/components/account/AIAssistWidget";
import { AIAssistantChat } from "@/components/account/AIAssistantChat";
import { REAL_PORTAL_LABEL, REAL_PORTAL_NAV, type RealNavSection, type RealPortal } from "./real-navigation";

/**
 * Shell for the REAL customer dashboard — a structural/visual replica of
 * `webapp/src/components/dashboard/DashboardShell.tsx` (the mock demo's
 * shell), rebuilt against the real session instead of the demo one.
 *
 * Deliberately does NOT import anything from `@/lib/auth/auth-context` or
 * `@/lib/platform/mock-service` — the demo session (client-fabricated) and
 * the real session (server cookie) are independent by design and can both
 * be live in the same browser at once (see the Test Accounts feature).
 * Crossing those two systems here would entangle them.
 *
 * No role-switcher (no such concept for a real customer) and no
 * notification bell (no real notifications model yet) — both dropped
 * rather than stubbed against fake data.
 */
export function RealDashboardShell({ portal }: { portal: RealPortal }) {
  const { data: session } = useSession();
  const signOut = useSignOut();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  const user = session?.user ?? null;
  if (!user) return null;

  // A real employee account has no reason to be on /account/investor/* and
  // vice versa — send them to the portal that actually matches their
  // accountType rather than showing an empty/erroring shell.
  if (user.accountType !== portal) {
    return <Navigate to={user.accountType === "investor" ? "/account/investor" : "/account/employee"} replace />;
  }

  const sections: RealNavSection[] = REAL_PORTAL_NAV[portal];
  const initials = user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <Link to={`/account/${portal}`} className="flex items-center" aria-label="PayBridge home">
            <Logo className="h-6 sm:h-7" />
          </Link>

          <span className="hidden items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
            {REAL_PORTAL_LABEL[portal]} account
          </span>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu
              name={user.fullName}
              initials={initials}
              email={user.email}
              onSignOut={() => void signOut.mutateAsync().then(() => navigate("/", { replace: true }))}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border/70 px-3 py-6 lg:block">
          <SidebarBody sections={sections} />
          <SecureNote />
        </aside>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`${REAL_PORTAL_LABEL[portal]} account menu`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMobileOpen(false);
            }}
          >
            <div aria-hidden onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <div className="relative h-full w-[82vw] max-w-xs overflow-y-auto border-r border-border bg-card px-3 py-5">
              <div className="mb-5 flex items-center justify-between px-2">
                <Logo className="h-7" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  autoFocus
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <SidebarBody sections={sections} />
              <SecureNote />
            </div>
          </div>
        ) : null}

        <main id="pb-main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      <AIAssistWidget />
      <AIAssistantChat />
    </div>
  );
}

function SidebarBody({ sections }: { sections: RealNavSection[] }) {
  return (
    <nav className="space-y-6">
      {sections.map((section, i) => (
        <div key={section.label ?? i}>
          {section.label ? (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {section.label}
            </p>
          ) : null}
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SecureNote() {
  return (
    <div className="mt-7 rounded-xl border border-border bg-secondary/40 p-3.5">
      <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        Secure session
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Encrypted in transit. You will be signed out automatically after a period of inactivity.
      </p>
    </div>
  );
}

function UserMenu({
  name,
  initials,
  email,
  onSignOut,
}: {
  name: string;
  initials: string;
  email: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {initials}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-foreground sm:block">{name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="border-b border-border/70 px-4 py-3.5">
            <p className="text-sm font-bold text-foreground">{name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
