import { CalendarClock, Coins, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, ProgressMeter } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { naira } from "@/lib/platform/format";
import { useEligibility } from "@/lib/account/session";
import { SalaryAccountSection } from "@/pages/account/AccountHome";

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Real employee Pay — `/account/employee/pay`. Real stat grid + breakdown,
 * built from the same PayrollRecord the demo's fictional version invents
 * "every deduction line" from — the real system only has the aggregate
 * gross/deductions/allowances/bonus/net fields uploaded on the payroll
 * cycle, not itemised lines, so the breakdown here stops where the real
 * data stops rather than inventing line items.
 */
export default function EmployeePay() {
  const eligibility = useEligibility(true);
  const data = eligibility.data;

  if (!data || data.grossPay === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Pay" description="Where your salary lands, and what you've earned this cycle." />
        <SalaryAccountSection />
        <InfoNote>No payroll record has been uploaded for you yet — this page fills in once your employer's first cycle covering you lands.</InfoNote>
      </div>
    );
  }

  const periodStart = data.currentPeriodStart ? new Date(data.currentPeriodStart) : null;
  const payday = data.expectedPayDate ? new Date(data.expectedPayDate) : null;
  const now = new Date();
  const progress =
    periodStart && payday && payday.getTime() > periodStart.getTime()
      ? Math.min(100, Math.max(0, ((now.getTime() - periodStart.getTime()) / (payday.getTime() - periodStart.getTime())) * 100))
      : 0;

  const available = data.earnedWageEstimate ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Pay"
        description="Where your salary lands, and what you've earned this cycle."
        actions={
          <ActionButton to="/account/employee/bridge" variant="secondary">
            Bridge earned pay
          </ActionButton>
        }
      />

      <StatGrid columns={3}>
        <StatCard label="Net salary this cycle" value={naira(data.netPay ?? data.grossPay)} icon={<Coins className="h-4 w-4" />} />
        <StatCard label="Available to Bridge" value={naira(available)} hint="Ready right now" tone="primary" icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Payday"
          value={payday ? shortDate(payday) : "—"}
          hint={periodStart ? `Cycle started ${shortDate(periodStart)}` : undefined}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <Panel title="How your pay is worked out" description="From your most recent uploaded payroll record.">
          <div className="divide-y divide-border/70">
            <SummaryRow label="Gross pay" value={naira(data.grossPay)} />
            {data.allowances ? <SummaryRow label="Allowances" value={naira(data.allowances)} /> : null}
            {data.bonus ? <SummaryRow label="Bonus" value={naira(data.bonus)} /> : null}
            {data.deductions ? <SummaryRow label="Deductions" value={`− ${naira(data.deductions)}`} /> : null}
            <SummaryRow label="Net pay" value={naira(data.netPay ?? data.grossPay)} emphasis tone="primary" />
          </div>
        </Panel>

        <Panel title="Your cycle so far" description={periodStart && payday ? `${shortDate(periodStart)} to ${shortDate(payday)}` : undefined}>
          <ProgressMeter value={progress} label="Time elapsed this cycle" right={`${Math.round(progress)}%`} tone="primary" />
          <div className="mt-4 divide-y divide-border/70">
            <SummaryRow label="Earned so far" value={naira(available)} emphasis />
          </div>
        </Panel>
      </div>

      <SalaryAccountSection />

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          What your employer sees
        </span>{" "}
        — your employer confirms payroll and the roster you're on. They never see how often you bridge or your
        savings and investments.
      </InfoNote>
    </div>
  );
}
