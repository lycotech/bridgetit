import { PageHeader } from "@/components/dashboard/PageHeader";
import { useSession } from "@/lib/account/session";
import { InvestmentSection, CreditScoreSection } from "@/pages/account/AccountHome";

/**
 * Real investor Overview — `/account/investor`. First page of the rebuilt
 * real investor dashboard. `InvestmentSection` is the same component the
 * mock demo's investor Live-data tabs already reuse (`investor/Overview.tsx`
 * etc.) — this is simply its real, non-demo home.
 */
export default function InvestorOverview() {
  const { data: session } = useSession();
  const firstName = session?.user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verified account"
        title={`Welcome, ${firstName}`}
        description="Your identity is confirmed and your PayBridge account is open."
      />
      <InvestmentSection />
      <CreditScoreSection />
    </div>
  );
}
