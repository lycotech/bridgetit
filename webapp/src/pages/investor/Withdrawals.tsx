import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Landmark } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { MoneyField, SelectField } from "@/components/dashboard/forms";
import { AsyncPanel } from "@/components/dashboard/states";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira, shortDate } from "@/lib/platform/format";
import type { Withdrawal } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

export default function InvestorWithdrawalsPage() {
  const investorId = useAccountId("investor");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [bankAccountId, setBankAccountId] = useState("");

  const overview = useQuery({
    queryKey: qk.investorOverview(investorId),
    queryFn: () => investorApi.overview(investorId),
  });
  const withdrawals = useQuery({
    queryKey: qk.investorWithdrawals(investorId),
    queryFn: () => investorApi.withdrawals(investorId),
  });

  const request = useMutation({
    mutationFn: () =>
      investorApi.requestWithdrawal({
        investorId,
        amount,
        bankAccountId: bankAccountId || (overview.data?.investor.bankAccounts[0]?.id ?? ""),
      }),
    onSuccess: (withdrawal) => {
      void queryClient.invalidateQueries({ queryKey: qk.investorWithdrawals(investorId) });
      void queryClient.invalidateQueries({ queryKey: qk.investorOverview(investorId) });
      setOpen(false);
      setAmount(0);
      toast.success(`Withdrawal requested — ${withdrawal.reference}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not submit that request"),
  });

  const rows = withdrawals.data ?? [];
  const pending = rows.filter((row) => row.status !== "Paid" && row.status !== "Declined");

  const columns: Column<Withdrawal>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={shortDate(row.requestedAt)} />,
      sortValue: (row) => row.requestedAt,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.amount)}</span>,
      sortValue: (row) => row.amount,
    },
    {
      key: "destination",
      header: "Destination",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{row.destination}</span>,
    },
    {
      key: "valueDate",
      header: "Value date",
      hideBelow: "sm",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.valueDate)}</span>,
      sortValue: (row) => row.valueDate,
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
        eyebrow="Withdrawals"
        title="Withdraw available funds"
        description="Income and matured capital can be withdrawn to your registered bank account."
        actions={
          <ActionButton icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Request withdrawal
          </ActionButton>
        }
      />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Panel title="Available for withdrawal" description="Distributed income and matured capital.">
              <p className="font-display text-3xl font-extrabold text-foreground tnum">
                {naira(data.investor.availableForWithdrawal)}
              </p>
              <div className="mt-4 divide-y divide-border/70">
                <SummaryRow label="Portfolio value" value={naira(data.investor.portfolioValue)} />
                <SummaryRow label="Capital deployed" value={naira(data.investor.capitalDeployed)} hint="Locked until maturity or the mandate's notice period" />
                <SummaryRow label="Awaiting deployment" value={naira(data.investor.undeployedCapital)} />
                <SummaryRow
                  label="Pending withdrawals"
                  value={naira(pending.reduce((sum, row) => sum + row.amount, 0))}
                  emphasis
                  tone="primary"
                />
              </div>
              <div className="mt-5">
                <ActionButton
                  disabled={data.investor.availableForWithdrawal <= 0}
                  onClick={() => setOpen(true)}
                >
                  Request withdrawal
                </ActionButton>
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel title="Registered bank accounts" description="Withdrawals only go to accounts in your name.">
                <ul className="space-y-2.5">
                  {data.investor.bankAccounts.map((account) => (
                    <li key={account.id} className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <Landmark className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{account.bankName}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground tnum">
                          {account.accountName} · {account.accountNumberMasked}
                        </span>
                      </span>
                      {account.isPrimary ? (
                        <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          Primary
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="How withdrawals are processed">
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li>
                    <span className="font-semibold text-foreground">1.</span> You request an amount from your
                    available balance.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">2.</span> The investment manager reviews and
                    approves it against custodian records.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">3.</span> Funds are paid to your registered
                    account, usually within three business days.
                  </li>
                </ol>
                <InfoNote className="mt-4">
                  Capital that is deployed stays invested until maturity or the notice period stated in the
                  mandate.
                </InfoNote>
              </Panel>
            </div>
          </div>
        )}
      </AsyncPanel>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each withdrawal you have requested, with the amount, destination and where it has reached"
        search={(row) => `${row.reference} ${row.destination} ${row.status}`}
        searchPlaceholder="Search by reference or destination"
        filters={[
          {
            key: "status",
            label: "Status",
            options: ["Requested", "Under review", "Approved", "Paid", "Declined"],
            accessor: (row) => row.status,
          },
        ]}
        dateAccessor={(row) => row.requestedAt}
        isLoading={withdrawals.isLoading}
        isError={withdrawals.isError}
        onRetry={() => void withdrawals.refetch()}
        emptyTitle="No withdrawals yet"
        emptyBody="When you withdraw available funds, every request appears here with its status."
        initialSort={{ key: "reference", direction: "desc" }}
        exportName="paybridge-withdrawals"
        exportRow={(row) => ({
          Reference: row.reference,
          Amount: row.amount,
          Destination: row.destination,
          Requested: shortDate(row.requestedAt),
          "Value date": shortDate(row.valueDate),
          Status: row.status,
        })}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request a withdrawal"
        description="Paid to your registered bank account, usually within three business days."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={request.isPending}
              disabled={amount <= 0 || amount > (overview.data?.investor.availableForWithdrawal ?? 0)}
              onClick={() => request.mutate()}
            >
              Request withdrawal
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <MoneyField
            label="Amount"
            value={amount}
            onChange={setAmount}
            quickAmounts={[
              5_000_000,
              10_000_000,
              overview.data?.investor.availableForWithdrawal ?? 0,
            ]}
            hint={`Available ${naira(overview.data?.investor.availableForWithdrawal ?? 0)}`}
          />
          <SelectField
            label="Destination account"
            value={bankAccountId || (overview.data?.investor.bankAccounts[0]?.id ?? "")}
            onChange={setBankAccountId}
            options={(overview.data?.investor.bankAccounts ?? []).map((account) => ({
              value: account.id,
              label: `${account.bankName} · ${account.accountNumberMasked}`,
            }))}
          />
          <div className="divide-y divide-border/70">
            <SummaryRow label="Amount" value={naira(amount)} emphasis tone="primary" />
            <SummaryRow
              label="Expected value date"
              value={longDate(new Date(Date.now() + 3 * 86_400_000).toISOString())}
            />
          </div>
          <InfoNote>
            Requests are reviewed by the investment manager before payment. You can track the status on this page.
          </InfoNote>
        </div>
      </Modal>
    </div>
  );
}
