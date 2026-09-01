import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Real employee Invest — `/account/employee/invest`. Unlike the other
 * "not available yet" placeholders, this one has an accurate, permanent
 * reason: `/api/investments/*` is investor-only by design
 * (backend/src/routes/investments.ts) — an employee account isn't merely
 * waiting on a feature, investing genuinely isn't part of the employee
 * product today.
 */
export default function EmployeeInvest() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invest" description="Investing is part of the capital-partner (investor) account type." />
      <Panel tone="info" icon={<TrendingUp className="h-5 w-5 text-primary" />} title="Not part of your account type">
        <p>
          PayBridge Investments is a capital-partner feature today, separate from an employee account. If you'd like
          to explore that side of PayBridge, our team can talk you through what a capital-partner account involves.
        </p>
      </Panel>
    </div>
  );
}
