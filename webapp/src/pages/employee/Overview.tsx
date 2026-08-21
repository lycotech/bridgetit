import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Copy,
  Gauge,
  HeartPulse,
  LineChart,
  Landmark,
  PiggyBank,
  Sprout,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, ProgressMeter, SegmentedMeter, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingCards } from "@/components/dashboard/states";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira, shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { useAuth } from "@/lib/auth/auth-context";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { SimpleHome } from "@/components/employee/SimpleHome";
import { FirstUseOnboarding } from "@/components/prefs/FirstUseOnboarding";
import { AIAssistWidget } from "@/components/employee/AIAssistWidget";

export default function EmployeeOverviewPage() {
  const employeeId = useAccountId("employee");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs, accountLoading } = usePreferences();
  const overview = useQuery({
    queryKey: qk.employeeOverview(employeeId),
    queryFn: () => employeeApi.overview(employeeId),
  });

  const firstName = (user?.fullName ?? "there").split(" ")[0];

  /* Peeking at the full dashboard is a per-visit choice, not a settings change:
     "Show me everything" reveals it now and leaves the saved preference alone, so
     the simple screen is still there tomorrow. */
  const [showEverything, setShowEverything] = useState(false);

  /* The six first-use questions, once. `onboardingSettled` covers both answering
     and skipping, so nobody is asked twice; `dismissed` only covers the gap
     between pressing Done and the save coming back. This is the first employee
     screen, which is the right place for it — asking before somebody has seen
     what PayBridge is would be asking them to configure a stranger. */
  const [dismissed, setDismissed] = useState(false);
  if (!prefs.onboardingSettled && !dismissed && !accountLoading) {
    return <FirstUseOnboarding onDone={() => setDismissed(true)} />;
  }

  if (prefs.simpleView && !showEverything) {
    return (
      <SimpleHome
        firstName={firstName}
        available={overview.data?.remainingAvailable ?? 0}
        paydayIso={overview.data?.employee.nextPayday ?? new Date().toISOString()}
        onShowEverything={() => setShowEverything(true)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your financial wellbeing"
        title={`Hello ${firstName}`}
        description="Bridge what you have already earned, save towards what is coming, invest what you will not need for a while, and grow as you go. Nothing here is a loan."
        actions={
          <ActionButton icon={<Gauge className="h-4 w-4" />} onClick={() => navigate("/employee/bridge")}>
            Bridge It
          </ActionButton>
        }
      />

      {overview.isLoading ? (
        <LoadingCards />
      ) : (
        <AsyncPanel query={overview}>
          {(data) => (
            <div className="space-y-6">
              <StatGrid>
                <StatCard
                  label="Available to Bridge"
                  value={naira(data.remainingAvailable)}
                  hint="Ready for you right now"
                  tone="success"
                  icon={<Wallet className="h-4 w-4" />}
                />
                <StatCard
                  label="Earned so far"
                  value={naira(data.accrual.accruedNetEarnings)}
                  hint={`${data.monthProgressPct}% of your ${naira(
                    data.accrual.breakdown.netSalary,
                  )} net pay`}
                />
                <StatCard
                  label="Saved"
                  value={naira(data.savingsBalance)}
                  hint="Your cushion between paydays"
                  tone="protected"
                  icon={<Sprout className="h-4 w-4" />}
                />
                <StatCard
                  label="Wellbeing score"
                  value={`${data.wellbeingScore}/100`}
                  hint="Bridge, Save, Invest and Grow together"
                  icon={<HeartPulse className="h-4 w-4" />}
                />
              </StatGrid>

              <Panel
                title="Your PayBridge Account"
                description="Your own PayBridge-issued account number — share it to receive money directly."
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Landmark className="h-5 w-5" />
                  </span>
                  <div className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Bank
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {data.employee.payBridgeAccount.bankName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Account No
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(data.employee.payBridgeAccount.accountNumber);
                          toast.success("Account number copied");
                        }}
                        className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground tnum"
                      >
                        {data.employee.payBridgeAccount.accountNumber}
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Account Name
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {data.employee.payBridgeAccount.accountName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Credit score
                      </p>
                      <Link
                        to="/employee/grow"
                        className="mt-0.5 block text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {data.employee.creditScore}
                      </Link>
                    </div>
                  </div>
                </div>
              </Panel>

              {data.accrual.paused ? (
                <InfoNote tone="attention">
                  <span className="font-semibold">New earned pay is on hold</span> —{" "}
                  {data.accrual.pauseReason ??
                    "your employer is confirming a change to your payroll."}{" "}
                  Anything already bridged is unaffected and still settles on payday.
                </InfoNote>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    pillar: "Bridge" as const,
                    to: "/employee/bridge",
                    icon: <Gauge className="h-4 w-4" />,
                    value: naira(data.remainingAvailable),
                    caption: "Earned pay ready for you today",
                  },
                  {
                    pillar: "Save" as const,
                    to: "/employee/savings",
                    icon: <Sprout className="h-4 w-4" />,
                    value: naira(data.savingsBalance),
                    caption: "Set aside automatically each payday",
                  },
                  {
                    pillar: "Invest" as const,
                    to: "/employee/invest",
                    icon: <LineChart className="h-4 w-4" />,
                    value: naira(data.investedValue),
                    caption: "Professionally managed, suitability first",
                  },
                  {
                    pillar: "Grow" as const,
                    to: "/employee/grow",
                    icon: <HeartPulse className="h-4 w-4" />,
                    value: `${data.wellbeingScore}/100`,
                    caption: "Insights, planning and short lessons",
                  },
                ].map((card) => {
                  const score = data.pillars.find((p) => p.pillar === card.pillar);
                  return (
                    <Link
                      key={card.pillar}
                      to={card.to}
                      className="group rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
                    >
                      <span className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          {card.icon}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </span>
                      <span className="mt-3 block font-display text-sm font-bold text-foreground">
                        {card.pillar}
                      </span>
                      <span className="mt-1 block font-display text-xl font-extrabold text-foreground tnum">
                        {card.value}
                      </span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                        {card.caption}
                      </span>
                      {score ? (
                        <ProgressMeter className="mt-3" value={score.score} tone="primary" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              {data.topRecommendation ? (
                <Panel
                  title="What would help you most"
                  description="Built from your own activity, and shown even when it means less Bridge."
                  action={
                    <Link
                      to="/employee/grow"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      All suggestions
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {data.topRecommendation.pillar}
                    </span>
                    {data.topRecommendation.reducesBridgeUse ? (
                      <span className="rounded-full border border-protected/40 bg-protected/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        Could mean less Bridge
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {data.topRecommendation.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {data.topRecommendation.body}
                  </p>
                  <p className="mt-2 text-xs font-medium text-primary">{data.topRecommendation.impact}</p>
                  <div className="mt-4">
                    <ActionButton to={data.topRecommendation.actionTo} variant="secondary">
                      {data.topRecommendation.actionLabel}
                    </ActionButton>
                  </div>
                </Panel>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <Panel
                  title="Your month so far"
                  description="Earned pay builds each day you work. A portion of it is available to bridge."
                >
                  <ProgressMeter
                    value={data.monthProgressPct}
                    label="Net pay earned this month"
                    right={`${naira(data.accrual.accruedNetEarnings)} of ${naira(
                      data.accrual.breakdown.netSalary,
                    )}`}
                    tone="available"
                  />
                  <div className="mt-6">
                    <SegmentedMeter
                      segments={[
                        {
                          value: data.employee.alreadyBridged,
                          tone: "primary",
                          label: `Bridged ${naira(data.employee.alreadyBridged)}`,
                        },
                        {
                          value: data.remainingAvailable,
                          tone: "available",
                          label: `Still available ${naira(data.remainingAvailable)}`,
                        },
                      ]}
                    />
                  </div>

                  <div className="mt-6 divide-y divide-border/70">
                    <SummaryRow
                      label="Gross salary"
                      value={naira(data.accrual.breakdown.grossEarnings)}
                      tone="muted"
                    />
                    <SummaryRow
                      label="Net salary after deductions"
                      value={naira(data.accrual.breakdown.netSalary)}
                      hint="Everything below is worked out from this, never from gross"
                    />
                    <SummaryRow
                      label={`Earned so far (${data.accrual.daysCompleted} of ${data.accrual.eligibleWorkingDays} days)`}
                      value={naira(data.accrual.accruedNetEarnings)}
                    />
                    <SummaryRow
                      label={`Accessible share (${data.accrual.maxBridgePct}%)`}
                      value={naira(data.accrual.maxAvailableToBridge)}
                      hint="Your employer sets the share of earned pay you can access"
                    />
                    <SummaryRow
                      label="Remaining available"
                      value={naira(data.remainingAvailable)}
                      emphasis
                      tone="primary"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <ActionButton
                      icon={<Gauge className="h-4 w-4" />}
                      onClick={() => navigate("/employee/bridge")}
                    >
                      Bridge It
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={() => navigate("/employee/pay")}>
                      See my pay
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={() => navigate("/employee/transactions")}>
                      View transactions
                    </ActionButton>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Move your Bridge Gauge to choose how much of your earned pay comes to you today.
                  </p>
                </Panel>

                <div className="space-y-6">
                  <Panel
                    title="Payroll continuity"
                    description={`${data.employee.employerName} settles what you bridge directly from payroll.`}
                  >
                    <SummaryRow label="Employer" value={data.employee.employerName} />
                    <SummaryRow
                      label="Payroll settlement"
                      value={longDate(data.employee.nextPayday)}
                      hint={`${data.daysToPayday} days away`}
                    />
                    <SummaryRow label="Already bridged" value={naira(data.employee.alreadyBridged)} />
                    <SummaryRow
                      label="Eligibility"
                      value={data.employee.eligible ? "Active" : "Paused"}
                      tone={data.employee.eligible ? "primary" : "muted"}
                    />
                    {data.employee.eligibilityNote ? (
                      <InfoNote tone="attention" className="mt-3">
                        {data.employee.eligibilityNote}
                      </InfoNote>
                    ) : (
                      <InfoNote tone="primary" className="mt-3">
                        Your employer has enabled access to your earned pay. Charges are always shown before
                        you confirm.
                      </InfoNote>
                    )}
                  </Panel>

                  <Panel
                    title="Save"
                    description="Structured plans that build in the background."
                    action={
                      <Link
                        to="/employee/savings"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Manage
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    }
                  >
                    {data.savings.length === 0 ? (
                      <EmptyState
                        title="No savings plan yet"
                        body="A small share of each payday builds the cushion that makes early access unnecessary."
                        icon={<PiggyBank className="h-5 w-5" />}
                      />
                    ) : (
                      <div className="space-y-4">
                        {data.savings.slice(0, 2).map((goal) => (
                          <ProgressMeter
                            key={goal.id}
                            value={goal.target ? (goal.balance / goal.target) * 100 : 0}
                            label={goal.name}
                            right={`${naira(goal.balance)} of ${naira(goal.target)}`}
                            tone="protected"
                          />
                        ))}
                        <InfoNote>
                          Held and administered by a licensed asset manager. Rates are indicative and shown in
                          line with the approved offering.
                        </InfoNote>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>

              <Panel
                title="Recent Bridge activity"
                action={
                  <Link
                    to="/employee/transactions"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    See all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                }
                bodyClassName="p-0 sm:p-0"
              >
                {data.recentRequests.length === 0 ? (
                  <EmptyState
                    title="Nothing bridged yet"
                    body="When you bridge part of your earned pay it will show here with its fee and settlement date."
                    action={
                      <ActionButton size="sm" onClick={() => navigate("/employee/bridge")}>
                        Bridge It
                      </ActionButton>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.recentRequests.map((request) => (
                      <li key={request.id}>
                        <Link
                          to={`/employee/transactions?ref=${request.reference}`}
                          className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/40 sm:px-5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-display text-base font-bold text-foreground tnum">
                              {naira(request.amount)}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {shortDate(request.createdAt)} · {request.destination} · fee {naira(request.fee)}
                            </span>
                          </span>
                          <StatusBadge status={request.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
        </AsyncPanel>
      )}
      <AIAssistWidget />
    </div>
  );
}
