import { useState } from "react";
import { UserPlus } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { TextField } from "@/components/dashboard/forms";
import { useEmployerSession } from "@/lib/employer/session";
import { useInviteEmployeeLink, usePayrollEmployees } from "@/lib/employer/payroll";
import type { EmployeeRecordView } from "../../../../../backend/src/types";

/**
 * Real Employer Portal Employees — `/employer-portal/employees`. The real
 * roster (`EmployeeRecord`), with each row's eligibility for Access —
 * employer-safe subset only: no earned-wage amount, no draw history, same
 * privacy boundary `/api/auth/eligibility` uses for the employee themselves.
 */
export default function EmployerEmployees() {
  const session = useEmployerSession();
  const canWrite = session.data?.role !== "employer_viewer";
  const employees = usePayrollEmployees(session.data?.authenticated ?? false);
  const inviteLink = useInviteEmployeeLink();

  const [inviting, setInviting] = useState<EmployeeRecordView | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const rows = employees.data?.items ?? [];

  const submit = async () => {
    if (!inviting) return;
    setError(null);
    try {
      await inviteLink.mutateAsync({ employeeRecordId: inviting.id, email });
      setSent(inviting.id);
      setInviting(null);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That invitation could not be sent.");
    }
  };

  const columns: Column<EmployeeRecordView>[] = [
    {
      key: "name",
      header: "Employee",
      render: (row) => <CellStack primary={row.fullName ?? row.staffRef} secondary={row.jobTitle ?? row.department ?? row.staffRef} />,
      sortValue: (row) => row.fullName ?? row.staffRef,
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
    {
      key: "linked",
      header: "Account",
      render: (row) => (row.linked ? <StatusBadge status="Connected" /> : <StatusBadge status="Not linked" />),
      sortValue: (row) => String(row.linked),
    },
    {
      key: "eligible",
      header: "Access eligibility",
      render: (row) =>
        !row.linked ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <StatusBadge status={row.eligible ? "Eligible for Access" : row.kycApproved ? "KYC approved" : "KYC pending"} />
        ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) =>
        !row.linked && canWrite ? (
          <ActionButton size="sm" variant="ghost" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setInviting(row)}>
            {sent === row.id ? "Invited" : "Invite"}
          </ActionButton>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" description="Your real payroll roster, with account and eligibility status." />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every employee on your uploaded payroll roster"
        search={(row) => `${row.fullName ?? ""} ${row.staffRef} ${row.department ?? ""}`}
        searchPlaceholder="Search by name or reference"
        isLoading={employees.isPending}
        isError={employees.isError}
        onRetry={() => void employees.refetch()}
        emptyTitle="No employees yet"
        emptyBody="Upload a payroll file on the Payroll page to build your roster."
        initialSort={{ key: "name", direction: "desc" }}
      />

      <Modal
        open={Boolean(inviting)}
        onClose={() => setInviting(null)}
        title="Invite to link their account"
        description={inviting ? `Send ${inviting.fullName ?? inviting.staffRef} a link to connect their real PayBridge account to this payroll row.` : undefined}
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setInviting(null)}>
              Cancel
            </ActionButton>
            <ActionButton onClick={() => void submit()} loading={inviteLink.isPending} disabled={!email.includes("@")}>
              Send invite
            </ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <TextField label="Their email" type="email" value={email} onChange={setEmail} placeholder="name@example.com" inputMode="email" />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
