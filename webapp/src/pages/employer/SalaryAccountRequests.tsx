import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { shortDate, salaryAccountStatusLabel } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import type { SalaryAccountRequest } from "@/lib/platform/models";
import { LiveModeTabs } from "@/components/employer/LiveModeTabs";
import RealSalaryAccountRequests from "@/pages/employer-portal/SalaryAccountRequests";

const FLOW_STAGES = [
  "Employer Payroll System",
  "Normal Salary Calculation",
  "Participating Employee's PayBridge Salary Account",
  "Applicable PayBridge Settlement",
  "Remaining Salary",
  "Employee's Existing Bank Account",
];

function ExistingPayrollModel() {
  return (
    <Panel
      title="Existing Payroll Model"
      description="For employers using their existing payroll system."
    >
      <ol className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
        {FLOW_STAGES.map((stage, i) => (
          <li key={stage} className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs font-semibold text-foreground sm:text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              {stage}
            </span>
            {i < FLOW_STAGES.length - 1 ? (
              <ArrowRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-muted-foreground lg:rotate-0" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm font-medium text-foreground">
        PayBridge is designed to sit around payroll, not create another payroll.
      </p>
    </Panel>
  );
}

export default function SalaryAccountRequestsPage() {
  const employerId = useAccountId("employer");
  const requests = useQuery({
    queryKey: qk.employerSalaryAccountRequests(employerId),
    queryFn: () => employerApi.salaryAccountRequests(employerId),
  });

  const columns: Column<SalaryAccountRequest>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => <CellStack primary={row.employeeName} secondary={row.staffId} />,
      sortValue: (row) => row.employeeName,
    },
    {
      key: "current",
      header: "Current Salary Account",
      hideBelow: "md",
      render: (row) => <CellStack primary={row.currentBank} secondary={row.currentAccountMasked} />,
    },
    {
      key: "new",
      header: "New PayBridge Salary Account",
      render: (row) => <CellStack primary={row.newPartnerBank} secondary={row.newAccountMasked} />,
    },
    {
      key: "requestedAt",
      header: "Request Date",
      hideBelow: "sm",
      render: (row) => shortDate(row.requestedAt),
      sortValue: (row) => row.requestedAt,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={salaryAccountStatusLabel(row.status)} />,
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (row) => (
        <ActionButton to={`/employer/salary-account-requests/${row.id}`} size="sm" variant="ghost">
          {row.status === "pending_review" ? "Review Request" : "View"}
        </ActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll Setup · Option A"
        title="Salary Account Requests"
        description="Employees who have activated PayBridge Access and requested a change of salary account. Your payroll process does not change — only the destination account for participating employees."
        actions={
          <ActionButton to="/employer" variant="ghost">
            Back to overview
          </ActionButton>
        }
      />

      <LiveModeTabs
        gateTitle="Company sign-in required"
        gateDescription="Sign in to your company's PayBridge account to see your real Salary Account requests instead of demo data."
        live={<RealSalaryAccountRequests />}
        demo={
          <>
            <ExistingPayrollModel />

            <Panel title="Requests">
              <DataTable
                rows={requests.data ?? []}
                columns={columns}
                getRowId={(row) => row.id}
                caption="Salary Account change requests"
                isLoading={requests.isLoading}
                isError={requests.isError}
                onRetry={() => void requests.refetch()}
                emptyTitle="No Salary Account requests yet"
                emptyBody="Requests appear here as employees activate PayBridge Access."
              />
            </Panel>
          </>
        }
      />
    </div>
  );
}
