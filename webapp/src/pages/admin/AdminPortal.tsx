import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PortalShell } from "@/components/admin/portal/PortalShell";
import { AdminOnboarding } from "@/pages/admin/AdminOnboarding";
import { useAdminSession } from "@/lib/admin/portal-session";

/**
 * The gate in front of every administrator screen.
 *
 * Three decisions, in this order, and the order is the point:
 *
 *   1. Not signed in            → /admin/login
 *   2. Signed in, setup pending → the onboarding wizard, and nothing else
 *   3. Signed in and set up     → the portal
 *
 * Step 2 is not politeness. The server refuses every portal endpoint with
 * ONBOARDING_REQUIRED until the password is changed, MFA is enrolled, a recovery
 * address is confirmed and the policy is accepted — so an administrator who got
 * past this gate early would see a shell full of failed requests. The client
 * mirrors the server's rule so the experience matches the enforcement.
 *
 * `outstanding` comes from the session response, which is re-read from the
 * AdminUser row on the server. It is never inferred here: a client-side guess
 * about what is "done" is exactly the state that goes stale.
 */
export default function AdminPortal() {
  const session = useAdminSession();

  // First load only. Refetches keep the last session on screen rather than
  // flashing the whole portal back to a spinner every thirty seconds.
  if (session.isLoading && !session.data) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your session…
      </div>
    );
  }

  if (!session.data?.authenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (session.data.outstanding.length > 0) {
    return <AdminOnboarding session={session.data} />;
  }

  return <PortalShell session={session.data} />;
}
