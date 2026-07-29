import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ConfidentialWatermark } from "@/components/demo/ConfidentialWatermark";
import { useDemoSession, sendDemoBeacon } from "@/lib/demo-access";
import { useNoIndex } from "@/lib/use-noindex";

/**
 * The gate in front of the entire demonstration environment: the four portals
 * and the sign-in screens that lead to them.
 *
 * Nothing inside is reachable without a demo session, and the environment is
 * not discoverable — no navigation entry, no footer link, no sitemap entry, no
 * robots-indexable page. An uninvited visitor who guesses the URL is sent to
 * the gate page, which tells them nothing about what is behind it.
 *
 * The demo was NOT deleted. It was made private.
 */
export function RequireDemoAccess({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isPending, isError } = useDemoSession();
  useNoIndex();

  const granted = data?.access === "granted";

  // "Record who accessed it and when" — one row per screen actually viewed,
  // not just per login, so a demo walkthrough is auditable after the fact.
  useEffect(() => {
    if (granted) sendDemoBeacon(location.pathname);
  }, [granted, location.pathname]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking access…</span>
      </div>
    );
  }

  if (isError || !granted) {
    // `next` is a pathname from the router, never a user-supplied absolute URL,
    // so it cannot be used to bounce someone off-site after they authenticate.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/private-demo?next=${next}`} replace />;
  }

  return (
    <>
      <DemoNotice viewer={data?.viewer ?? null} />
      <ConfidentialWatermark viewer={data?.viewer ?? null} />
      {children}
    </>
  );
}

/**
 * The visible confidential-demo notice. Deliberately at the very top of the
 * document and always present: a viewer must never be a single scroll away
 * from forgetting that the numbers on screen are fictional.
 */
function DemoNotice({ viewer }: { viewer: string | null }) {
  return (
    <div className="relative z-[70] border-b border-gold/40 bg-gold/10 px-4 py-2 text-center text-[11px] font-medium leading-snug text-foreground/85 sm:text-xs">
      <span className="font-semibold">Confidential PayBridge demonstration.</span> Shared for
      evaluation only. All figures, names and accounts shown are fictional sample data.
      {viewer ? <span className="hidden sm:inline"> Access recorded for {viewer}.</span> : null}
    </div>
  );
}
