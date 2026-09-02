import { Link } from "react-router-dom";
import { Gauge, Gift, HeartPulse, Sprout, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { naira } from "@/lib/platform/format";
import { useEligibility, useMyReferrals, useSavingsGoals, useSession } from "@/lib/account/session";
import { PayBridgeAccountSection, CreditScoreSection } from "@/pages/account/AccountHome";

const QUICK_LINKS = [
  { to: "/account/employee/bridge", label: "Bridge", note: "Access pay you've already earned", icon: Gauge },
  { to: "/account/employee/pay", label: "My Pay", note: "Salary account and destination", icon: Wallet },
  { to: "/account/employee/savings", label: "Save", note: "Set money aside", icon: Sprout },
  { to: "/account/employee/grow", label: "Learn", note: "Your PayBridge Score", icon: HeartPulse },
  { to: "/account/employee/refer", label: "Refer & Earn", note: "Invite a colleague", icon: Gift },
];

/**
 * Real employee Overview — `/account/employee`. A summary landing page,
 * matching the demo's Overview role: real stat tiles + the PayBridge
 * Account front and center, with each feature's own page one tap away.
 */
export default function EmployeeOverview() {
  const { data: session } = useSession();
  const eligibility = useEligibility(true);
  const savings = useSavingsGoals(true);
  const referrals = useMyReferrals(true);
  const firstName = session?.user?.fullName?.split(" ")[0] ?? "there";

  const available = eligibility.data?.earnedWageEstimate ?? 0;
  const saved = (savings.data?.items ?? []).reduce((sum, g) => sum + g.balance, 0);
  const referralEarnings = referrals.data?.totalEarned ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verified account"
        title={`Welcome, ${firstName}`}
        description="Your identity is confirmed and your PayBridge account is open."
      />

      <StatGrid columns={3}>
        <StatCard label="Available to Bridge" value={naira(available)} hint="Ready right now" icon={<Gauge className="h-4 w-4" />} tone="primary" />
        <StatCard label="Saved" value={naira(saved)} hint="Your cushion between paydays" icon={<Sprout className="h-4 w-4" />} tone="success" />
        <StatCard label="Referral earnings" value={naira(referralEarnings)} hint="From colleagues you've invited" icon={<Gift className="h-4 w-4" />} tone="protected" />
      </StatGrid>

      <PayBridgeAccountSection />
      <CreditScoreSection />

      <div className="grid gap-3 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
          >
            <link.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{link.label}</span>
              <span className="block text-xs text-muted-foreground">{link.note}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
