import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, SegmentedMeter, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal, ConfirmDialog } from "@/components/dashboard/Modal";
import { SelectField } from "@/components/dashboard/forms";
import { AsyncPanel } from "@/components/dashboard/states";
import { ChartTabs } from "@/components/dashboard/charts";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, shortDate } from "@/lib/platform/format";
import { BUFFER_STATUSES } from "@/lib/platform/models";
import type { BufferStatus, BridgeRequest, Repayment, SalaryBufferRequest } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

const VIEWS = ["Salary Buffer", "Bridge queue", "Repayments"] as const;

export default function OperationsFundingPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [view, setView] = useState<string>(VIEWS[0]);
  const [selected, setSelected] = useState<SalaryBufferRequest | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<BufferStatus>("Funded");

  const funding = useQuery({ queryKey: qk.ops("funding"), queryFn: () => opsApi.funding() });

  const update = useMutation({
    mutationFn: () => opsApi.setBufferStatus(selected?.reference ?? "", nextStatus, actor),
    onSuccess: (buffer) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("funding") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("overview") });
      setSelected(buffer);
      setStatusOpen(false);
      toast.success(`${buffer.reference} set to ${nextStatus.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that request"),
  });

  const bufferColumns: Column<SalaryBufferRequest>[] = [
    {
      key: "reference",
      header: "Request",
      render: (row) => <CellStack primary={row.reference} secondary={row.employerName} />,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "requested",
      header: "Requested",
      align: "right",
      render: (row) => (
        <CellStack
          primary={<span className="font-semibold tnum">{nairaCompact(row.requestedAmount)}</span>}
          secondary={row.approvedAmount ? `approved ${nairaCompact(row.approvedAmount)}` : "not yet approved"}
        />
      ),
      sortValue: (row) => row.requestedAmount,
    },
    {
      key: "shortfall",
      header: "Shortfall",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum text-muted-foreground">{nairaCompact(row.shortfall)}</span>,
      sortValue: (row) => row.shortfall,
    },
    {
      key: "terms",
      header: "Terms",
      hideBelow: "lg",
      render: (row) => (
        <CellStack primary={`${row.pricingRatePct}% · ${row.tenorDays} days`} secondary={`repays ${shortDate(row.repaymentDate)}`} />
      ),
      sortValue: (row) => row.tenorDays,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
      sortValue: (row) => row.status,
    },
  ];

  const bridgeColumns: Column<BridgeRequest>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={row.employeeName} />,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "employer",
      header: "Employer",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{row.employerName}</span>,
      sortValue: (row) => row.employerName,
    },
    {
      key: "amount",
      header: "To disburse",
      align: "right",
      render: (row) => (
        <CellStack
          primary={<span className="font-semibold tnum">{naira(row.netAmount)}</span>}
          secondary={`bridged ${naira(row.amount)}`}
        />
      ),
      sortValue: (row) => row.netAmount,
    },
    {
      key: "settles",
      header: "Settles",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.settlementDate)}</span>,
      sortValue: (row) => row.settlementDate,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
      sortValue: (row) => row.status,
    },
  ];

  const repaymentColumns: Column<Repayment>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={row.counterparty} />,
      sortValue: (row) => row.dueDate,
    },
    {
      key: "source",
      header: "Source",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{row.sourceType}</span>,
      sortValue: (row) => row.sourceType,
    },
    {
      key: "due",
      header: "Amount due",
      align: "right",
      render: (row) => (
        <CellStack
          primary={<span className="font-semibold tnum">{nairaCompact(row.amountDue)}</span>}
          secondary={`paid ${nairaCompact(row.amountPaid)}`}
        />
      ),
      sortValue: (row) => row.amountDue,
    },
    {
      key: "dueDate",
      header: "Due",
      hideBelow: "sm",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.dueDate)}</span>,
      sortValue: (row) => row.dueDate,
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
        eyebrow="Funding queue"
        title="Capital out, capital back"
        description="Salary Buffer decisions, Bridge disbursements waiting to clear and repayments due."
        actions={<ChartTabs options={VIEWS} value={view} onChange={setView} />}
      />

      <AsyncPanel query={funding}>
        {(data) => {
          const awaitingDecision = data.buffers.filter((row) =>
            ["Submitted", "Under review", "Offer issued", "Accepted"].includes(row.status),
          );
          const funded = data.buffers.filter((row) => ["Funded", "Repaying"].includes(row.status));
          const outstanding = data.repayments.filter((row) => row.status !== "Paid");
          const overdue = data.repayments.filter((row) => row.status === "Overdue");

          return (
            <div className="space-y-6">
              <StatGrid columns={4}>
                <StatCard
                  label="Awaiting decision"
                  value={String(awaitingDecision.length)}
                  hint={nairaCompact(awaitingDecision.reduce((sum, row) => sum + row.requestedAmount, 0))}
                  tone="attention"
                />
                <StatCard
                  label="Funded exposure"
                  value={nairaCompact(funded.reduce((sum, row) => sum + (row.approvedAmount ?? 0), 0))}
                  tone="primary"
                />
                <StatCard
                  label="Bridge awaiting disbursement"
                  value={nairaCompact(data.bridge.reduce((sum, row) => sum + row.netAmount, 0))}
                  hint={`${data.bridge.length} requests`}
                />
                <StatCard
                  label="Repayments outstanding"
                  value={nairaCompact(outstanding.reduce((sum, row) => sum + (row.amountDue - row.amountPaid), 0))}
                  hint={`${overdue.length} overdue`}
                  tone={overdue.length > 0 ? "attention" : "protected"}
                />
              </StatGrid>

              {view === "Salary Buffer" ? (
                <DataTable
                  rows={data.buffers}
                  columns={bufferColumns}
                  getRowId={(row) => row.id}
                  caption="Each Salary Buffer request from an employer, with the amount, term and approval state"
                  search={(row) => `${row.reference} ${row.employerName} ${row.status}`}
                  searchPlaceholder="Search by reference or employer"
                  filters={[
                    { key: "status", label: "Status", options: BUFFER_STATUSES, accessor: (row) => row.status },
                    {
                      key: "employer",
                      label: "Employer",
                      options: Array.from(new Set(data.buffers.map((row) => row.employerName))),
                      accessor: (row) => row.employerName,
                    },
                  ]}
                  dateAccessor={(row) => row.createdAt}
                  emptyTitle="No Salary Buffer requests"
                  emptyBody="Employer requests appear here as soon as they are submitted."
                  onRowClick={(row) => {
                    setSelected(row);
                    setNextStatus(row.status);
                  }}
                  initialSort={{ key: "reference", direction: "desc" }}
                  exportName="paybridge-salary-buffer-queue"
                  exportRow={(row) => ({
                    Reference: row.reference,
                    Employer: row.employerName,
                    Requested: row.requestedAmount,
                    Approved: row.approvedAmount ?? "",
                    Shortfall: row.shortfall,
                    "Rate %": row.pricingRatePct,
                    "Tenor days": row.tenorDays,
                    Status: row.status,
                  })}
                />
              ) : null}

              {view === "Bridge queue" ? (
                <DataTable
                  rows={data.bridge}
                  columns={bridgeColumns}
                  getRowId={(row) => row.id}
                  caption="Each approved request waiting to be disbursed, with the amount and the destination"
                  search={(row) => `${row.reference} ${row.employeeName} ${row.employerName}`}
                  searchPlaceholder="Search by reference, employee or employer"
                  filters={[
                    {
                      key: "employer",
                      label: "Employer",
                      options: Array.from(new Set(data.bridge.map((row) => row.employerName))),
                      accessor: (row) => row.employerName,
                    },
                    {
                      key: "status",
                      label: "Status",
                      options: ["Initiated", "Processing"],
                      accessor: (row) => row.status,
                    },
                  ]}
                  dateAccessor={(row) => row.createdAt}
                  emptyTitle="Nothing waiting to disburse"
                  emptyBody="Every Bridge request has cleared. New requests appear here in real time."
                  initialSort={{ key: "reference", direction: "desc" }}
                  exportName="paybridge-bridge-queue"
                  exportRow={(row) => ({
                    Reference: row.reference,
                    Employee: row.employeeName,
                    Employer: row.employerName,
                    Amount: row.amount,
                    "Net to disburse": row.netAmount,
                    Settles: shortDate(row.settlementDate),
                    Status: row.status,
                  })}
                />
              ) : null}

              {view === "Repayments" ? (
                <DataTable
                  rows={data.repayments}
                  columns={repaymentColumns}
                  getRowId={(row) => row.id}
                  caption="Each scheduled repayment, with the amount, the due date and whether it has settled"
                  search={(row) => `${row.reference} ${row.counterparty} ${row.sourceType} ${row.status}`}
                  searchPlaceholder="Search by reference or counterparty"
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
                  ]}
                  dateAccessor={(row) => row.dueDate}
                  emptyTitle="No repayments scheduled"
                  emptyBody="Repayments appear once funding has been disbursed."
                  initialSort={{ key: "dueDate", direction: "asc" }}
                  exportName="paybridge-repayments"
                  exportRow={(row) => ({
                    Reference: row.reference,
                    Counterparty: row.counterparty,
                    Source: row.sourceType,
                    "Amount due": row.amountDue,
                    "Amount paid": row.amountPaid,
                    Due: shortDate(row.dueDate),
                    Status: row.status,
                    Reconciliation: row.reconciliation,
                  })}
                />
              ) : null}
            </div>
          );
        }}
      </AsyncPanel>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.reference ?? "Salary Buffer request"}
        description={selected?.employerName}
        size="wide"
        footer={<ActionButton onClick={() => setStatusOpen(true)}>Update status</ActionButton>}
      >
        {selected ? (
          <div className="space-y-5">
            <SegmentedMeter
              segments={[
                { value: selected.fundsConfirmed, tone: "protected", label: "Confirmed by employer" },
                { value: selected.shortfall, tone: "primary", label: "Shortfall" },
              ]}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Payroll obligation" value={naira(selected.payrollObligation)} />
                <SummaryRow label="Funds confirmed" value={naira(selected.fundsConfirmed)} />
                <SummaryRow label="Shortfall" value={naira(selected.shortfall)} />
                <SummaryRow label="Requested" value={naira(selected.requestedAmount)} emphasis tone="primary" />
                {selected.approvedAmount ? (
                  <SummaryRow label="Approved" value={naira(selected.approvedAmount)} />
                ) : null}
              </div>
              <div className="divide-y divide-border/70">
                <SummaryRow label="Pricing" value={`${selected.pricingRatePct}% for ${selected.tenorDays} days`} />
                <SummaryRow label="Repayment date" value={shortDate(selected.repaymentDate)} />
                <SummaryRow label="Submitted" value={shortDate(selected.createdAt)} />
                {selected.fundedAt ? <SummaryRow label="Funded" value={shortDate(selected.fundedAt)} /> : null}
                <SummaryRow label="Status" value={<StatusBadge status={selected.status} />} />
                <SummaryRow label="Documents" value={`${selected.documents.length} on file`} />
              </div>
            </div>
            {selected.documents.length > 0 ? (
              <ul className="space-y-2">
                {selected.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground"
                  >
                    <span className="truncate text-foreground">{doc.name}</span>
                    <span className="shrink-0 tnum">
                      {doc.category} · {doc.sizeKb} KB
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <InfoNote>
              A Salary Buffer is a facility for the employer's payroll. It is never presented to employees as
              credit.
            </InfoNote>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => update.mutate()}
        title="Update Salary Buffer status"
        description={
          selected ? `${selected.employerName} · ${naira(selected.requestedAmount)} requested.` : undefined
        }
        confirmLabel="Apply status"
        loading={update.isPending}
        tone={nextStatus === "Declined" ? "danger" : "primary"}
      >
        <SelectField
          label="New status"
          value={nextStatus}
          onChange={(value) => setNextStatus(value as BufferStatus)}
          options={BUFFER_STATUSES.map((value) => ({ value, label: value }))}
        />
      </ConfirmDialog>
    </div>
  );
}
