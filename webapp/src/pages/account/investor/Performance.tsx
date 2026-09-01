import { PieChart } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Real investor Performance — `/account/investor/performance`. No real
 * yield/return model exists anywhere in this system (see AGENTS.md, §2
 * Investments) — inventing one would be fabricating a financial promise, so
 * this stays an honest placeholder rather than reusing the demo's invented
 * chart.
 */
export default function InvestorPerformance() {
  return (
    <div className="space-y-6">
      <PageHeader title="Performance" description="Track how your committed capital is performing over time." />
      <Panel tone="info" icon={<PieChart className="h-5 w-5 text-primary" />} title="Not available yet">
        <p>
          PayBridge doesn't yet calculate a real return or yield figure for committed capital, so there's nothing
          honest to chart here today. This page will show real performance once that model exists.
        </p>
      </Panel>
    </div>
  );
}
