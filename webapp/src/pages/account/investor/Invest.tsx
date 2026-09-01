import { PageHeader } from "@/components/dashboard/PageHeader";
import { InvestmentSection } from "@/pages/account/AccountHome";

/**
 * Real investor Invest — `/account/investor/invest`. Same `InvestmentSection`
 * panel as Overview — the real commit flow is one amount field, not the
 * demo's mandate/portfolio picker, matching the precedent already set by
 * the demo's own Live-data tabs (investor/Invest.tsx) reusing this exact
 * component.
 */
export default function InvestorInvest() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invest" description="Commit capital to PayBridge's lending book." />
      <InvestmentSection />
    </div>
  );
}
