import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, ProgressMeter } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira, shortDate } from "@/lib/platform/format";
import { RECONCILIATION_STATUSES } from "@/lib/platform/models";
import type { Repayment } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

export default function EmployerRepaymentsPage() {
  const employerId = useAccountId("employer");
  const [active, setActive] = useState<Repayment | null>(null);

  const repayments = useQuery({
    queryKey: qk.employerRepayments(employerId),
    queryFn: () => employerApi.repayments(employerId),
  });

  const rows = repayments.data ?? [];
  const due = rows.filter((row) => row.status !== "Paid");
  const totalDue = due.reduce((sum, row) => sum + (row.amountDue - row.amountPaid), 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.amountPaid, 0);
  const overdue = rows.filter((row) => row.status === "Overdue");
  const nextDue = [...due].sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];

  const columns: Column<Repayment>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={row.sourceType} />,
      sortValue: (row) => row.reference,
    },
    {
      key: "due",
      header: "Amount due",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.amountDue)}</span>,
      sortValue: (row) => row.amountDue,
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      hideBelow: "sm",
      render: (row) => <span className="tnum">{naira(row.amountPaid)}</span>,
      sortValue: (row) => row.amountPaid,
    },
    {
      key: "dueDate",
      header: "Due date",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.dueDate)}</span>,
      sortValue: (row) => row.dueDate,
    },
    {
      key: "reconciliation",
      header: "Reconciliation",
      hideBelow: "lg",
      render: (row) => <StatusBadge status={row.reconciliation} />,
      sortValue: (row) => row.reconciliation,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Repayments"
        title="Settlement and reconciliation"
        description="What settles back to PayBridge each cycle, and how it reconciles against payroll."
      />

      <StatGrid columns={4}>
        <StatCard label="Outstanding" value={naira(totalDue)} tone={overdue.length ? "attention" : "primary"} />
        <StatCard label="Settled to date" value={naira(totalPaid)} tone="protected" />
        <StatCard
          label="Next settlement"
          value={nextDue ? shortDate(nextDue.dueDate) : "—"}
          hint={nextDue ? naira(nextDue.amountDue - nextDue.amountPaid) : "Nothing scheduled"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard label="Overdue items" value={String(overdue.length)} tone={overdue.length ? "attention" : "protected"} />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each settlement cycle, with the amount due back to PayBridge and its reconciliation state"
        search={(row) => `${row.reference} ${row.sourceType} ${row.status}`}
        searchPlaceholder="Search by reference or source"
        filters={[
          {
            key: "status",
            label: "Status",
            options: ["Scheduled", "Part paid", "Paid", "Overdue"],
            accessor: (row) => row.status,
          },
          {
            key: "source",
            label: "Source",
            options: ["Salary Buffer", "Payroll settlement"],
            accessor: (row) => row.sourceType,
          },
          {
            key: "reconciliation",
            label: "Reconciliation",
            options: RECONCILIATION_STATUSES,
            accessor: (row) => row.reconciliation,
          },
        ]}
        dateAccessor={(row) => row.dueDate}
        isLoading={repayments.isLoading}
        isError={repayments.isError}
        onRetry={() => void repayments.refetch()}
        emptyTitle="Nothing to settle"
        emptyBody="Repayments appear here as your team bridges earned pay or you take a Salary Buffer."
        onRowClick={(row) => setActive(row)}
        initialSort={{ key: "dueDate", direction: "asc" }}
        exportName="paybridge-repayments"
        exportRow={(row) => ({
          Reference: row.reference,
          Source: row.sourceType,
          "Amount due": row.amountDue,
          Paid: row.amountPaid,
          "Due date": shortDate(row.dueDate),
          Status: row.status,
          Reconciliation: row.reconciliation,
        })}
      />

      <Panel title="How settlement works" description="One deduction, one settlement, no surprises.">
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">1.</span> Employees bridge part of the salary they
            have already earned. PayBridge funds it.
          </li>
          <li>
            <span className="font-semibold text-foreground">2.</span> On payday, you deduct exactly the amounts
            shown under Bridge activity.
          </li>
          <li>
            <span className="font-semibold text-foreground">3.</span> You settle one consolidated amount to
            PayBridge, and we reconcile it line by line.
          </li>
        </ol>
        <InfoNote className="mt-4">
          If a line does not match, we investigate it before asking you for anything. Nothing is ever taken
          automatically from your account.
        </InfoNote>
      </Panel>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.reference ?? "Repayment"}
        description={active?.sourceType}
        footer={
          <ActionButton variant="secondary" onClick={() => setActive(null)}>
            Close
          </ActionButton>
        }
      >
        {active ? (
          <div className="space-y-5">
            <ProgressMeter
              value={active.amountDue ? (active.amountPaid / active.amountDue) * 100 : 0}
              label="Settled"
              right={`${naira(active.amountPaid)} of ${naira(active.amountDue)}`}
              tone="protected"
            />
            <div className="divide-y divide-border/70">
              <SummaryRow label="Source" value={active.sourceType} />
              <SummaryRow label="Counterparty" value={active.counterparty} />
              <SummaryRow label="Amount due" value={naira(active.amountDue)} />
              <SummaryRow label="Amount paid" value={naira(active.amountPaid)} />
              <SummaryRow
                label="Outstanding"
                value={naira(Math.max(0, active.amountDue - active.amountPaid))}
                emphasis
                tone="primary"
              />
              <SummaryRow label="Due date" value={longDate(active.dueDate)} />
              <SummaryRow label="Status" value={<StatusBadge status={active.status} />} />
              <SummaryRow label="Reconciliation" value={<StatusBadge status={active.reconciliation} />} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
