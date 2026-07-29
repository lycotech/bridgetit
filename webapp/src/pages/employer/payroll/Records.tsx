import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, InfoNote, SummaryRow } from "@/components/dashboard/Panel";
import { Modal } from "@/components/dashboard/Modal";
import { payrollApi, qk } from "@/lib/platform/mock-service";
import { computeNetEarnings } from "@/lib/platform/net-earnings";
import { naira, shortDate } from "@/lib/platform/format";
import {
  EMPLOYMENT_STATUSES,
  PAYROLL_APPROVAL_STATUSES,
  PAYROLL_DATA_SOURCES,
} from "@/lib/platform/models";
import type { PayrollEmployeeRecord } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

export default function PayrollRecordsPage() {
  const employerId = useAccountId("employer");
  const [active, setActive] = useState<PayrollEmployeeRecord | null>(null);

  const records = useQuery({
    queryKey: qk.payrollRecords(employerId),
    queryFn: () => payrollApi.records(employerId),
  });
  const pack = useQuery({
    queryKey: ["payroll", "compliance-pack"],
    queryFn: () => payrollApi.compliancePack(),
  });

  const rows = records.data ?? [];
  const totals = rows.reduce(
    (acc, record) => {
      const b = computeNetEarnings(record);
      return {
        gross: acc.gross + b.grossEarnings,
        statutory: acc.statutory + b.statutory,
        net: acc.net + Math.max(0, b.netSalary),
      };
    },
    { gross: 0, statutory: 0, net: 0 },
  );
  const variances = rows.filter((record) => computeNetEarnings(record).netVariance !== 0).length;

  const columns: Column<PayrollEmployeeRecord>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => <CellStack primary={row.fullName} secondary={row.payrollId} />,
      sortValue: (row) => row.fullName,
    },
    {
      key: "status",
      header: "Employment",
      hideBelow: "md",
      render: (row) => <StatusBadge status={row.employmentStatus} />,
      sortValue: (row) => row.employmentStatus,
    },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      hideBelow: "sm",
      render: (row) => <span className="tnum text-muted-foreground">{naira(computeNetEarnings(row).grossEarnings)}</span>,
      sortValue: (row) => computeNetEarnings(row).grossEarnings,
    },
    {
      key: "deductions",
      header: "Deductions",
      align: "right",
      hideBelow: "lg",
      render: (row) => {
        const b = computeNetEarnings(row);
        return <span className="tnum text-muted-foreground">{naira(b.grossEarnings - b.netSalary)}</span>;
      },
      sortValue: (row) => {
        const b = computeNetEarnings(row);
        return b.grossEarnings - b.netSalary;
      },
    },
    {
      key: "net",
      header: "Net salary",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(computeNetEarnings(row).netSalary)}</span>,
      sortValue: (row) => computeNetEarnings(row).netSalary,
    },
    {
      key: "days",
      header: "Days worked",
      align: "right",
      hideBelow: "lg",
      render: (row) => (
        <span className="tnum text-muted-foreground">
          {row.daysWorked} / {row.workingDaysInPeriod - row.unpaidLeaveDays}
        </span>
      ),
      sortValue: (row) => row.daysWorked,
    },
    {
      key: "approval",
      header: "Confirmation",
      render: (row) => <StatusBadge status={row.approvalStatus} />,
      sortValue: (row) => row.approvalStatus,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PayBridge Payroll"
        title="Payroll records"
        description="Gross to net for every employee this period, with the exact deduction lines behind each figure."
      />

      <StatGrid columns={4}>
        <StatCard label="Records" value={String(rows.length)} icon={<Calculator className="h-4 w-4" />} />
        <StatCard label="Gross earnings" value={naira(totals.gross)} />
        <StatCard label="Confirmed net" value={naira(totals.net)} tone="primary" />
        <StatCard
          label="Net variances"
          value={String(variances)}
          tone={variances ? "attention" : "protected"}
          hint="Calculated net differs from the net payroll reported"
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="One row for each employee in this payroll period, with pay, status and any change flagged"
        search={(row) => `${row.fullName} ${row.payrollId} ${row.department}`}
        searchPlaceholder="Search by name or payroll ID"
        filters={[
          {
            key: "employment",
            label: "Employment",
            options: [...EMPLOYMENT_STATUSES],
            accessor: (row) => row.employmentStatus,
          },
          {
            key: "approval",
            label: "Confirmation",
            options: [...PAYROLL_APPROVAL_STATUSES],
            accessor: (row) => row.approvalStatus,
          },
          {
            key: "source",
            label: "Source",
            options: [...PAYROLL_DATA_SOURCES],
            accessor: (row) => row.dataSource,
          },
        ]}
        isLoading={records.isLoading}
        isError={records.isError}
        onRetry={() => void records.refetch()}
        emptyTitle="No payroll records"
        emptyBody="Connect a payroll source or upload a file to populate this period."
        onRowClick={(row) => setActive(row)}
        initialSort={{ key: "net", direction: "desc" }}
        exportName="paybridge-payroll-records"
        exportRow={(row) => {
          const b = computeNetEarnings(row);
          return {
            "Payroll ID": row.payrollId,
            Employee: row.fullName,
            Employment: row.employmentStatus,
            Gross: b.grossEarnings,
            Statutory: b.statutory,
            Recurring: b.recurring,
            Variable: b.variable,
            Obligations: b.obligations,
            Net: b.netSalary,
            "Working days": row.workingDaysInPeriod,
            "Unpaid leave days": row.unpaidLeaveDays,
            "Days worked": row.daysWorked,
            Source: row.dataSource,
            Confirmation: row.approvalStatus,
          };
        }}
      />

      {pack.data ? (
        <Panel
          title="Statutory compliance pack"
          description="Country rules are versioned configuration, updated centrally when the law changes."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Country" value="Nigeria" />
              <SummaryRow label="Pack version" value={pack.data.version} />
              <SummaryRow label="PAYE (effective)" value={`${pack.data.payeEffectivePct}%`} />
            </div>
            <div className="divide-y divide-border/70">
              <SummaryRow label="Pension (employee)" value={`${pack.data.pensionEmployeePct}%`} />
              <SummaryRow label="Pension (employer)" value={`${pack.data.pensionEmployerPct}%`} />
              <SummaryRow label="NHF" value={`${pack.data.nhfPct}%`} />
              <SummaryRow label="Remittance deadline" value={`Day ${pack.data.remittanceDeadlineDay} of the month`} />
            </div>
          </div>
        </Panel>
      ) : null}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.fullName ?? "Payroll record"}
        description={active ? `${active.payrollId} · ${active.jobTitle}` : undefined}
        size="wide"
      >
        {active ? <RecordBreakdown record={active} /> : null}
      </Modal>
    </div>
  );
}

