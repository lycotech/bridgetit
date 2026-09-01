import { PageHeader } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useBridgeDraws } from "@/lib/account/session";
import type { BridgeDrawView } from "../../../../../backend/src/types";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Real employee Transactions — `/account/employee/transactions`. Bridge
 * draw history for v1 — Savings deposits/withdrawals already show their own
 * running balance on the Save page. A single combined feed across both
 * would need a new backend aggregator endpoint; noted in the rebuild plan
 * as a later addition, not required to ship this page honestly.
 */
export default function EmployeeTransactions() {
  const draws = useBridgeDraws(true);
  const rows = draws.data?.items ?? [];

  const columns: Column<BridgeDrawView>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={shortDate(row.requestedAt)} />,
      sortValue: (row) => row.requestedAt,
    },
    {
      key: "amount",
      header: "Requested",
      align: "right",
      render: (row) => <span className="font-semibold tnum">₦{row.requestedAmount.toLocaleString("en-NG")}</span>,
      sortValue: (row) => row.requestedAmount,
    },
    {
      key: "approved",
      header: "Approved",
      align: "right",
      hideBelow: "sm",
      render: (row) => <span className="tnum">{row.approvedAmount === null ? "—" : `₦${row.approvedAmount.toLocaleString("en-NG")}`}</span>,
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
      <PageHeader title="Transactions" description="Your Bridge draw history." />
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every Bridge draw you've requested, with its amount and status"
        search={(row) => `${row.reference} ${row.status}`}
        searchPlaceholder="Search by reference"
        isLoading={draws.isPending}
        isError={draws.isError}
        onRetry={() => void draws.refetch()}
        emptyTitle="No Bridge draws yet"
        emptyBody="Once you request a Bridge draw, it appears here."
        initialSort={{ key: "reference", direction: "desc" }}
      />
    </div>
  );
}
