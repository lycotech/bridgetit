import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote, SummaryRow, ProgressMeter, SegmentedMeter } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AsyncPanel } from "@/components/dashboard/states";
import { TrendChart } from "@/components/dashboard/charts";
import { CycleTimeline } from "@/components/payroll/CycleTimeline";
import { payrollApi, qk } from "@/lib/platform/mock-service";
import { dateTime, longDate, naira, nairaCompact, pct } from "@/lib/platform/format";
import { useAccountId, useActorName } from "@/lib/platform/use-account";
import { useAuth } from "@/lib/auth/auth-context";

export default function PayrollCommandCentrePage() {
  const employerId = useAccountId("employer");
  const actor = useActorName();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canApprove = can("employer.payroll.approve") || can("employer.settings.manage");
  const canReviewExceptions = can("employer.payroll.exceptions.manage");

  const centre = useQuery({
    queryKey: qk.payrollCommandCentre(employerId),
    queryFn: () => payrollApi.commandCentre(employerId),
  });

  const advance = useMutation({
    mutationFn: () => payrollApi.advanceStage(employerId, actor),
    onSuccess: (period) => {
      void queryClient.invalidateQueries({ queryKey: qk.payrollCommandCentre(employerId) });
      toast.success(`Payroll moved to ${period.stage}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PayBridge Payroll"
        title="Payroll command centre"
        description="One view of the cycle: where it is, what needs your attention, and what happens next."
        actions={
          <>
            {canReviewExceptions ? (
              <ActionButton to="/employer/payroll/exceptions" variant="secondary">
                Review exceptions
              </ActionButton>
            ) : null}
            {canApprove ? (
              <ActionButton
                onClick={() => advance.mutate()}
                loading={advance.isPending}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Approve and process payroll
              </ActionButton>
            ) : null}
          </>
        }
      />

      <AsyncPanel query={centre}>
        {(data) => (
          <div className="space-y-6">
            <StatGrid columns={4}>
              <StatCard
                label="Net payroll"
                value={naira(data.period.netPayroll)}
                tone="primary"
                hint={`${data.period.headcount} employees · gross ${nairaCompact(data.period.grossPayroll)}`}
              />
              <StatCard
                label="Funding gap"
                value={naira(data.fundingGap)}
                tone={data.fundingGap > 0 ? "attention" : "protected"}
                hint={
                  data.fundingGap > 0
                    ? `Buffer available ${nairaCompact(data.bufferAvailable)}`
                    : "Fully funded"
                }
              />
              <StatCard
                label="Open exceptions"
                value={String(data.health.exceptionsOpen)}
                tone={data.health.criticalExceptions ? "attention" : "default"}
                hint={`${data.health.criticalExceptions} critical`}
              />
              <StatCard
                label="PayBridge settlement"
                value={naira(data.settlementObligation)}
                hint="Deducted on payday"
              />
            </StatGrid>

            <Panel
              title={`${data.period.label} cycle`}
              description="Every stage from payroll open to close."
              action={<StatusBadge status={data.period.status} />}
            >
              <CycleTimeline stage={data.period.stage} />
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <SummaryRow label="Payday" value={longDate(data.period.payday)} />
                <SummaryRow
                  label="Working days"
                  value={`${data.period.elapsedWorkingDays} of ${data.period.workingDays} complete`}
                />
                <SummaryRow label="Approval" value={<StatusBadge status={data.period.approvalStatus} />} />
              </div>
            </Panel>

            {data.health.criticalExceptions > 0 ? (
              <InfoNote tone="attention">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {data.health.criticalExceptions} critical exception
                  {data.health.criticalExceptions > 1 ? "s" : ""} need confirming
                </span>{" "}
                — new earned-pay availability is paused for those employees until you resolve them. Anything
                already sent to an employee is unaffected and still settles as planned.{" "}
                <Link to="/employer/payroll/exceptions" className="font-semibold underline underline-offset-2">
                  Open the exceptions inbox
                </Link>
                .
              </InfoNote>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <Panel title="Net payroll trend" description="Confirmed net pay across recent cycles.">
                <TrendChart data={data.netPayrollTrend} format={nairaCompact} />
              </Panel>

              <Panel
                title="Payroll data health"
                description="How your payroll data is arriving, and what it means for accrual."
                action={<StatusBadge status={data.health.syncStatus} />}
              >
                <SegmentedMeter
                  segments={[
                    { value: data.health.accruingNormally, tone: "primary", label: "Accruing" },
                    { value: data.health.exceptionsOpen, tone: "gold", label: "Exceptions" },
                    { value: data.health.accrualsPaused, tone: "muted", label: "Paused" },
                  ]}
                />
                <div className="mt-4 divide-y divide-border/70">
                  <SummaryRow
                    label="Accruing normally"
                    value={`${data.health.accruingNormally} of ${data.health.totalEmployees}`}
                    emphasis
                    tone="primary"
                  />
                  <SummaryRow label="Exceptions open" value={String(data.health.exceptionsOpen)} />
                  <SummaryRow label="Accrual paused" value={String(data.health.accrualsPaused)} />
                  <SummaryRow
                    label="Last sync"
                    value={data.health.lastSyncAt ? dateTime(data.health.lastSyncAt) : "Not yet"}
                  />
                  <SummaryRow
                    label="Next sync"
                    value={data.health.nextSyncAt ? dateTime(data.health.nextSyncAt) : "On demand"}
                  />
                </div>
                {data.health.fallbackApplied ? (
                  <InfoNote tone="attention" className="mt-4">
                    <span className="font-semibold">Fallback in effect</span> — {data.health.fallbackApplied}.
                    PayBridge never estimates earnings indefinitely.
                  </InfoNote>
                ) : null}
                <div className="mt-4">
                  <ActionButton to="/employer/payroll/integrations" variant="secondary" size="sm" fullWidth>
                    Manage payroll connections
                  </ActionButton>
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Funding position" description="What must be in place before disbursement.">
                <ProgressMeter
                  value={data.period.netPayroll ? (data.period.fundsConfirmed / data.period.netPayroll) * 100 : 0}
                  label="Payroll funded"
                  right={`${naira(data.period.fundsConfirmed)} of ${naira(data.period.netPayroll)}`}
                  tone="available"
                />
                <div className="mt-4 divide-y divide-border/70">
                  <SummaryRow label="Statutory liability" value={naira(data.period.statutoryLiability)} />
                  <SummaryRow label="Total deductions" value={naira(data.period.totalDeductions)} />
                  <SummaryRow
                    label="PayBridge settlement"
                    value={naira(data.settlementObligation)}
                    hint="Recovered from employees on payday, not a company cost"
                  />
                  <SummaryRow label="Statutory remittance" value={<StatusBadge status={data.statutoryStatus} />} />
                  <SummaryRow label="Disbursement" value={<StatusBadge status={data.disbursementStatus} />} />
                </div>
                {data.fundingGap > 0 ? (
                  <div className="mt-4">
                    <ActionButton to="/employer/salary-buffer" variant="secondary" size="sm" fullWidth>
                      Cover the gap with Salary Buffer
                    </ActionButton>
                  </div>
                ) : null}
              </Panel>

              <Panel
                title="Your approved payroll rules"
                description="Approved once at onboarding. Employees are never re-approved week by week."
                action={<span className="text-xs text-muted-foreground">Version {data.policy.version}</span>}
              >
                <div className="divide-y divide-border/70">
                  <SummaryRow label="Payroll calendar" value={data.policy.payrollCalendar} />
                  <SummaryRow label="Payday rule" value={data.policy.paydayRule} />
                  <SummaryRow label="Net method" value={data.policy.netMethod} />
                  <SummaryRow
                    label="Maximum bridgeable"
                    value={pct(data.policy.maxBridgePct)}
                    hint="Of net pay earned so far"
                  />
                  <SummaryRow label="Grace period" value={`${data.policy.gracePeriodDays} days`} />
                  <SummaryRow label="If data is late" value={data.policy.fallbackRule} />
                  <SummaryRow
                    label="Critical exceptions"
                    value={data.policy.autoPauseOnCritical ? "Auto-pause new availability" : "Manual review"}
                  />
                </div>
                <div className="mt-4">
                  <ActionButton to="/employer/settings" variant="ghost" size="sm">
                    Change payroll rules
                  </ActionButton>
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickLink
                to="/employer/payroll/exceptions"
                title="Exceptions inbox"
                body="Confirm what changed. Nothing unchanged needs your approval."
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <QuickLink
                to="/employer/payroll/runs"
                title="Payroll files and funding"
                body="Upload, validate and confirm funds for the cycle."
                icon={<CalendarClock className="h-4 w-4" />}
              />
              <QuickLink
                to="/employer/payroll/integrations"
                title="Integrations"
                body="Connectors, SFTP, API and manual entry."
                icon={<ArrowRight className="h-4 w-4" />}
              />
              <QuickLink
                to="/employer/bridge-activity"
                title="Settlements"
                body="The deduction schedule for payday."
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>

            <InfoNote tone="primary">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Exception-based confirmation
              </span>{" "}
              — you confirm employment and payroll changes only. PayBridge never asks you to approve an
              individual's earned-pay request, and never asks you to re-approve earnings that have not changed.
            </InfoNote>
          </div>
        )}
      </AsyncPanel>
    </div>
  );
}

function QuickLink({
  to,
  title,
  body,
  icon,
}: {
  to: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </Link>
  );
}
