import { Check } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";
import type { PayrollModel } from "@/lib/platform/models";

const OPTION_A_BULLETS = [
  "No second payroll",
  "No manual employee advance processing",
  "No need to move your entire workforce onto PayBridge",
  "Only participating employees update their salary account",
  "Existing payroll software remains your system of record",
  "PayBridge handles settlement through the participating employee's PayBridge Salary Account",
  "Remaining salary is designed to move onward to the employee's nominated personal bank account",
];

const OPTION_B_BULLETS = [
  "Payroll administration inside PayBridge",
  "Employee records",
  "Salary processing",
  "Deductions",
  "PayBridge Access settlement",
  "Payment instructions",
  "Reconciliation",
  "Reporting",
];

function OptionBullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * The dashboard card that answers "will PayBridge create another payroll
 * process?" before an employer has to ask it. Two options, side by side, so
 * the answer ("no — pick either") is visual, not something buried in copy.
 */
export function PayrollSetupCard({ payrollModel }: { payrollModel: PayrollModel }) {
  return (
    <Panel title="Payroll Setup" description="Choose how PayBridge fits into your existing payroll process.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div
          className={cn(
            "flex flex-col rounded-2xl border p-5",
            payrollModel === "existing_payroll" ? "border-primary/50 bg-primary/[0.04]" : "border-border bg-card",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Recommended
            </span>
            {payrollModel === "existing_payroll" ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Current</span>
            ) : null}
          </div>
          <h3 className="mt-3 font-display text-xl font-bold leading-snug text-foreground">
            Keep your payroll. Add PayBridge.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Continue using your current payroll system exactly as you do today. Employees who
            activate PayBridge Access request a change of salary account to their dedicated
            PayBridge Salary Account.
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            Your HR and payroll teams still run payroll once.
          </p>
          <OptionBullets items={OPTION_A_BULLETS} />
          <div className="mt-5 flex flex-1 flex-col justify-end gap-2.5">
            <ActionButton to="/employer/salary-account-requests">Use Existing Payroll</ActionButton>
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lowest operational change
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col rounded-2xl border p-5",
            payrollModel === "paybridge_payroll" ? "border-primary/50 bg-primary/[0.04]" : "border-border bg-card",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Full-service option
            </span>
            {payrollModel === "paybridge_payroll" ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Current</span>
            ) : null}
          </div>
          <h3 className="mt-3 font-display text-xl font-bold leading-snug text-foreground">
            Run payroll through PayBridge.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Employers who prefer a fully integrated experience can use PayBridge Payroll for
            employee records, payroll preparation, salary payment, PayBridge settlement and
            reconciliation.
          </p>
          <OptionBullets items={OPTION_B_BULLETS} />
          <div className="mt-5 flex flex-1 flex-col justify-end gap-2.5">
            <ActionButton to="/employer/paybridge-payroll" variant="secondary">
              Explore PayBridge Payroll
            </ActionButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}
