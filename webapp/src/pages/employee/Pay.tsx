import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Coins, PauseCircle, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, ProgressMeter, Divider } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AsyncPanel } from "@/components/dashboard/states";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira, pct, shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";

export default function EmployeePayPage() {
  const employeeId = useAccountId("employee");

  const pay = useQuery({
    queryKey: qk.employeePay(employeeId),
    queryFn: () => employeeApi.pay(employeeId),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Pay"
        title="Your pay, worked out in full"
        description="Everything behind your salary this period — what you have earned so far, what comes out on payday, and what lands in your account."
        actions={
          <ActionButton to="/employee/bridge" variant="secondary">
            Bridge earned pay
          </ActionButton>
        }
      />

      <AsyncPanel query={pay}>
        {(data) => {
          const b = data.accrual.breakdown;
          const eligibleDays = data.accrual.eligibleWorkingDays;
          const progress = eligibleDays ? (data.accrual.daysCompleted / eligibleDays) * 100 : 0;

          return (
            <div className="space-y-6">
              {data.accrual.paused ? (
                <InfoNote tone="attention">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <PauseCircle className="h-3.5 w-3.5" />
                    New earned pay is on hold
                  </span>{" "}
                  — {data.accrual.pauseReason ?? "your employer is confirming a change to your payroll."} Any
                  Bridge you have already received is unaffected and still settles as planned.
                </InfoNote>
              ) : null}

              <StatGrid columns={4}>
                <StatCard
                  label="Net salary this period"
                  value={naira(b.netSalary)}
                  hint={`Gross ${naira(b.grossEarnings)} less deductions`}
                  icon={<Coins className="h-4 w-4" />}
                />
                <StatCard
                  label="Earned so far"
                  value={naira(data.accrual.accruedNetEarnings)}
                  hint={`${data.accrual.daysCompleted} of ${eligibleDays} working days`}
                  tone="primary"
                />
                <StatCard
                  label="Available to bridge"
                  value={naira(data.accrual.availableToBridge)}
                  hint={`Up to ${pct(data.accrual.maxBridgePct, 0)} of what you have earned`}
                  tone={data.accrual.paused ? "attention" : "protected"}
                />
                <StatCard
                  label="Expected on payday"
                  value={naira(data.expectedTakeHome)}
                  hint={longDate(data.accrual.payday)}
                  icon={<Wallet className="h-4 w-4" />}
                />
              </StatGrid>

              <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                <Panel
                  title="How your pay is worked out"
                  description={`${data.period.label} · ${data.record.jobTitle}`}
                  action={<StatusBadge status={data.record.employmentStatus} />}
                >
                  <div className="divide-y divide-border/70">
                    <SummaryRow label="Gross salary" value={naira(b.gross)} />
                    {b.overtime ? <SummaryRow label="Overtime" value={naira(b.overtime)} /> : null}
                    {b.bonuses ? <SummaryRow label="Bonuses" value={naira(b.bonuses)} /> : null}
                    <SummaryRow label="Gross earnings" value={naira(b.grossEarnings)} emphasis />
                    <SummaryRow label="Statutory deductions" value={`− ${naira(b.statutory)}`} />
                    <SummaryRow label="Recurring deductions" value={`− ${naira(b.recurring)}`} />
                    <SummaryRow label="Approved variable deductions" value={`− ${naira(b.variable)}`} />
                    <SummaryRow label="Existing obligations" value={`− ${naira(b.obligations)}`} />
                    <SummaryRow label="Net salary" value={naira(b.netSalary)} emphasis tone="primary" />
                  </div>

                  <Divider className="my-4" />
                  <p className="mb-2.5 text-sm font-semibold text-foreground">Every deduction line</p>
                  <div className="divide-y divide-border/70">
                    {b.lines.map((line) => (
                      <div key={line.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{line.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {line.kind} · from {shortDate(line.effectiveDate)}
                            {line.approved ? "" : " · not yet confirmed"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tnum text-foreground">
                          {naira(line.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <div className="space-y-4">
                  <Panel
                    title="What you have earned so far"
                    description="Your earned pay builds up each working day, from your net salary."
                  >
                    <ProgressMeter
                      value={progress}
                      label={`${data.accrual.daysCompleted} of ${eligibleDays} working days`}
                      right={pct(progress, 0)}
                      tone="primary"
                    />
                    <div className="mt-4 divide-y divide-border/70">
                      <SummaryRow
                        label="Daily earned rate"
                        value={naira(data.accrual.netDailyEarnings)}
                        hint={`${naira(b.netSalary)} ÷ ${eligibleDays} eligible working days`}
                      />
                      <SummaryRow
                        label="Earned to date"
                        value={naira(data.accrual.accruedNetEarnings)}
                        hint={`${naira(data.accrual.netDailyEarnings)} × ${data.accrual.daysCompleted} days`}
                        emphasis
                      />
                      <SummaryRow
                        label={`Accessible share (${pct(data.accrual.maxBridgePct, 0)})`}
                        value={naira(data.accrual.maxAvailableToBridge)}
                      />
                      <SummaryRow label="Already bridged" value={`− ${naira(data.accrual.alreadyBridged)}`} />
                      <SummaryRow
                        label="Available now"
                        value={naira(data.accrual.availableToBridge)}
                        emphasis
                        tone="primary"
                      />
                    </div>
                    {data.record.unpaidLeaveDays > 0 ? (
                      <InfoNote className="mt-4">
                        {data.record.unpaidLeaveDays} unpaid leave day
                        {data.record.unpaidLeaveDays > 1 ? "s" : ""} in this period do not accrue earned pay.
                      </InfoNote>
                    ) : null}
                  </Panel>

                  <Panel
                    title="Payday"
                    description={`Settlement on ${longDate(data.accrual.payday)}`}
                    action={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
                  >
                    {data.settlements.length ? (
                      <div className="mb-3 divide-y divide-border/70">
                        {data.settlements.map((line) => (
                          <div key={line.reference} className="flex items-start justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                Bridge {naira(line.bridged)}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {line.reference} · fee {naira(line.fee)}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tnum text-foreground">
                              {naira(line.settlementAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-sm text-muted-foreground">
                        Nothing to settle this period. Your full net salary is on its way.
                      </p>
                    )}
                    <div className="divide-y divide-border/70">
                      <SummaryRow label="Net salary" value={naira(b.netSalary)} />
                      <SummaryRow label="PayBridge settlement" value={`− ${naira(data.settlementTotal)}`} />
                      <SummaryRow
                        label="Expected in your account"
                        value={naira(data.expectedTakeHome)}
                        emphasis
                        tone="primary"
                      />
                    </div>
                  </Panel>
                </div>
              </div>

              <Panel
                title="Changes to your pay"
                description="Anything your employer is confirming, and what it means for you."
              >
                {data.changes.length ? (
                  <div className="divide-y divide-border/70">
                    {data.changes.map((change) => (
                      <div key={change.reference} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{change.type}</p>
                          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                            {change.message}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Effective {shortDate(change.effectiveDate)} · {change.reference}
                          </p>
                        </div>
                        <StatusBadge status={change.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing has changed this period. Your pay is being calculated exactly as agreed.
                  </p>
                )}
              </Panel>

              <InfoNote tone="primary">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  What your employer sees
                </span>{" "}
                — your employer confirms payroll changes and the total amount to deduct on payday. They never
                see how often you bridge, what you spend it on, or your savings and investments.
              </InfoNote>
            </div>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
