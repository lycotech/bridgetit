import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { InfoNote } from "@/components/dashboard/Panel";
import { useAdminInvestors } from "@/lib/admin/investors";
import type { AdminInvestorListItem } from "../../../../../backend/src/types";

const naira = (v: number) => `₦${v.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/**
 * Admin → Investors — the real directory that was missing from the portal:
 * `/admin/reports` only ever shows a platform-wide committed-capital total
 * (aggregate-only, by design), so staff had no way to see WHICH real
 * investors hold WHAT. This lists every real `accountType === "investor"`
 * customer with their real commitment totals, computed the same way
 * `/api/investments/portfolio` does for the customer themselves.
 */
export default function Investors() {
  const investors = useAdminInvestors("");
  const rows = investors.data?.items ?? [];

  const totalCommitted = rows.reduce((sum, r) => sum + r.committedCapital, 0);
  const totalWithdrawn = rows.reduce((sum, r) => sum + r.withdrawnCapital, 0);

  const columns: Column<AdminInvestorListItem>[] = [
    {
      key: "fullName",
      header: "Investor",
      render: (row) => <CellStack primary={row.fullName} secondary={row.email} />,
      sortValue: (row) => row.fullName,
    },
    {
      key: "kycStatus",
      header: "Identity",
      render: (row) => <StatusBadge status={row.kycStatus} />,
      sortValue: (row) => row.kycStatus,
    },
    {
      key: "status",
      header: "Account",
      hideBelow: "md",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
    {
      key: "committedCapital",
      header: "Committed",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.committedCapital)}</span>,
      sortValue: (row) => row.committedCapital,
    },
    {
      key: "activeCommitmentCount",
      header: "Commitments",
      align: "right",
      hideBelow: "sm",
      render: (row) => <span className="tnum">{row.activeCommitmentCount}</span>,
      sortValue: (row) => row.activeCommitmentCount,
    },
    {
      key: "withdrawnCapital",
      header: "Withdrawn",
      align: "right",
      hideBelow: "lg",
      render: (row) => <span className="tnum text-muted-foreground">{naira(row.withdrawnCapital)}</span>,
      sortValue: (row) => row.withdrawnCapital,
    },
    {
      key: "joinedAt",
      header: "Joined",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{new Date(row.joinedAt).toLocaleDateString("en-GB")}</span>,
      sortValue: (row) => row.joinedAt,
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        title="Investors"
        description="Real capital-partner accounts and their real committed capital — the per-investor detail Reports doesn't show."
      />

      <StatGrid columns={3}>
        <StatCard label="Investors" value={rows.length.toLocaleString()} icon={<TrendingUp className="h-4 w-4" />} tone="primary" />
        <StatCard label="Total committed" value={naira(totalCommitted)} />
        <StatCard label="Total withdrawn" value={naira(totalWithdrawn)} tone="protected" />
      </StatGrid>

      <InfoNote>
        Recorded commitments only — no bank rail exists yet, so this is not money PayBridge has moved, and there is no
        yield/return figure to show. Same honesty limitation as the customer's own Investments panel on{" "}
        <code>/account</code>.
      </InfoNote>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every real investor account, with real committed and withdrawn capital"
        search={(row) => `${row.fullName} ${row.email}`}
        searchPlaceholder="Search by name or email"
        isLoading={investors.isPending}
        isError={investors.isError}
        onRetry={() => void investors.refetch()}
        emptyTitle="No investors yet"
        emptyBody="Real capital-partner accounts will appear here once someone registers with an investor account."
        initialSort={{ key: "committedCapital", direction: "desc" }}
        exportName="paybridge-investors"
        exportRow={(row) => ({
          Name: row.fullName,
          Email: row.email,
          Identity: row.kycStatus,
          Account: row.status,
          Committed: row.committedCapital,
          Commitments: row.activeCommitmentCount,
          Withdrawn: row.withdrawnCapital,
          Joined: row.joinedAt,
        })}
      />
    </div>
  );
}
