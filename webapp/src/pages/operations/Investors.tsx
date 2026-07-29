import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { Modal, ConfirmDialog } from "@/components/dashboard/Modal";
import { SelectField } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, shortDate } from "@/lib/platform/format";
import { KYC_STATUSES } from "@/lib/platform/models";
import type { Investor, KycStatus } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

export default function OperationsInvestorsPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Investor | null>(null);
  const [kybOpen, setKybOpen] = useState(false);
  const [nextKyb, setNextKyb] = useState<KycStatus>("Verified");

  const investors = useQuery({ queryKey: qk.ops("investors"), queryFn: () => opsApi.investors() });

  const setKyb = useMutation({
    mutationFn: () => opsApi.setInvestorKyb(selected?.id ?? "", nextKyb, actor),
    onSuccess: (investor) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("investors") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("overview") });
      setSelected(investor);
      setKybOpen(false);
      toast.success(`${investor.name} verification set to ${nextKyb.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that investor"),
  });

  const rows = investors.data ?? [];
  const verified = rows.filter((row) => row.kybStatus === "Verified");

  const columns: Column<Investor>[] = [
    {
      key: "name",
      header: "Investor",
      render: (row) => <CellStack primary={row.name} secondary={`${row.type} · ${row.accreditation}`} />,
      sortValue: (row) => row.name,
    },
    {
      key: "portfolio",
      header: "Portfolio value",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{nairaCompact(row.portfolioValue)}</span>,
      sortValue: (row) => row.portfolioValue,
    },
    {
      key: "deployed",
      header: "Deployed",
      align: "right",
      hideBelow: "md",
      render: (row) => (
        <CellStack
          primary={<span className="tnum">{nairaCompact(row.capitalDeployed)}</span>}
          secondary={`${nairaCompact(row.undeployedCapital)} awaiting`}
        />
      ),
      sortValue: (row) => row.capitalDeployed,
    },
    {
      key: "income",
      header: "Net income",
      align: "right",
      hideBelow: "lg",
      render: (row) => <span className="tnum text-muted-foreground">{nairaCompact(row.netIncomeEarned)}</span>,
      sortValue: (row) => row.netIncomeEarned,
    },
    {
      key: "risk",
      header: "Risk profile",
      hideBelow: "md",
      render: (row) => <RiskPill level={row.riskProfile} />,
      sortValue: (row) => row.riskProfile,
    },
    {
      key: "kyb",
      header: "KYB",
      render: (row) => <StatusBadge status={row.kybStatus} dot />,
      sortValue: (row) => row.kybStatus,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investors"
        title="Investor accounts and verification"
        description="KYB status, committed capital and deployment for every investor funding the platform."
      />

      <StatGrid columns={4}>
        <StatCard label="Investors" value={String(rows.length)} tone="primary" />
        <StatCard label="KYB verified" value={String(verified.length)} tone="protected" />
        <StatCard
          label="Capital committed"
          value={nairaCompact(rows.reduce((sum, row) => sum + row.capitalCommitted, 0))}
        />
        <StatCard
          label="Awaiting deployment"
          value={nairaCompact(rows.reduce((sum, row) => sum + row.undeployedCapital, 0))}
          tone="attention"
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every investor account, with capital committed, deployed and currently available"
        search={(row) => `${row.name} ${row.email} ${row.type} ${row.accreditation} ${row.kybStatus}`}
        searchPlaceholder="Search by investor or email"
        filters={[
          { key: "kyb", label: "KYB", options: KYC_STATUSES, accessor: (row) => row.kybStatus },
          {
            key: "type",
            label: "Type",
            options: ["Individual", "Institution"],
            accessor: (row) => row.type,
          },
        ]}
        dateAccessor={(row) => row.joinedAt}
        isLoading={investors.isLoading}
        isError={investors.isError}
        onRetry={() => void investors.refetch()}
        emptyTitle="No investor accounts"
        emptyBody="Investor accounts appear here once an application is submitted."
        onRowClick={(row) => {
          setSelected(row);
          setNextKyb(row.kybStatus);
        }}
        initialSort={{ key: "portfolio", direction: "desc" }}
        exportName="paybridge-investors"
        exportRow={(row) => ({
          Investor: row.name,
          Type: row.type,
          Email: row.email,
          KYB: row.kybStatus,
          "Portfolio value": row.portfolioValue,
          Committed: row.capitalCommitted,
          Deployed: row.capitalDeployed,
          "Net income": row.netIncomeEarned,
          "Risk profile": row.riskProfile,
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Investor"}
        description="Verification, capital position and settlement accounts."
        size="wide"
        footer={<ActionButton onClick={() => setKybOpen(true)}>Update verification</ActionButton>}
      >
        {selected ? (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Investor type" value={selected.type} />
              <SummaryRow label="Email" value={selected.email} />
              <SummaryRow label="Accreditation" value={selected.accreditation} />
              <SummaryRow label="KYB status" value={<StatusBadge status={selected.kybStatus} />} />
              <SummaryRow label="Risk profile" value={<RiskPill level={selected.riskProfile} />} />
              <SummaryRow label="Investor since" value={shortDate(selected.joinedAt)} />
            </div>
            <div className="space-y-4">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Portfolio value" value={naira(selected.portfolioValue)} emphasis tone="primary" />
                <SummaryRow label="Capital committed" value={naira(selected.capitalCommitted)} />
                <SummaryRow label="Capital deployed" value={naira(selected.capitalDeployed)} />
                <SummaryRow label="Awaiting deployment" value={naira(selected.undeployedCapital)} />
                <SummaryRow label="Net income" value={naira(selected.netIncomeEarned)} />
                <SummaryRow label="Fees to date" value={naira(selected.feesToDate)} />
                <SummaryRow label="Available for withdrawal" value={naira(selected.availableForWithdrawal)} />
              </div>
              <div className="space-y-2">
                {selected.bankAccounts.map((account) => (
                  <p key={account.id} className="rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{account.bankName}</span> ·{" "}
                    <span className="tnum">{account.accountNumberMasked}</span>
                    {account.isPrimary ? " · primary" : ""}
                  </p>
                ))}
              </div>
              <InfoNote>
                Capital is invested through an approved mandate. Investors are never matched to individual
                employees.
              </InfoNote>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={kybOpen}
        onClose={() => setKybOpen(false)}
        onConfirm={() => setKyb.mutate()}
        title="Update KYB verification"
        description={
          selected
            ? `${selected.name} will be notified. Capital cannot be committed until verification is complete.`
            : undefined
        }
        confirmLabel="Apply status"
        loading={setKyb.isPending}
        tone={nextKyb === "Rejected" ? "danger" : "primary"}
      >
        <SelectField
          label="Verification status"
          value={nextKyb}
          onChange={(value) => setNextKyb(value as KycStatus)}
          options={KYC_STATUSES.map((value) => ({ value, label: value }))}
        />
      </ConfirmDialog>
    </div>
  );
}