function RecordBreakdown({ record }: { record: PayrollEmployeeRecord }) {
  const b = computeNetEarnings(record);
  return (
    <div className="space-y-5">
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

      <Panel title="Deduction lines" className="border-0 bg-transparent p-0">
        <div className="divide-y divide-border/70">
          {b.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{line.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {line.kind} · {line.source} · effective {shortDate(line.effectiveDate)}
                  {line.approved ? "" : " · awaiting approval"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tnum text-foreground">{naira(line.amount)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="divide-y divide-border/70">
        <SummaryRow label="Working days in period" value={String(record.workingDaysInPeriod)} />
        <SummaryRow label="Unpaid leave days" value={String(record.unpaidLeaveDays)} />
        <SummaryRow label="Days worked" value={String(record.daysWorked)} />
        <SummaryRow label="Payday" value={shortDate(record.payday)} />
        <SummaryRow label="Salary effective from" value={shortDate(record.salaryEffectiveDate)} />
        <SummaryRow label="Data source" value={record.dataSource} />
        <SummaryRow label="Last updated" value={shortDate(record.lastUpdatedAt)} />
        <SummaryRow label="Confirmation" value={<StatusBadge status={record.approvalStatus} />} />
        {record.adjustmentReason ? (
          <SummaryRow label="Adjustment reason" value={record.adjustmentReason} />
        ) : null}
      </div>

      {b.netVariance !== 0 ? (
        <InfoNote tone="attention">
          Calculated net differs from the reported net by {naira(Math.abs(b.netVariance))}. PayBridge raises this
          as an exception rather than silently overriding your payroll.
        </InfoNote>
      ) : null}

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          Earned pay accrues from net
        </span>{" "}
        — {naira(b.netSalary)} spread across {Math.max(0, record.workingDaysInPeriod - record.unpaidLeaveDays)}{" "}
        eligible working days. Gross salary is never used to work out what an employee can access.
      </InfoNote>
    </div>
  );
}
