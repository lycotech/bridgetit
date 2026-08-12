import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { useAccountId } from "@/lib/platform/use-account";

const FEATURES = [
  "Employee records",
  "Payroll schedules",
  "Salary structure",
  "Bonuses and deductions",
  "PAYE and pension configuration",
  "Payroll approval",
  "Salary payment",
  "PayBridge Access settlement",
  "Employee payslips",
  "Reconciliation",
  "Reports",
];

export default function PayBridgePayrollPage() {
  const employerId = useAccountId("employer");
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: qk.employerOverview(employerId),
    queryFn: () => employerApi.overview(employerId),
  });
  const currentModel = overview.data?.employer.payrollModel;

  const setModel = useMutation({
    mutationFn: (model: "existing_payroll" | "paybridge_payroll") => employerApi.setPayrollModel(employerId, model),
    onSuccess: (_employer, model) => {
      void queryClient.invalidateQueries({ queryKey: qk.employerOverview(employerId) });
      toast.success(
        model === "paybridge_payroll" ? "PayBridge Payroll set up" : "Switched back to your existing payroll",
      );
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll Setup · Option B"
        title="Want everything in one place?"
        description="Employers can choose to run payroll through PayBridge rather than only using PayBridge Access."
        actions={
          <ActionButton to="/employer" variant="ghost">
            Back to overview
          </ActionButton>
        }
      />

      <InfoNote tone="attention">
        <span className="font-semibold">Optional.</span> Employers are not required to choose this
        — Option A (keep your existing payroll) remains fully supported and is the recommended
        starting point.
      </InfoNote>

      <Panel
        title="PayBridge Payroll"
        description="A full-service alternative for employers who do not want to maintain a separate payroll system at all."
      >
        <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-sm text-foreground">
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {currentModel === "paybridge_payroll" ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                <Check className="h-3.5 w-3.5" aria-hidden />
                PayBridge Payroll is set up for this company
              </span>
              <ActionButton
                variant="secondary"
                loading={setModel.isPending}
                onClick={() => setModel.mutate("existing_payroll")}
              >
                Switch back to existing payroll
              </ActionButton>
            </>
          ) : (
            <ActionButton loading={setModel.isPending} onClick={() => setModel.mutate("paybridge_payroll")}>
              Set Up PayBridge Payroll
            </ActionButton>
          )}
        </div>
      </Panel>
    </div>
  );
}
