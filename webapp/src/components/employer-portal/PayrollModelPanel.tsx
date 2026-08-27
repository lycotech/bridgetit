import { Check } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { usePayrollModel, useUpdatePayrollModel } from "@/lib/employer/payroll";
import type { PayrollModel } from "../../../../backend/src/types";

const OPTION_A_BULLETS = [
  "No second payroll",
  "No manual employee advance processing",
  "No need to move your entire workforce onto PayBridge",
  "Only participating employees update their salary account",
  "Existing payroll software remains your system of record",
];

const OPTION_B_FEATURES = [
  "Employee records",
  "Payroll schedules",
  "Salary processing",
  "Deductions",
  "PayBridge Access settlement",
  "Reconciliation",
];

/**
 * Real counterpart of the demo-only mock "PayrollSetupCard" (AGENTS.md §9).
 * Lets an employer choose how PayBridge fits into their payroll — keep their
 * own payroll and use PayBridge Salary Accounts for participating employees
 * (recommended), or run payroll fully through PayBridge. Admin-only to
 * change; any role can see the current choice.
 */
export function PayrollModelPanel({ authenticated, isAdmin }: { authenticated: boolean; isAdmin: boolean }) {
  const model = usePayrollModel(authenticated);
  const update = useUpdatePayrollModel();

  const current = model.data?.payrollModel;

  function choose(next: PayrollModel) {
    if (next === current || update.isPending) return;
    update.mutate(next);
  }

  return (
    <Panel
      title="Payroll Setup"
      description="Choose how PayBridge fits into your existing payroll process."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={`rounded-2xl border p-4 ${
            current === "existing_payroll" ? "border-primary/60 bg-primary/[0.06]" : "border-border bg-card/60"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Recommended
            </span>
            {current === "existing_payroll" ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Current</span>
            ) : null}
          </div>
          <h3 className="mt-3 font-display text-base font-bold text-foreground">Keep your payroll. Add PayBridge.</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Continue using your current payroll system exactly as you do today. Employees who activate PayBridge
            Access request a change of salary account to their dedicated PayBridge Salary Account.
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">Your HR and payroll teams still run payroll once.</p>
          <ul className="mt-3 space-y-1.5">
            {OPTION_A_BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {b}
              </li>
            ))}
          </ul>
          {isAdmin && current !== "existing_payroll" ? (
            <ActionButton
              size="sm"
              className="mt-4"
              loading={update.isPending}
              onClick={() => choose("existing_payroll")}
            >
              Switch back to existing payroll
            </ActionButton>
          ) : null}
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            current === "paybridge_payroll" ? "border-primary/60 bg-primary/[0.06]" : "border-border bg-card/60"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Full-service option
            </span>
            {current === "paybridge_payroll" ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Current</span>
            ) : null}
          </div>
          <h3 className="mt-3 font-display text-base font-bold text-foreground">Run payroll through PayBridge.</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Employers who prefer a fully integrated experience can use PayBridge Payroll for employee records,
            payroll preparation, salary payment, PayBridge settlement and reconciliation.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {OPTION_B_FEATURES.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {b}
              </li>
            ))}
          </ul>
          {isAdmin && current !== "paybridge_payroll" ? (
            <ActionButton
              variant="secondary"
              size="sm"
              className="mt-4"
              loading={update.isPending}
              onClick={() => choose("paybridge_payroll")}
            >
              Set Up PayBridge Payroll
            </ActionButton>
          ) : null}
        </div>
      </div>
      {update.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {update.error instanceof Error ? update.error.message : "That could not be saved."}
        </p>
      ) : null}
    </Panel>
  );
}
