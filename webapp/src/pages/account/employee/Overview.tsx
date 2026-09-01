import { PageHeader } from "@/components/dashboard/PageHeader";
import { useSession } from "@/lib/account/session";
import { EligibilitySection, BridgeRequestSection, CreditScoreSection } from "@/pages/account/AccountHome";

/**
 * Real employee Overview — `/account/employee`. First page of the rebuilt
 * real dashboard (see the plan's build order): reuses the same section
 * components `AccountHome.tsx` used to render inline, now under the new
 * multi-page shell. Pay, Save, Grow, Refer, Transactions, Profile and
 * Support move out of here into their own pages in later steps — for now
 * their nav items point at `ComingSoon`.
 */
export default function EmployeeOverview() {
  const { data: session } = useSession();
  const firstName = session?.user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verified account"
        title={`Welcome, ${firstName}`}
        description="Your identity is confirmed and your PayBridge account is open."
      />
      <EligibilitySection />
      <BridgeRequestSection />
      <CreditScoreSection />
    </div>
  );
}
