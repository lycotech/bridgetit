import { ClipboardCheck, Clock3, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack, type Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useEmployerSession } from "@/lib/employer/session";
import {
  salaryAccountStatusLabel,
  useSalaryAccountRequests,
  type SalaryAccountRequestRow,
} from "@/lib/employer/salary-account";

const FLOW_STAGES = [
  "Employer Payroll System",
  "Normal Salary Calculation",
  "Participating Employee's PayBridge Salary Account",
  "Applicable PayBridge Settlement",
  "Remaining Salary",
  "Employee's Existing Bank Account",
];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Real counterpart of the demo-only mock "SalaryAccountRequests" page
 * (AGENTS.md §9) — lists real, database-backed requests instead of mock data.
 */
export default function EmployerPortalSalaryAccountRequests() {
  const session = useEmployerSession();
  const navigate = useNavigate();
  const requests = useSalaryAccountRequests(session.data?.authenticated ?? false);

  const rows = requests.data?.items ?? [];
  const pending = rows.filter((r) => r.status === "pending_review").length;
  const active = rows.filter((r) => r.status === "active").length;

  const columns: Column<SalaryAccountRequestRow>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => <CellStack primary={row.employeeName ?? row.staffRef} secondary={row.staffRef} />,
      sortValue: (row) => row.employeeName ?? row.staffRef,
    },
    {
      key: "new",
      header: "New PayBridge Salary Account",
      hideBelow: "md",
      render: (row) => <CellStack primary={row.newBankName} secondary={row.newAccountMasked} />,
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
        <ActionButton size="sm" variant="ghost" to={`/employer-portal/salary-account-requests/${row.id}`}>
          {row.status === "pending_review" ? "Review Request" : "View"}
        </ActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Account Requests"
        description="Employees who have activated PayBridge Access and requested a change of salary account. Your payroll process does not change — only the destination account for participating employees."
      />

      <StatGrid columns={3}>
        <StatCard label="Awaiting your decision" value={pending} icon={<Clock3 className="h-4 w-4" />} tone={pending > 0 ? "attention" : "default"} />
        <StatCard label="Active" value={active} icon={<ThumbsUp className="h-4 w-4" />} tone="success" />
        <StatCard label="Total requests" value={rows.length} icon={<ClipboardCheck className="h-4 w-4" />} />
      </StatGrid>

      <Panel title="Existing Payroll Model" description="For employers using their existing payroll system.">
        <div className="flex flex-wrap items-center gap-2">
          {FLOW_STAGES.map((stage, i) => (
            <span key={stage} className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground">
                {stage}
              </span>
              {i < FLOW_STAGES.length - 1 ? <span className="text-muted-foreground">→</span> : null}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          PayBridge is designed to sit around payroll, not create another payroll.
        </p>
      </Panel>

      <Panel title="Requests">
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          isLoading={requests.isLoading}
          isError={requests.isError}
          onRetry={() => void requests.refetch()}
          onRowClick={(row) => navigate(`/employer-portal/salary-account-requests/${row.id}`)}
          emptyTitle="No Salary Account requests yet"
          emptyBody="Requests appear here as employees activate PayBridge Access."
          caption="Salary Account requests"
          initialSort={{ key: "requestedAt", direction: "desc" }}
        />
      </Panel>
    </div>
  );
}
