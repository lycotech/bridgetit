import { PageHeader } from "@/components/dashboard/PageHeader";
import { SavingsSection } from "@/pages/account/AccountHome";

/** Real employee Save — `/account/employee/savings`. */
export default function EmployeeSavings() {
  return (
    <div className="space-y-6">
      <PageHeader title="Save" description="Set money aside from what you've earned." />
      <SavingsSection />
    </div>
  );
}
