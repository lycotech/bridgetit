import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./auth-context";
import { homeFor, portalFor, roleMeta } from "@/lib/platform/roles";
import type { Permission } from "@/lib/platform/roles";
import type { Portal } from "@/lib/platform/models";
import { Logo } from "@/components/brand/Logo";
import { Link } from "react-router-dom";

/** Route guard: signed in, correct portal, and (optionally) the right permission. */
export function RequireAuth({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <SessionSplash />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/demo/login?next=${next}`} replace />;
  }

  if (portalFor(user.role) !== portal) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return <>{children}</>;
}

/** Inline permission gate — renders a calm, explanatory denial instead of a redirect. */
export function RequirePermission({
  permission,
  children,
  moduleName,
}: {
  permission: Permission;
  children: ReactNode;
  moduleName: string;
}) {
  const { user, can } = useAuth();
  if (!user) return null;
  if (can(permission)) return <>{children}</>;
  return <PermissionDenied moduleName={moduleName} roleLabel={roleMeta(user.role).label} />;
}

export function PermissionDenied({ moduleName, roleLabel }: { moduleName: string; roleLabel: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <ShieldAlert className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-foreground">
        {moduleName} is outside your access
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Your role — {roleLabel} — does not include this module. Ask a super administrator to extend
        your access if you need it for your work.
      </p>
      <p className="mt-4 text-xs text-muted-foreground/80">
        Every access request is recorded in the audit log.
      </p>
    </div>
  );
}

function SessionSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Full-screen moment, so it gets the full lockup — height-driven, since
            the mark alone at this width lands about twenty pixels tall. */}
        <Logo className="h-9 animate-pulse sm:h-10" />
        <p className="text-sm text-muted-foreground">Restoring your secure session…</p>
      </div>
    </div>
  );
}

/** Sends signed-in users away from the public auth screens. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <SessionSplash />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export function NotFoundInPortal({ home }: { home: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <h2 className="font-display text-xl font-bold text-foreground">This page has moved</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you were looking for is not part of this portal.
      </p>
      <Link
        to={home}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
