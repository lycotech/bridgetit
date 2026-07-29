import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, SegmentedMeter, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal, ConfirmDialog } from "@/components/dashboard/Modal";
import { SelectField, UploadDropzone } from "@/components/dashboard/forms";
import type { SimulatedFile } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { dateTime, naira, nairaCompact } from "@/lib/platform/format";
import { RECONCILIATION_STATUSES } from "@/lib/platform/models";
import type { ReconciliationStatus, Transaction } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

export default function OperationsReconciliationPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<ReconciliationStatus>("Matched");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState<SimulatedFile[]>([]);
  const [running, setRunning] = useState(false);

  const items = useQuery({ queryKey: qk.ops("reconciliation"), queryFn: () => opsApi.reconciliation() });

  const update = useMutation({
    mutationFn: () => opsApi.setReconciliation(selected?.reference ?? "", nextStatus, actor),
    onSuccess: (tx) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("reconciliation") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("transactions") });
      setSelected(tx);
      setStatusOpen(false);
      toast.success(`${tx.reference} marked ${nextStatus.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that record"),
  });

  const runMatch = async () => {
    setRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setRunning(false);
    setUploadOpen(false);
    setFiles([]);
    void queryClient.invalidateQueries({ queryKey: qk.ops("reconciliation") });
    toast.success("Bank statement matched against the ledger");
  };

  const rows = items.data ?? [];
  const counts = RECONCILIATION_STATUSES.map((status) => ({
    status,
    rows: rows.filter((row) => row.reconciliation === status),
  }));
  const matched = counts.find((entry) => entry.status === "Matched")?.rows ?? [];
  const unmatched = counts.find((entry) => entry.status === "Unmatched")?.rows ?? [];
  const investigating = counts.find((entry) => entry.status === "Investigating")?.rows ?? [];

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
      render: (row) => <CellStack primary={row.counterparty} secondary={row.type} />,
      sortValue: (row) => row.counterparty,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.amount)}</span>,
      sortValue: (row) => row.amount,
    },
    {
      key: "channel",
      header: "Channel",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.channel}</span>,
      sortValue: (row) => row.channel,
    },
    {
      key: "status",
      header: "Transaction",
      hideBelow: "md",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
    {
      key: "reconciliation",
      header: "Reconciliation",
      render: (row) => <StatusBadge status={row.reconciliation} dot />,
      sortValue: (row) => row.reconciliation,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reconciliation"
        title="Ledger against bank"
        description="Match settlement records to bank statements, and resolve anything that does not line up."
        actions={
          <ActionButton icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
            Upload bank statement
          </ActionButton>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Matched"
          value={String(matched.length)}
          hint={nairaCompact(matched.reduce((sum, row) => sum + row.amount, 0))}
          tone="protected"
        />
        <StatCard label="Unmatched" value={String(unmatched.length)} tone="attention" />
        <StatCard label="Investigating" value={String(investigating.length)} />
        <StatCard
          label="Value under review"
          value={nairaCompact(
            [...unmatched, ...investigating].reduce((sum, row) => sum + row.amount, 0),
          )}
          tone="primary"
        />
      </StatGrid>

      <Panel title="Reconciliation position" description="Share of records in each state.">
        <SegmentedMeter
          segments={counts.map((entry, index) => ({
            value: entry.rows.length,
            tone: (["protected", "available", "muted", "gold", "primary"] as const)[index],
            label: `${entry.status} · ${entry.rows.length}`,
          }))}
        />
        <InfoNote className="mt-4">
          Records are matched automatically on reference and amount. Anything the matcher cannot place is left
          for a finance officer to review.
        </InfoNote>
      </Panel>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each settlement record matched against the bank statement, with the difference and its state"
        search={(row) => `${row.reference} ${row.counterparty} ${row.channel} ${row.reconciliation}`}
        searchPlaceholder="Search by reference, counterparty or channel"
        filters={[
          {
            key: "reconciliation",
            label: "Reconciliation",
            options: RECONCILIATION_STATUSES,
            accessor: (row) => row.reconciliation,
          },
          {
            key: "type",
            label: "Type",
            options: ["Bridge", "Salary Buffer", "Repayment", "Investor inflow", "Withdrawal"],
            accessor: (row) => row.type,
          },
        ]}
        dateAccessor={(row) => row.createdAt}
        isLoading={items.isLoading}
        isError={items.isError}
        onRetry={() => void items.refetch()}
        emptyTitle="Nothing to reconcile"
        emptyBody="Every record in this period has been matched."
        onRowClick={(row) => {
          setSelected(row);
          setNextStatus(row.reconciliation);
        }}
        initialSort={{ key: "reconciliation", direction: "asc" }}
        pageSize={12}
        exportName="paybridge-reconciliation"
        exportRow={(row) => ({
          Reference: row.reference,
          Counterparty: row.counterparty,
          Type: row.type,
          Amount: row.amount,
          Channel: row.channel,
          Created: dateTime(row.createdAt),
          "Transaction status": row.status,
          Reconciliation: row.reconciliation,
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.reference ?? "Record"}
        description="Ledger detail for this record."
        footer={<ActionButton onClick={() => setStatusOpen(true)}>Update reconciliation</ActionButton>}
      >
        {selected ? (
          <div className="divide-y divide-border/70">
            <SummaryRow label="Counterparty" value={selected.counterparty} />
            <SummaryRow label="Type" value={selected.type} />
            <SummaryRow label="Amount" value={naira(selected.amount)} emphasis tone="primary" />
            <SummaryRow label="Fee" value={naira(selected.fee)} />
            <SummaryRow label="Channel" value={selected.channel} />
            <SummaryRow label="Created" value={dateTime(selected.createdAt)} />
            <SummaryRow label="Transaction status" value={<StatusBadge status={selected.status} />} />
            <SummaryRow label="Reconciliation" value={<StatusBadge status={selected.reconciliation} />} />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => update.mutate()}
        title="Update reconciliation status"
        description={selected ? `${selected.reference} · ${naira(selected.amount)}.` : undefined}
        confirmLabel="Apply status"
        loading={update.isPending}
      >
        <SelectField
          label="Reconciliation status"
          value={nextStatus}
          onChange={(value) => setNextStatus(value as ReconciliationStatus)}
          options={RECONCILIATION_STATUSES.map((value) => ({ value, label: value }))}
        />
      </ConfirmDialog>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload bank statement"
        description="We match the statement against the ledger on reference and amount."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={running}
              disabled={files.length === 0}
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => void runMatch()}
            >
              Run matching
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <UploadDropzone
            label="Bank statement"
            hint="CSV export from the settlement account."
            category="Bank statement"
            files={files}
            onFilesChange={setFiles}
          />
          <InfoNote>
            Matching never changes a customer's balance on its own. Anything it cannot place stays unmatched for
            review.
          </InfoNote>
        </div>
      </Modal>
    </div>
  );
}
