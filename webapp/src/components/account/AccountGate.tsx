import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { GATE_ROUTE, useSession } from "@/lib/account/session";
import type { SessionGate } from "../../../../backend/src/types";

/**
 * Route guards for the real customer area.
 *
 * These redirect; they do not authorise. The server decides the gate and denies
 * the data — a customer who edits their way past this component reaches an API
 * that answers 403. This exists so people land on the screen that matches their
 * state instead of an empty one.
 */

function Waiting() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

/**
 * Requires a session at one of `allow`. Anything else is sent to the screen its
 * own gate belongs to, so there is exactly one way to be on a given page.
 */
export function RequireGate({ allow, children }: { allow: SessionGate[]; children: ReactNode }) {
  const { data, isPending } = useSession();
  const location = useLocation();

  if (isPending || !data) return <Waiting />;
  if (data.gate === "anonymous") {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (!allow.includes(data.gate)) return <Navigate to={GATE_ROUTE[data.gate]} replace />;
  return <>{children}</>;
}

/** For /register and /sign-in: a signed-in customer is moved along, not shown a second sign-in form. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending || !data) return <Waiting />;
  if (data.gate !== "anonymous") return <Navigate to={GATE_ROUTE[data.gate]} replace />;
  return <>{children}</>;
}
