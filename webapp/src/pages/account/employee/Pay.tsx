import { PageHeader } from "@/components/dashboard/PageHeader";
import { SalaryAccountSection, PayBridgeAccountSection } from "@/pages/account/AccountHome";

/** Real employee Pay — `/account/employee/pay`. Salary-account routing and the PayBridge Account itself. */
export default function EmployeePay() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Pay" description="Where your salary lands, and your PayBridge Account." />
      <SalaryAccountSection />
      <PayBridgeAccountSection />
    </div>
  );
}
