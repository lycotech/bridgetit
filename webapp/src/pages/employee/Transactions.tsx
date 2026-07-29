import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { PaydayTimeline } from "@/components/bridge/PaydayTimeline";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { dateTime, longDate, naira, shortDate } from "@/lib/platform/format";
import { EMPLOYEE_TRANSACTION_STATUSES } from "@/lib/platform/models";
import type { BridgeRequest } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

export default function EmployeeTransactionsPage() {
  const employeeId = useAccountId("employee");
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<BridgeRequest | null>(null);

  const requests = useQuery({
    queryKey: qk.employeeRequests(employeeId),
    queryFn: () => employeeApi.requests(employeeId),
  });

  // Deep link from the Bridge success screen: /employee/transactions?ref=…
  const reference = params.get("ref");
  useEffect(() => {
    if (!reference || !requests.data) return;
    const match = requests.data.find((r) => r.reference === reference);
    if (match) setActive(match);
  }, [reference, requests.data]);

  const advance = useMutation({
    mutationFn: (ref: string) => employeeApi.advanceStatus(ref),
    onSuccess: (updated) => {
      setActive(updated);
      void queryClient.invalidateQueries({ queryKey: qk.employeeRequests(employeeId) });
      void queryClient.invalidateQueries({ queryKey: qk.employeeOverview(employeeId) });
      toast.success(`Status updated to ${updated.status}`);
    },
  });

  const columns: Column<BridgeRequest>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (row) => <CellStack primary={row.reference} secondary={shortDate(row.createdAt)} />,
      sortValue: (row) => row.createdAt,
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
      hideBelow: "sm",
      render: (row) => <span className="tnum">{naira(row.fee)}</span>,
      sortValue: (row) => row.fee,
    },
    {
      key: "net",
      header: "You received",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum">{naira(row.netAmount)}</span>,
      sortValue: (row) => row.netAmount,
    },
    {
      key: "destination",
      header: "Destination",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.destination}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transactions"
        title="Your Bridge history"
        description="Every amount you have bridged, what it cost, and when payroll settles it."
      />

      <DataTable
        rows={requests.data ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every time you took part of your salary early, with the amount, the fee and what happened to it"
        search={(row) => `${row.reference} ${row.destination} ${row.status}`}
        searchPlaceholder="Search by reference or bank"
        filters={[
          {
            key: "status",
            label: "Status",
            options: EMPLOYEE_TRANSACTION_STATUSES,
            accessor: (row) => row.status,
          },
        ]}
        dateAccessor={(row) => row.createdAt}
        isLoading={requests.isLoading}
        isError={requests.isError}
        onRetry={() => void requests.refetch()}
        emptyTitle="No transactions yet"
        emptyBody="When you bridge part of your earned pay it appears here."
        onRowClick={(row) => setActive(row)}
        initialSort={{ key: "reference", direction: "desc" }}
        exportName="paybridge-my-transactions"
        exportRow={(row) => ({
          Reference: row.reference,
          Date: shortDate(row.createdAt),
          Amount: row.amount,
          Fee: row.fee,
          Received: row.netAmount,
          "Payroll deduction": row.settlementAmount,
          Status: row.status,
          Destination: row.destination,
        })}
      />

      <Modal
        open={Boolean(active)}
        onClose={() => {
          setActive(null);
          if (reference) {
            params.delete("ref");
            setParams(params, { replace: true });
          }
        }}
        title={active ? naira(active.amount) : "Transaction"}
        description={active ? `Reference ${active.reference}` : undefined}
        size="wide"
        footer={
          active ? (
            <ActionButton
              variant="secondary"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={advance.isPending}
              onClick={() => advance.mutate(active.reference)}
            >
              Refresh status
            </ActionButton>
          ) : null
        }
      >
        {active ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Receipt className="h-4 w-4" />
                {dateTime(active.createdAt)}
              </span>
              <StatusBadge status={active.status} dot />
            </div>

            <div className="divide-y divide-border/70">
              <SummaryRow label="Bridge Amount" value={naira(active.amount)} />
              <SummaryRow label="Service Fee" value={naira(active.fee)} />
              <SummaryRow
                label="You received"
                value={naira(active.netAmount)}
                hint="Paid in full — the fee was never taken out of your transfer"
                emphasis
                tone="primary"
              />
              <SummaryRow label="Destination Account" value={active.destination} />
              <SummaryRow
                label="Payroll Deduction"
                value={naira(active.settlementAmount)}
                hint={`${naira(active.amount)} + ${naira(active.fee)} fee · ${longDate(active.settlementDate)}`}
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Today to payday</p>
              <PaydayTimeline request={active} />
            </div>

            <InfoNote>
              Settlement happens automatically from your salary. You never need to make a payment yourself.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
