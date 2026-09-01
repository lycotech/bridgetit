import { PageHeader } from "@/components/dashboard/PageHeader";
import { InvestmentSection } from "@/pages/account/AccountHome";

/**
 * Real investor Withdrawals — `/account/investor/withdrawals`. The real
 * "Withdraw" action per commitment inside `InvestmentSection` IS the real
 * withdrawal flow — there is no separate real withdrawal request/review
 * step to build here, same reasoning already documented for the demo's
 * investor Withdrawals Live tab (AGENTS.md §11).
 */
export default function InvestorWithdrawals() {
  return (
    <div className="space-y-6">
      <PageHeader title="Withdrawals" description="Withdraw from your committed capital." />
      <InvestmentSection />
    </div>
  );
}
