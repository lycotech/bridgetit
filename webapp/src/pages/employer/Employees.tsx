import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { ConfirmDialog, Modal } from "@/components/dashboard/Modal";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira, pct, shortDate } from "@/lib/platform/format";
import { EMPLOYMENT_STATUSES, KYC_STATUSES } from "@/lib/platform/models";
import type { EmployerEmployeeRecord } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";
import { LiveModeTabs } from "@/components/employer/LiveModeTabs";
import RealEmployerPayroll from "@/pages/employer-portal/Payroll";

export default function EmployerEmployeesPage() {
  const employerId = useAccountId("employer");
  const queryClient = useQueryClient();
  const [active, setActive] = useState<EmployerEmployeeRecord | null>(null);
  const [confirming, setConfirming] = useState<EmployerEmployeeRecord | null>(null);

  const employees = useQuery({
    queryKey: qk.employerEmployees(employerId),
    queryFn: () => employerApi.employees(employerId),
  });

  const setEligibility = useMutation({
    mutationFn: (input: { id: string; eligible: boolean }) =>
      employerApi.setEligibility([input.id], input.eligible),
    onSuccess: (_count, input) => {
      void queryClient.invalidateQueries({ queryKey: qk.employerEmployees(employerId) });
      void queryClient.invalidateQueries({ queryKey: qk.employerOverview(employerId) });
      setConfirming(null);
      setActive(null);
      toast.success(input.eligible ? "Access restored" : "Access paused");
    },
  });

  const rows = employees.data ?? [];
  const eligibleCount = rows.filter((row) => row.eligible).length;
  const accruingCount = rows.filter((row) => row.accrualActive).length;

  const columns: Column<EmployerEmployeeRecord>[] = [
    {
      key: "name",
      header: "Employee",
      render: (row) => <CellStack primary={row.fullName} secondary={row.payrollId} />,
      sortValue: (row) => row.fullName,
    },
    {
      key: "department",
      header: "Department",
      hideBelow: "md",
      render: (row) => <CellStack primary={row.department} secondary={row.jobTitle} />,
      sortValue: (row) => row.department,
    },
    {
      key: "status",
      header: "Employment",
      hideBelow: "sm",
      render: (row) => <StatusBadge status={row.employmentStatus} />,
      sortValue: (row) => row.employmentStatus,
    },
    {
      key: "gross",
      header: "Gross salary",
      align: "right",
      hideBelow: "lg",
      render: (row) => <span className="tnum text-muted-foreground">{naira(row.monthlySalary)}</span>,
      sortValue: (row) => row.monthlySalary,
    },
    {
      key: "net",
      header: "Confirmed net",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.netSalary)}</span>,
      sortValue: (row) => row.netSalary,
    },
    {
      key: "accrual",
      header: "Accrual",
      render: (row) => <StatusBadge status={row.accrualActive ? "Active" : "Paused"} dot />,
      sortValue: (row) => (row.accrualActive ? "Active" : "Paused"),
    },
    {
      key: "kyc",
      header: "Verification",
      hideBelow: "lg",
      render: (row) => <StatusBadge status={row.kycStatus} />,
      sortValue: (row) => row.kycStatus,
    },
    {
      key: "eligible",
      header: "Access",
      hideBelow: "sm",
      render: (row) => <StatusBadge status={row.eligible ? "Active" : "Paused"} dot />,
      sortValue: (row) => (row.eligible ? "Active" : "Paused"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employees"
        title="Your people on PayBridge"
        description="Employment and payroll facts you already own. Eligibility is entirely yours to control."
      />

      <LiveModeTabs
        gateTitle="Company sign-in required"
        gateDescription="Sign in to your company's PayBridge account to see your real employee roster instead of demo data."
        live={<RealEmployerPayroll />}
        demo={
          <>
      <StatGrid columns={4}>
        <StatCard label="On payroll" value={String(rows.length)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Access active" value={String(eligibleCount)} tone="protected" />
        <StatCard label="Accruing normally" value={String(accruingCount)} tone="primary" />
        <StatCard
          label="Accrual paused"
          value={String(rows.length - accruingCount)}
          hint={pct(((rows.length - accruingCount) / Math.max(1, rows.length)) * 100)}
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every employee on your payroll, with their employment status and verification state"
        search={(row) => `${row.fullName} ${row.payrollId} ${row.department} ${row.jobTitle}`}
        searchPlaceholder="Search by name, payroll ID or department"
        filters={[
          {
            key: "department",
            label: "Department",
            options: Array.from(new Set(rows.map((row) => row.department))).sort(),
            accessor: (row) => row.department,
          },
          {
            key: "employment",
            label: "Employment",
            options: [...EMPLOYMENT_STATUSES],
            accessor: (row) => row.employmentStatus,
          },
          {
            key: "kyc",
            label: "Verification",
            options: KYC_STATUSES,
            accessor: (row) => row.kycStatus,
          },
          {
            key: "access",
            label: "Access",
            options: ["Active", "Paused"],
            accessor: (row) => (row.eligible ? "Active" : "Paused"),
          },
        ]}
        isLoading={employees.isLoading}
        isError={employees.isError}
        onRetry={() => void employees.refetch()}
        emptyTitle="No employees yet"
        emptyBody="Upload your payroll file to bring your team onto PayBridge."
        emptyAction={<ActionButton to="/employer/payroll">Go to payroll</ActionButton>}
        onRowClick={(row) => setActive(row)}
        exportName="paybridge-employees"
        exportRow={(row) => ({
          Name: row.fullName,
          "Payroll ID": row.payrollId,
          Department: row.department,
          "Job title": row.jobTitle,
          Employment: row.employmentStatus,
          "Gross salary": row.monthlySalary,
          "Confirmed net": row.netSalary,
          Accrual: row.accrualActive ? "Active" : "Paused",
          "Data source": row.dataSource,
          Verification: row.kycStatus,
          Access: row.eligible ? "Active" : "Paused",
        })}
      />

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          Employee privacy
        </span>{" "}
        — this list carries employment and payroll facts only. Whether an employee uses Bridge, how much or how
        often, along with their savings, investments and wellbeing, is never shared with you.
      </InfoNote>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.fullName ?? "Employee"}
        description={active ? `${active.payrollId} · ${active.jobTitle}` : undefined}
        size="wide"
        footer={
          active ? (
            <ActionButton
              variant={active.eligible ? "danger" : "primary"}
              onClick={() => setConfirming(active)}
            >
              {active.eligible ? "Pause Bridge access" : "Restore Bridge access"}
            </ActionButton>
          ) : null
        }
      >
        {active ? (
          <div className="space-y-5">
            <Panel title="Payroll record" className="border-0 bg-transparent p-0">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Department" value={active.department} />
                <SummaryRow label="Employment status" value={<StatusBadge status={active.employmentStatus} />} />
                <SummaryRow label="Gross salary" value={naira(active.monthlySalary)} />
                <SummaryRow
                  label="Confirmed net salary"
                  value={naira(active.netSalary)}
                  emphasis
                  tone="primary"
                  hint="Earned pay accrues from confirmed net, never gross"
                />
                <SummaryRow
                  label="Accrual"
                  value={<StatusBadge status={active.accrualActive ? "Active" : "Paused"} />}
                  hint={active.accrualNote}
                />
                <SummaryRow label="Next payday" value={longDate(active.nextPayday)} />
                <SummaryRow label="Data source" value={active.dataSource} />
                <SummaryRow label="Last updated" value={shortDate(active.lastUpdatedAt)} />
                <SummaryRow label="Verification" value={<StatusBadge status={active.kycStatus} />} />
                <SummaryRow
                  label="Bridge access"
                  value={<StatusBadge status={active.eligible ? "Active" : "Paused"} />}
                  hint={active.eligibilityNote}
                />
              </div>
            </Panel>
            <InfoNote>
              This is everything PayBridge shares with you for this employee — the payroll facts, and nothing
              about how they use their pay.
            </InfoNote>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={confirming?.eligible ? "Pause Bridge access?" : "Restore Bridge access?"}
        description={
          confirming?.eligible
            ? `${confirming.fullName} will no longer be able to access earned pay. Anything already bridged still settles from payroll as normal.`
            : `${confirming?.fullName ?? "This employee"} will be able to access their earned pay again from today.`
        }
        confirmLabel={confirming?.eligible ? "Pause access" : "Restore access"}
        tone={confirming?.eligible ? "danger" : "primary"}
        loading={setEligibility.isPending}
        onConfirm={() =>
          confirming && setEligibility.mutate({ id: confirming.id, eligible: !confirming.eligible })
        }
      />
          </>
        }
      />
    </div>
  );
}
