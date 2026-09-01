import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Real Employer Portal "Earned pay & settlements" — `/employer-portal/
 * bridge-activity`. Unlike the other placeholders on this portal, this one
 * is not "not built yet" — it's deliberately never shown to an employer.
 * Individual Bridge draw activity is staff-only (visible at PayBridge's
 * `/admin/risk`); an employer sees only the aggregate `Utilisation` figure
 * their payroll settlement is based on, same privacy boundary as the
 * employee's own draw history staying private from their employer.
 */
export default function EmployerBridgeActivity() {
  return (
    <div className="space-y-6">
      <PageHeader title="Earned pay & settlements" description="What your payroll settlement is based on." />
      <Panel tone="info" icon={<ShieldAlert className="h-5 w-5 text-primary" />} title="Not shown to employers, by design">
        <p>
          Individual employees' Bridge draws are private — PayBridge does not show your company which employees
          used Access, how often, or for how much. Once repayment settlement exists, you'll see the aggregate
          amount your payroll owes for the cycle, never a per-employee breakdown.
        </p>
      </Panel>
    </div>
  );
}
