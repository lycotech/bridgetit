import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { Modal } from "@/components/dashboard/Modal";
import { InvestorDisclosureLine } from "@/components/investor/Disclosures";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { dateTime, naira, shortDate } from "@/lib/platform/format";
import { RECONCILIATION_STATUSES, TRANSACTION_STATUSES } from "@/lib/platform/models";
import type { Transaction } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

export default function InvestorTransactionsPage() {
  const investorId = useAccountId("investor");
  const [active, setActive] = useState<Transaction | null>(null);

  const transactions = useQuery({
    queryKey: qk.investorTransactions(investorId),
    queryFn: () => investorApi.transactions(investorId),
  });

  const rows = transactions.data ?? [];
  const inflows = rows.filter((row) => row.type === "Investor inflow");
  const withdrawals = rows.filter((row) => row.type === "Withdrawal");

  const columns: Column<Transaction>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={shortDate(row.createdAt)} />,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <span className="text-muted-foreground">{row.type}</span>,
      sortValue: (row) => row.type,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.amount)}</span>,
      sortValue: (row) => row.amount,
    },
    {
      key: "fee",
      header: "Fee",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum">{naira(row.fee)}</span>,
      sortValue: (row) => row.fee,
    },
    {
      key: "channel",
      header: "Channel",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.channel}</span>,
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
        eyebrow="Transactions"
        title="Your capital movements"
        description="Every inflow, distribution and withdrawal on your account."
      />

      <StatGrid columns={3}>
        <StatCard
          label="Total committed in"
          value={naira(inflows.reduce((sum, row) => sum + row.amount, 0))}
          hint={`${inflows.length} inflows`}
          tone="primary"
        />
        <StatCard
          label="Total withdrawn"
          value={naira(withdrawals.reduce((sum, row) => sum + row.amount, 0))}
          hint={`${withdrawals.length} withdrawals`}
        />
        <StatCard
          label="Fees charged"
          value={naira(rows.reduce((sum, row) => sum + row.fee, 0))}
          tone="protected"
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every movement of your capital, with the type, amount, reference and date"
        search={(row) => `${row.reference} ${row.type} ${row.channel} ${row.status}`}
        searchPlaceholder="Search by reference or type"
        filters={[
          {
            key: "type",
            label: "Type",
            options: ["Investor inflow", "Withdrawal", "Repayment"],
            accessor: (row) => row.type,
          },
          {
            key: "status",
            label: "Status",
            options: TRANSACTION_STATUSES,
            accessor: (row) => row.status,
          },
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
        emptyTitle="No transactions yet"
        emptyBody="Your first commitment will appear here as soon as it is recorded."
        emptyAction={<ActionButton to="/investor/invest">Commit capital</ActionButton>}
        onRowClick={(row) => setActive(row)}
        initialSort={{ key: "reference", direction: "desc" }}
        exportName="paybridge-investor-transactions"
        exportRow={(row) => ({
          Reference: row.reference,
          Type: row.type,
          Date: shortDate(row.createdAt),
          Amount: row.amount,
          Fee: row.fee,
          Channel: row.channel,
          Status: row.status,
          Reconciliation: row.reconciliation,
        })}
      />

      <InvestorDisclosureLine />

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? naira(active.amount) : "Transaction"}
        description={active ? `${active.type} · ${active.reference}` : undefined}
        footer={
          <ActionButton variant="secondary" onClick={() => setActive(null)}>
            Close
          </ActionButton>
        }
      >
        {active ? (
          <div className="space-y-5">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Reference" value={active.reference} />
              <SummaryRow label="Type" value={active.type} />
              <SummaryRow label="Amount" value={naira(active.amount)} emphasis tone="primary" />
              <SummaryRow label="Fee" value={naira(active.fee)} />
              <SummaryRow label="Channel" value={active.channel} />
              <SummaryRow label="Created" value={dateTime(active.createdAt)} />
              <SummaryRow label="Status" value={<StatusBadge status={active.status} />} />
              <SummaryRow label="Reconciliation" value={<StatusBadge status={active.reconciliation} />} />
            </div>
            <InfoNote>
              Movements are reconciled by the investment manager against custodian records before they are marked
              as settled.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
