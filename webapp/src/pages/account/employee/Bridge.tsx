import { PageHeader } from "@/components/dashboard/PageHeader";
import { EligibilitySection, BridgeRequestSection } from "@/pages/account/AccountHome";

/** Real employee Bridge — `/account/employee/bridge`. */
export default function EmployeeBridge() {
  return (
    <div className="space-y-6">
      <PageHeader title="Bridge" description="Access a portion of pay you've already earned this cycle." />
      <EligibilitySection />
      <BridgeRequestSection />
    </div>
  );
}
