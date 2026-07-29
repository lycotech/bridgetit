import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Building2, ScrollText, ShieldAlert } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { AsyncPanel, LoadingCards } from "@/components/dashboard/states";
import { TrendChart, DonutSplit, ChartTabs, useChartRange, sliceSeries } from "@/components/dashboard/charts";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, relativeTime, shortDate } from "@/lib/platform/format";

export default function OperationsOverviewPage() {
  const range = useChartRange(["3M", "6M", "12M"] as const);

  const overview = useQuery({ queryKey: qk.ops("overview"), queryFn: () => opsApi.overview() });
  const employers = useQuery({ queryKey: qk.ops("employers"), queryFn: () => opsApi.employers() });
  const risk = useQuery({ queryKey: qk.ops("risk"), queryFn: () => opsApi.riskAlerts() });
  const compliance = useQuery({ queryKey: qk.ops("compliance"), queryFn: () => opsApi.complianceCases() });

  const queue = (employers.data ?? []).filter(
    (employer) => employer.applicationStatus !== "Approved" && employer.applicationStatus !== "Rejected",
  );
  const openRisk = (risk.data ?? []).filter((alert) => alert.status === "Open").slice(0, 4);
  const openCases = (compliance.data ?? [])
    .filter((item) => item.status === "Open" || item.status === "In review" || item.status === "Escalated")
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control centre"
        title="Platform operations"
        description="Capital, transactions and oversight across every employer, employee and investor on PayBridge."
        actions={
          <ActionButton to="/operations/transactions" variant="secondary">
            Open transactions
          </ActionButton>
        }
      />

      {overview.isLoading ? (
        <LoadingCards count={4} />
      ) : (
        <StatGrid columns={4}>
          <StatCard
            label="Bridge value today"
            value={naira(overview.data?.bridgeValueToday ?? 0)}
            hint={`${overview.data?.bridgeTransactionsToday ?? 0} transactions`}
            tone="primary"
          />
          <StatCard
            label="Capital deployed"
            value={nairaCompact(overview.data?.deployedCapital ?? 0)}
            hint="Working across all mandates"
            tone="protected"
          />
          <StatCard
            label="Available capital"
            value={nairaCompact(overview.data?.availableCapital ?? 0)}
            hint="Ready to deploy"
          />
          <StatCard
            label="Needs attention"
            value={String((overview.data?.riskAlerts ?? 0) + (overview.data?.complianceAlerts ?? 0))}
            hint={`${overview.data?.failedTransactions ?? 0} failed or reversed transactions`}
            tone="attention"
          />
        </StatGrid>
      )}

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
              <Panel
                title="Bridge volume"
                description="Value bridged month by month across the platform."
                action={<ChartTabs options={range.options} value={range.value} onChange={range.setValue} />}
              >
                <TrendChart data={sliceSeries(data.volume, range.value)} format={nairaCompact} />
              </Panel>

              <Panel title="Where capital is working" description="Deployment by product line.">
                <DonutSplit
                  slices={data.capitalSplit}
                  centerLabel="Under management"
                  centerValue={nairaCompact(
                    data.capitalSplit.reduce((sum, slice) => sum + slice.value, 0),
                  )}
                  format={nairaCompact}
                />
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Panel title="Platform" description="Live counts across the network.">
                <div className="divide-y divide-border/70">
                  <SummaryRow label="Active employers" value={String(data.activeEmployers)} />
                  <SummaryRow label="Active employees" value={data.activeEmployees.toLocaleString("en-NG")} />
                  <SummaryRow label="Approved investors" value={String(data.approvedInvestors)} />
                  <SummaryRow
                    label="Salary Buffer exposure"
                    value={naira(data.salaryBufferExposure)}
                    emphasis
                    tone="primary"
                  />
                  <SummaryRow label="Repayments due" value={naira(data.repaymentsDue)} />
                </div>
              </Panel>

              <Panel
                title="Employer queue"
                description="Applications waiting on an operations decision."
                action={
                  <ActionButton to="/operations/employers" size="sm" variant="ghost">
                    View all
                  </ActionButton>
                }
              >
                {queue.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Every application has been decided.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {queue.slice(0, 4).map((employer) => (
                      <li
                        key={employer.id}
                        className="flex items-center gap-3 rounded-2xl border border-border p-3.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {employer.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {employer.employeeCount.toLocaleString("en-NG")} employees · {employer.industry}
                          </span>
                        </span>
                        <StatusBadge status={employer.applicationStatus} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Next payroll dates" description="Settlement windows to plan capital around.">
                <ul className="space-y-2.5">
                  {(employers.data ?? [])
                    .filter((employer) => employer.applicationStatus === "Approved")
                    .slice(0, 5)
                    .map((employer) => (
                      <li
                        key={employer.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {employer.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {shortDate(employer.nextPayrollDate)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-foreground tnum">
                          {nairaCompact(employer.payrollObligation)}
                        </span>
                      </li>
                    ))}
                </ul>
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel
                title="Open risk alerts"
                description="Exposure and limit signals raised for review."
                action={
                  <ActionButton to="/operations/risk" size="sm" variant="ghost" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Risk
                  </ActionButton>
                }
              >
                {openRisk.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No open alerts.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {openRisk.map((alert) => (
                      <li key={alert.id} className="flex items-start gap-3 rounded-2xl border border-border p-3.5">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                          <ShieldAlert className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground">{alert.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {alert.entity} · {relativeTime(alert.raisedAt)}
                          </span>
                        </span>
                        <RiskPill level={alert.level} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Compliance cases"
                description="KYC, KYB, screening and monitoring work in progress."
                action={
                  <ActionButton to="/operations/compliance" size="sm" variant="ghost" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Compliance
                  </ActionButton>
                }
              >
                {openCases.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No open cases.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {openCases.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-border p-3.5">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                          <ScrollText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground">{item.subject}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.caseType} · due {shortDate(item.dueAt)}
                          </span>
                        </span>
                        <StatusBadge status={item.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <InfoNote tone="attention">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Internal system
              </span>{" "}
              — every action taken here is recorded in the audit log with your name, role and IP address.
            </InfoNote>
          </div>
        )}
      </AsyncPanel>
    </div>
  );
}
