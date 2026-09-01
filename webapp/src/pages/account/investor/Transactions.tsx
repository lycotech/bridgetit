import { PageHeader } from "@/components/dashboard/PageHeader";
import { InvestmentSection } from "@/pages/account/AccountHome";

/**
 * Real investor Transactions — `/account/investor/transactions`. The real
 * commitment list inside `InvestmentSection` IS the real transaction
 * history — no separate real ledger exists, same reasoning already
 * documented for the demo's investor Transactions Live tab (AGENTS.md §11).
 */
export default function InvestorTransactions() {
  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Every commitment and withdrawal on your account." />
      <InvestmentSection />
    </div>
  );
}
