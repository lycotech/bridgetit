import { PageHeader } from "@/components/dashboard/PageHeader";
import { PayrollModelPanel } from "@/components/employer-portal/PayrollModelPanel";
import { useEmployerSession } from "@/lib/employer/session";

/** Real Employer Portal PayBridge Payroll (optional) — `/employer-portal/payroll-model`. */
export default function EmployerPayrollModel() {
  const session = useEmployerSession();
  const isAdmin = session.data?.role === "employer_admin";

  return (
    <div className="space-y-6">
      <PageHeader title="PayBridge Payroll (optional)" description="Choose how PayBridge fits into your existing payroll process." />
      <PayrollModelPanel authenticated={session.data?.authenticated ?? false} isAdmin={isAdmin} />
    </div>
  );
}
