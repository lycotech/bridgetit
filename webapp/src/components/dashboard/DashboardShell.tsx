import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Menu, Repeat, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { roleMeta, ROLE_LIST } from "@/lib/platform/roles";
import type { Portal } from "@/lib/platform/models";
import { platformApi, qk } from "@/lib/platform/mock-service";
import { relativeTime } from "@/lib/platform/format";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { PORTAL_LABEL, PORTAL_NAV } from "./navigation";
import type { NavSection } from "./navigation";

/** The four places Simple View keeps in the employee menu. */
const SIMPLE_NAV_PATHS = ["/employee", "/employee/bridge", "/employee/savings", "/employee/support"];

/**
 * Shared shell for all four portals: same header, sidebar and spacing system as
 * the public site's visual language (deep navy surface, PayBridge Teal accents).
 */
export function DashboardShell({ portal }: { portal: Portal }) {
  const { user, signOut, signInAsDemo, can } = useAuth();
  const { prefs, t } = usePreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  if (!user) return null;
  const meta = roleMeta(user.role);

  /**
   * Simple View also simplifies the menu, or it does not simplify anything: a
   * four-tile home screen behind a seven-item sidebar is still a seven-item app.
   * Nothing is removed from the router — every page is still reachable by URL and
   * returns the moment Simple View is switched off — the menu just stops
   * offering Invest, Grow and Transactions to somebody who asked for less.
   */
  const simpleNav = portal === "employee" && prefs.simpleView;
  const sections = PORTAL_NAV[portal]
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.permission || can(item.permission)) && (!simpleNav || SIMPLE_NAV_PATHS.includes(item.to)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const switchRole = (role: string) => {
    const next = signInAsDemo(role as typeof user.role);
    queryClient.clear();
    navigate(roleMeta(next.role).home);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/*
        First thing in the tab order, invisible until focused (WCAG 2.4.1). Every
        page here starts with a logo, a menu button, a bell and a user menu; without
        this, reaching the actual content by keyboard costs four stops on every
        single navigation, and reaching it by screen reader costs the whole sidebar.
      */}
      <a
        href="#pb-main"
        className="sr-only rounded-b-xl focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-xl focus:bg-primary focus:px-4 focus:text-sm focus:font-bold focus:text-primary-foreground focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[hsl(var(--ring))]"
      >
        {t("common.skip_to_content")}
      </a>

      {/* Top bar */}
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

          {/* The real lockup, not the mark plus a hand-typed word. The mark is
              roughly 3.5:1, so the old width-driven `w-10` sized it to eleven
              pixels tall — a scratch beside sixteen-pixel type. Height-driven
              sizing is the only safe way to place this artwork. */}
          <Link to={meta.home} className="flex items-center" aria-label="PayBridge home">
            <Logo className="h-6 sm:h-7" />
          </Link>

          <span className="hidden items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
            {PORTAL_LABEL[portal]} portal
          </span>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell portal={portal} />
            <UserMenu
              name={user.fullName}
              initials={user.avatarInitials}
              roleLabel={meta.label}
              organisation={user.organisation}
              onSignOut={() => {
                signOut();
                queryClient.clear();
                navigate("/demo/login");
              }}
              onSwitchRole={switchRole}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border/70 px-3 py-6 lg:block">
          <SidebarBody sections={sections} />
          <SecureNote />
        </aside>

        {/* Mobile drawer. Escape closes it, and the backdrop is an inert div —
            as a <button> it was the first tab stop inside the drawer, so a
            keyboard user's first action in the menu was an invisible control
            that shut it again. */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={PORTAL_LABEL[portal]}
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

        {/* Content. The skip link lands here; tabIndex -1 makes it a valid focus
            target so what follows Tab is the first control of the page itself. */}
        <main id="pb-main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarBody({ sections }: { sections: NavSection[] }) {
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

function NotificationBell({ portal }: { portal: Portal }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: qk.notifications(portal),
    queryFn: () => platformApi.notifications(portal),
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = (query.data ?? []).filter((n) => !n.read).length;

  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(event) => {
        // Closing by clicking away is not available to somebody who is not
        // clicking. Escape is the keyboard equivalent (WCAG 2.1.1).
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {/* The teal dot is decoration; the count above it in aria-label is the
            information. A dot alone is colour-and-shape only (WCAG 1.4.1). */}
        {unread ? (
          <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <p className="text-sm font-bold text-foreground">Notifications</p>
            {unread ? (
              <button
                type="button"
                onClick={async () => {
                  await platformApi.markNotificationsRead(portal);
                  void queryClient.invalidateQueries({ queryKey: qk.notifications(portal) });
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
            {(query.data ?? []).length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing new right now.</li>
            ) : (
              (query.data ?? []).map((item) => (
                <li key={item.id} className={cn("px-4 py-3", !item.read && "bg-primary/[0.04]")}>
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        item.tone === "success" && "bg-primary",
                        item.tone === "attention" && "bg-gold",
                        item.tone === "info" && "bg-protected",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{relativeTime(item.at)}</p>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({
  name,
  initials,
  roleLabel,
  organisation,
  onSignOut,
  onSwitchRole,
}: {
  name: string;
  initials: string;
  roleLabel: string;
  organisation?: string;
  onSignOut: () => void;
  onSwitchRole: (role: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setShowRoles(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setShowRoles(false);
        }
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
            <p className="mt-0.5 text-xs text-muted-foreground">{roleLabel}</p>
            {organisation ? <p className="text-xs text-muted-foreground/80">{organisation}</p> : null}
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={() => setShowRoles((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
            >
              <Repeat className="h-4 w-4" />
              Switch demo role
            </button>
            {showRoles ? (
              <ul className="mb-1 max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-card p-1">
                {ROLE_LIST.map((role) => (
                  <li key={role.role}>
                    <button
                      type="button"
                      onClick={() => onSwitchRole(role.role)}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {role.label}
                      <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        {PORTAL_LABEL[role.portal]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
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
