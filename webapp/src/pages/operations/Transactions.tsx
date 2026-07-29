import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal, ConfirmDialog } from "@/components/dashboard/Modal";
import { SelectField } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { dateTime, naira, nairaCompact } from "@/lib/platform/format";
import { RECONCILIATION_STATUSES, TRANSACTION_STATUSES } from "@/lib/platform/models";
import type { Transaction, TransactionStatus } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

const TYPES = ["Bridge", "Salary Buffer", "Repayment", "Investor inflow", "Withdrawal"] as const;

export default function OperationsTransactionsPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<TransactionStatus>("Disbursed");

  const transactions = useQuery({
    queryKey: qk.ops("transactions"),
    queryFn: () => opsApi.transactions(),
  });

  const update = useMutation({
    mutationFn: () => opsApi.setTransactionStatus(selected?.reference ?? "", nextStatus, actor),
    onSuccess: (tx) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("transactions") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("overview") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("reconciliation") });
      setSelected(tx);
      setStatusOpen(false);
      toast.success(`${tx.reference} set to ${nextStatus.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that transaction"),
  });

  const rows = transactions.data ?? [];
  const failed = rows.filter((row) => row.status === "Failed" || row.status === "Reversed");
  const overdue = rows.filter((row) => row.status === "Overdue");
  const settled = rows.filter((row) => row.status === "Settled");

  const columns: Column<Transaction>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={dateTime(row.createdAt)} />,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "counterparty",
      header: "Counterparty",
      render: (row) => <CellStack primary={row.counterparty} secondary={row.employerName ?? row.type} />,
      sortValue: (row) => row.counterparty,
    },
    {
      key: "type",
      header: "Type",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.type}</span>,
      sortValue: (row) => row.type,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => (
        <CellStack
          primary={<span className="font-semibold tnum">{naira(row.amount)}</span>}
          secondary={row.fee > 0 ? `fee ${naira(row.fee)}` : undefined}
        />
      ),
      sortValue: (row) => row.amount,
    },
    {
      key: "reconciliation",
      header: "Reconciliation",
      hideBelow: "md",
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
        eyebrow="Transactions"
        title="Every movement of money"
        description="Bridge disbursements, Salary Buffer funding, repayments, investor inflows and withdrawals in one ledger."
      />

      <StatGrid columns={4}>
        <StatCard
          label="Total value"
          value={nairaCompact(rows.reduce((sum, row) => sum + row.amount, 0))}
          hint={`${rows.length} transactions`}
          tone="primary"
        />
        <StatCard label="Settled" value={String(settled.length)} tone="protected" />
        <StatCard label="Overdue" value={String(overdue.length)} tone="attention" />
        <StatCard label="Failed or reversed" value={String(failed.length)} tone="attention" />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every Bridge request across the platform, with the amount, fee and settlement state"
        search={(row) => `${row.reference} ${row.counterparty} ${row.employerName ?? ""} ${row.type} ${row.status}`}
        searchPlaceholder="Search by reference, counterparty or employer"
        filters={[
          { key: "type", label: "Type", options: TYPES, accessor: (row) => row.type },
          { key: "status", label: "Status", options: TRANSACTION_STATUSES, accessor: (row) => row.status },
          {
            key: "reconciliation",
            label: "Reconciliation",
            options: RECONCILIATION_STATUSES,
            accessor: (row) => row.reconciliation,
          },
        ]}
        dateAccessor={(row) => row.createdAt}
        isLoading={transactions.isLoading}
        isError={transactions.isError}
        onRetry={() => void transactions.refetch()}
        emptyTitle="No transactions in this view"
        emptyBody="Adjust the filters or date range to see more of the ledger."
        onRowClick={(row) => {
          setSelected(row);
          setNextStatus(row.status);
        }}
        initialSort={{ key: "reference", direction: "desc" }}
        pageSize={12}
        exportName="paybridge-transactions"
        exportRow={(row) => ({
          Reference: row.reference,
          Type: row.type,
          Counterparty: row.counterparty,
          Employer: row.employerName ?? "",
          Amount: row.amount,
          Fee: row.fee,
          Channel: row.channel,
          Created: dateTime(row.createdAt),
          Status: row.status,
          Reconciliation: row.reconciliation,
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.reference ?? "Transaction"}
        description="Full detail for this movement of money."
        footer={<ActionButton onClick={() => setStatusOpen(true)}>Update status</ActionButton>}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Type" value={selected.type} />
              <SummaryRow label="Counterparty" value={selected.counterparty} />
              {selected.employerName ? <SummaryRow label="Employer" value={selected.employerName} /> : null}
              <SummaryRow label="Amount" value={naira(selected.amount)} emphasis tone="primary" />
              <SummaryRow label="Fee" value={naira(selected.fee)} />
              <SummaryRow label="Channel" value={selected.channel} />
              <SummaryRow label="Created" value={dateTime(selected.createdAt)} />
              <SummaryRow label="Status" value={<StatusBadge status={selected.status} />} />
              <SummaryRow label="Reconciliation" value={<StatusBadge status={selected.reconciliation} />} />
            </div>
            <InfoNote>
              Changing a status here updates the customer's view of this transaction and is written to the audit
              log.
            </InfoNote>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => update.mutate()}
        title="Update transaction status"
        description={
          selected ? `${selected.reference} · ${naira(selected.amount)} to ${selected.counterparty}.` : undefined
        }
        confirmLabel="Apply status"
        loading={update.isPending}
        tone={nextStatus === "Failed" || nextStatus === "Reversed" ? "danger" : "primary"}
      >
        <SelectField
          label="New status"
          value={nextStatus}
          onChange={(value) => setNextStatus(value as TransactionStatus)}
          options={TRANSACTION_STATUSES.map((value) => ({ value, label: value }))}
        />
      </ConfirmDialog>
    </div>
  );
}
