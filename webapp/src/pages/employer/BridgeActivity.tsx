import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote, SummaryRow, ProgressMeter } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { BarSeries, ChartTabs, sliceSeries, useChartRange } from "@/components/dashboard/charts";
import { LoadingPanel } from "@/components/dashboard/states";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, pct, shortDate } from "@/lib/platform/format";
import type { EmployerSettlementInstruction } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

/**
 * Things PayBridge deliberately withholds from the employer.
 *
 * This list is a promise, so it is worth stating what backs each line. The first
 * three are structural: `employerApi.bridgeActivity` returns one aggregated
 * instruction whose type has no field for a person, and small counts and averages
 * are suppressed below `MIN_DISCLOSABLE_COHORT`. The last two are structural in a
 * stronger sense — there is no employer-facing route for accessibility settings or
 * support tickets anywhere in the backend, so the question cannot be asked.
 */
const WITHHELD = [
  "Which employee has used Bridge",
  "How much any individual has bridged",
  "How often anyone uses Bridge",
  "Reasons for any request",
  "Savings and investment activity",
  "Financial wellbeing scores",
  "Accessibility and language settings",
  "Support requests and conversations",
];

export default function EmployerBridgeActivityPage() {
  const employerId = useAccountId("employer");
  const range = useChartRange(["3M", "6M", "12M"]);

  const activity = useQuery({
    queryKey: qk.employerActivity(employerId),
    queryFn: () => employerApi.bridgeActivity(employerId),
  });

  const summary = activity.data?.summary;
  const settlements = activity.data?.settlements ?? [];

  /*
   * ONE ROW PER PAYROLL CYCLE. There is deliberately no employee column.
   *
   * This table used to list every participating employee by name, with their
   * payroll ID and their exact deduction, sortable by amount and exportable to
   * CSV — sitting immediately below the panel that lists "Which employee has
   * used Bridge" and "How much any individual has bridged" as withheld.
   *
   * Deleting the name column would not have been enough. A column of individual
   * amounts beside a staff roster is re-identifiable, and the old per-line
   * reference embedded the payroll ID (`PB-STL-EMP0042-JAN`), so it named the
   * person anyway. The aggregation happens in the service layer instead, where
   * the returned type has no field for a person at all.
   */
  const columns: Column<EmployerSettlementInstruction>[] = [
    {
      key: "period",
      header: "Payroll period",
      render: (row) => <CellStack primary={row.period} secondary={`Payday ${shortDate(row.payday)}`} />,
      sortValue: (row) => row.period,
    },
    {
      key: "description",
      header: "Description",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{row.description}</span>,
      sortValue: (row) => row.description,
    },
    {
      key: "reference",
      header: "Reference",
      hideBelow: "sm",
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.reference}</span>,
      sortValue: (row) => row.reference,
    },
    {
      key: "included",
      header: "Employees included",
      align: "right",
      hideBelow: "lg",
      render: (row) =>
        row.employeesIncluded === undefined ? (
          <span className="text-xs text-muted-foreground">Withheld — fewer than 5</span>
        ) : (
          <span className="tnum">{row.employeesIncluded}</span>
        ),
    },
    {
      key: "amount",
      header: "Total to deduct",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.totalToDeduct)}</span>,
      sortValue: (row) => row.totalToDeduct,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Earned pay"
        title="Company view and payroll settlements"
        description="Company-level take-up, and the exact lines payroll deducts on payday. Nothing traceable to how an individual uses their pay."
      />

      <StatGrid columns={4}>
        <StatCard label="Accessed this cycle" value={naira(summary?.volumeThisCycle ?? 0)} tone="primary" />
        <StatCard
          label="Payroll deduction"
          value={naira(summary?.deductionThisCycle ?? 0)}
          hint="Recovered on payday"
        />
        <StatCard
          label="Take-up"
          value={pct(summary?.adoptionPct ?? 0)}
          hint={`${summary?.enrolledEmployees ?? 0} of ${summary?.activeEmployees ?? 0} enrolled`}
        />
        <StatCard label="Cost to your company" value="₦0" tone="protected" hint="Employees pay a flat service fee" />
      </StatGrid>

      <Panel
        title="Company volume"
        description="Total earned pay accessed across your organisation, month by month."
        action={<ChartTabs options={range.options} value={range.value} onChange={range.setValue} />}
      >
        {activity.isLoading ? (
          <LoadingPanel />
        ) : (
          <BarSeries data={sliceSeries(summary?.volumeSeries ?? [], range.value)} format={nairaCompact} />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="This cycle at a glance" description="Aggregates only — never a single person's activity.">
          <div className="divide-y divide-border/70">
            <SummaryRow label="Period" value={summary?.period ?? "—"} />
            {/* A withheld figure must not render as "0" — that reads as "nobody
                used Bridge", which is a different and false statement. Both rows
                say in words that the number exists and is being held back. */}
            <SummaryRow
              label="Employees supported"
              value={summary?.employeesSupported === undefined ? "Fewer than 5" : String(summary.employeesSupported)}
              hint={
                summary?.employeesSupported === undefined
                  ? "Withheld: an exact count this small would identify the people in it."
                  : "Count only. Names and amounts stay private."
              }
            />
            <SummaryRow
              label="Average deduction"
              value={summary?.averageDeduction === undefined ? "Not shown" : naira(summary.averageDeduction)}
              hint={
                summary?.averageDeduction === undefined
                  ? "An average over fewer than 5 people is a lookup, not a statistic."
                  : undefined
              }
            />
            <SummaryRow
              label="Share of net earned pay used"
              value={pct(summary?.utilisationOfEarnedPct ?? 0)}
              hint="Across the whole company"
            />
          </div>
          <div className="mt-5">
            <ProgressMeter
              value={summary?.settlementProgressPct ?? 0}
              label="Settlement progress"
              right={pct(summary?.settlementProgressPct ?? 0)}
              tone="available"
            />
          </div>
        </Panel>

        <Panel
          title="Wellbeing participation"
          description="Anonymous, company-wide participation. No individual scores, ever."
        >
          <div className="divide-y divide-border/70">
            <SummaryRow label="Saving through PayBridge" value={pct(summary?.savingsParticipationPct ?? 0)} />
            <SummaryRow label="Using wellbeing tools" value={pct(summary?.wellbeingParticipationPct ?? 0)} />
            <SummaryRow
              label="Average wellbeing score"
              value={`${summary?.averageWellbeingScore ?? 0} / 100`}
              hint="Company average across participating employees"
            />
          </div>
          <InfoNote className="mt-5">
            Participation is reported as a company aggregate so you can see the impact without seeing anyone's
            personal position.
          </InfoNote>
        </Panel>
      </div>

      <Panel
        title="What payroll deducts on payday"
        description="One instruction per payroll cycle: a single amount to deduct and remit."
        bodyClassName="p-0"
      >
        <DataTable
          rows={settlements}
          columns={columns}
          getRowId={(row) => row.reference}
          caption="One settlement instruction per payroll period, with the total to deduct and remit. There is no per-employee breakdown."
          search={(row) => `${row.period} ${row.reference}`}
          searchPlaceholder="Search by period or reference"
          filters={[
            {
              key: "status",
              label: "Status",
              options: ["Scheduled", "Deferred", "Settled"],
              accessor: (row) => row.status,
            },
          ]}
          isLoading={activity.isLoading}
          isError={activity.isError}
          onRetry={() => void activity.refetch()}
          emptyTitle="Nothing to deduct this cycle"
          emptyBody="A settlement instruction appears here once your team has accessed earned pay."
          initialSort={{ key: "period", direction: "desc" }}
          exportName="paybridge-settlement-instruction"
          exportRow={(row) => ({
            Period: row.period,
            Payday: shortDate(row.payday),
            Description: row.description,
            Reference: row.reference,
            "Total to deduct": row.totalToDeduct,
            "Employees included": row.employeesIncluded ?? "Fewer than 5 — withheld",
            Status: row.status,
          })}
        />
      </Panel>

      <Panel
        title="What you do not see"
        description="PayBridge withholds this by design — it is not a setting that can be switched on."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {WITHHELD.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </Panel>

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Why you deduct one figure and not a list
        </span>{" "}
        — payroll needs the correct total, not the names behind it. PayBridge holds the per-person allocation and
        reconciles it against your single remittance. If a figure would identify one person, we withhold it instead
        of rounding it: counts and averages for fewer than five employees are not shown at all.
      </InfoNote>
    </div>
  );
}
