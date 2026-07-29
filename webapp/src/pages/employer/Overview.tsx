import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, ProgressMeter, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { AsyncPanel } from "@/components/dashboard/states";
import { TrendChart, ChartTabs, useChartRange, sliceSeries } from "@/components/dashboard/charts";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { employerApi, payrollApi, qk } from "@/lib/platform/mock-service";
import { CycleTimeline } from "@/components/payroll/CycleTimeline";
import { longDate, naira, nairaCompact, pct, shortDate, daysBetween } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";

export default function EmployerOverviewPage() {
  const employerId = useAccountId("employer");
  const range = useChartRange(["3M", "6M", "12M"]);

  const overview = useQuery({
    queryKey: qk.employerOverview(employerId),
    queryFn: () => employerApi.overview(employerId),
  });
  const centre = useQuery({
    queryKey: qk.payrollCommandCentre(employerId),
    queryFn: () => payrollApi.commandCentre(employerId),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employer"
        title="Payroll continuity at a glance"
        description="Where this month's payroll stands, and how your people are using their earned pay."
        actions={
          <>
            <ActionButton to="/employer/payroll" variant="secondary">
              Payroll command centre
            </ActionButton>
            <ActionButton to="/employer/salary-buffer">Request Salary Buffer</ActionButton>
          </>
        }
      />

      <AsyncPanel query={overview}>
        {(data) => {
          const employer = data.employer;
          const fundedPct = employer.payrollObligation
            ? (employer.payrollFundsConfirmed / employer.payrollObligation) * 100
            : 0;
          const daysToPayroll = daysBetween(new Date().toISOString(), employer.nextPayrollDate);

          return (
            <div className="space-y-6">
              <StatGrid columns={4}>
                <StatCard
                  label="Payroll obligation"
                  value={naira(employer.payrollObligation)}
                  hint={`${employer.activeEmployees} active employees`}
                  icon={<Building2 className="h-4 w-4" />}
                />
                <StatCard
                  label="Funds confirmed"
                  value={naira(employer.payrollFundsConfirmed)}
                  hint={`${pct(fundedPct)} of obligation`}
                  tone="protected"
                />
                <StatCard
                  label="Projected shortfall"
                  value={naira(data.projectedShortfall)}
                  hint={data.projectedShortfall > 0 ? "Cover this with a Salary Buffer" : "Fully covered"}
                  tone={data.projectedShortfall > 0 ? "attention" : "protected"}
                />
                <StatCard
                  label="Next payroll"
                  value={shortDate(employer.nextPayrollDate)}
                  hint={`${daysToPayroll} days away`}
                  icon={<CalendarClock className="h-4 w-4" />}
                />
              </StatGrid>

              {centre.data ? (
                <Panel
                  title={`${centre.data.period.label} payroll cycle`}
                  description="Where this cycle stands. Confirm exceptions and the rest runs automatically."
                  action={
                    <ActionButton to="/employer/payroll/exceptions" size="sm" variant="ghost">
                      {centre.data.health.exceptionsOpen} to review
                    </ActionButton>
                  }
                >
                  <CycleTimeline stage={centre.data.period.stage} />
                  <div className="mt-5 grid gap-4 sm:grid-cols-4">
                    <SummaryRow label="Net payroll" value={naira(centre.data.period.netPayroll)} />
                    <SummaryRow
                      label="Accruing normally"
                      value={`${centre.data.health.accruingNormally} of ${centre.data.health.totalEmployees}`}
                    />
                    <SummaryRow label="Critical exceptions" value={String(centre.data.health.criticalExceptions)} />
                    <SummaryRow label="Payroll data" value={<StatusBadge status={centre.data.health.syncStatus} />} />
                  </div>
                </Panel>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
                <Panel
                  title="Earned pay accessed"
                  description="Total earned pay accessed by your employees each month."
                  action={<ChartTabs options={range.options} value={range.value} onChange={range.setValue} />}
                >
                  <TrendChart data={sliceSeries(data.bridgeActivity, range.value)} format={nairaCompact} />
                  <Divider />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Employees on PayBridge</p>
                      <p className="mt-1 text-lg font-semibold text-foreground tnum">
                        {employer.employeesUsingBridge}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Take-up rate</p>
                      <p className="mt-1 text-lg font-semibold text-foreground tnum">
                        {pct((employer.employeesUsingBridge / Math.max(1, employer.activeEmployees)) * 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cost to you</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">₦0</p>
                    </div>
                  </div>
                  <InfoNote className="mt-4">
                    You see the amounts needed to run payroll — never why an employee bridged or what they spend.
                  </InfoNote>
                </Panel>

                <div className="space-y-6">
                  <Panel title="This month's payroll" description="Confirm funds early to keep everything calm.">
                    <ProgressMeter
                      value={fundedPct}
                      label="Funds confirmed"
                      right={`${naira(employer.payrollFundsConfirmed)} of ${naira(employer.payrollObligation)}`}
                      tone="protected"
                    />
                    <div className="mt-4 divide-y divide-border/70">
                      <SummaryRow label="Payroll obligation" value={naira(employer.payrollObligation)} />
                      <SummaryRow label="Funds confirmed" value={naira(employer.payrollFundsConfirmed)} />
                      <SummaryRow
                        label="Shortfall"
                        value={naira(data.projectedShortfall)}
                        emphasis
                        tone="primary"
                      />
                      <SummaryRow label="Approved Salary Buffer" value={naira(data.approvedBuffer)} />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <ActionButton to="/employer/salary-buffer" size="sm">
                        Salary Buffer
                      </ActionButton>
                      <ActionButton to="/employer/payroll/runs" size="sm" variant="secondary">
                        Upload payroll
                      </ActionButton>
                    </div>
                  </Panel>

                  <Panel title="Facility" description="Your approved Bridge limit across all employees.">
                    <ProgressMeter
                      value={data.utilisationPct}
                      label="Limit used"
                      right={`${naira(employer.utilisedLimit)} of ${naira(employer.approvedLimit)}`}
                    />
                    <div className="mt-4 divide-y divide-border/70">
                      <SummaryRow label="Account status" value={<StatusBadge status={employer.applicationStatus} />} />
                      <SummaryRow label="Risk band" value={<RiskPill level={employer.riskLevel} />} />
                      <SummaryRow label="Payroll day" value={`Day ${employer.payrollDay} of each month`} />
                    </div>
                  </Panel>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Panel
                  title="Next settlement"
                  description="What comes back to PayBridge from this payroll cycle."
                  action={
                    <ActionButton to="/employer/repayments" size="sm" variant="ghost">
                      View all
                    </ActionButton>
                  }
                >
                  <ul className="space-y-2.5">
                    {data.upcomingRepayments.slice(0, 4).map((repayment) => (
                      <li
                        key={repayment.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {repayment.sourceType}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Due {longDate(repayment.dueDate)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-semibold text-foreground tnum">
                            {naira(repayment.amountDue)}
                          </span>
                          <StatusBadge status={repayment.status} className="mt-1" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title="Your people" description="Eligibility is yours to control at any time.">
                  <StatGrid columns={2}>
                    <StatCard
                      label="Employees on payroll"
                      value={String(employer.employeeCount)}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Using Bridge"
                      value={String(employer.employeesUsingBridge)}
                      tone="primary"
                      icon={<TrendingUp className="h-4 w-4" />}
                    />
                  </StatGrid>
                  <InfoNote tone="primary" className="mt-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Employee privacy
                    </span>{" "}
                    — reasons for a request and personal spending are never shared with you.
                  </InfoNote>
                  <div className="mt-4">
                    <ActionButton to="/employer/employees" size="sm" variant="secondary">
                      Manage employees
                    </ActionButton>
                  </div>
                </Panel>
              </div>
            </div>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
