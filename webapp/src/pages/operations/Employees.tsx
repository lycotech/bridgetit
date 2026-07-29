import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, shortDate } from "@/lib/platform/format";
import { KYC_STATUSES } from "@/lib/platform/models";
import type { Employee } from "@/lib/platform/models";

export default function OperationsEmployeesPage() {
  const [selected, setSelected] = useState<Employee | null>(null);

  const employees = useQuery({ queryKey: qk.ops("employees"), queryFn: () => opsApi.employees() });

  const rows = employees.data ?? [];
  const verified = rows.filter((row) => row.kycStatus === "Verified");
  const bridging = rows.filter((row) => row.alreadyBridged > 0);

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      render: (row) => <CellStack primary={row.fullName} secondary={`${row.staffId} · ${row.employerName}`} />,
      sortValue: (row) => row.fullName,
    },
    {
      key: "role",
      header: "Role",
      hideBelow: "lg",
      render: (row) => <CellStack primary={row.jobTitle} secondary={row.department} />,
      sortValue: (row) => row.department,
    },
    {
      key: "salary",
      header: "Monthly salary",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum text-muted-foreground">{naira(row.monthlySalary)}</span>,
      sortValue: (row) => row.monthlySalary,
    },
    {
      key: "available",
      header: "Available to Bridge",
      align: "right",
      render: (row) => (
        <CellStack
          primary={
            <span className="font-semibold tnum">
              {naira(Math.max(0, row.availableToBridge - row.alreadyBridged))}
            </span>
          }
          secondary={`${naira(row.alreadyBridged)} bridged`}
        />
      ),
      sortValue: (row) => row.availableToBridge - row.alreadyBridged,
    },
    {
      key: "kyc",
      header: "KYC",
      hideBelow: "sm",
      render: (row) => <StatusBadge status={row.kycStatus} />,
      sortValue: (row) => row.kycStatus,
    },
    {
      key: "access",
      header: "Access",
      render: (row) => <StatusBadge status={row.eligible ? "Eligible" : "Paused"} dot />,
      sortValue: (row) => (row.eligible ? "Eligible" : "Paused"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employees"
        title="Employee records"
        description="Verification status, earned pay and Bridge access for every employee on the platform."
      />

      <StatGrid columns={4}>
        <StatCard label="Employee records" value={rows.length.toLocaleString("en-NG")} tone="primary" />
        <StatCard label="KYC verified" value={String(verified.length)} tone="protected" />
        <StatCard label="Bridged this cycle" value={String(bridging.length)} />
        <StatCard
          label="Earned pay available"
          value={nairaCompact(
            rows.reduce((sum, row) => sum + Math.max(0, row.availableToBridge - row.alreadyBridged), 0),
          )}
          hint="Across all employers"
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every employee on the platform, with verification status, earned pay and Bridge access"
        search={(row) => `${row.fullName} ${row.staffId} ${row.email} ${row.employerName} ${row.department}`}
        searchPlaceholder="Search by name, staff ID or employer"
        filters={[
          {
            key: "employer",
            label: "Employer",
            options: Array.from(new Set(rows.map((row) => row.employerName))),
            accessor: (row) => row.employerName,
          },
          { key: "kyc", label: "KYC", options: KYC_STATUSES, accessor: (row) => row.kycStatus },
          {
            key: "access",
            label: "Access",
            options: ["Eligible", "Paused"],
            accessor: (row) => (row.eligible ? "Eligible" : "Paused"),
          },
        ]}
        isLoading={employees.isLoading}
        isError={employees.isError}
        onRetry={() => void employees.refetch()}
        emptyTitle="No employee records"
        emptyBody="Employee records arrive with each employer's payroll upload."
        onRowClick={setSelected}
        initialSort={{ key: "name", direction: "asc" }}
        exportName="paybridge-employees"
        exportRow={(row) => ({
          Employee: row.fullName,
          "Staff ID": row.staffId,
          Employer: row.employerName,
          Department: row.department,
          "Monthly salary": row.monthlySalary,
          "Available to Bridge": Math.max(0, row.availableToBridge - row.alreadyBridged),
          "Already bridged": row.alreadyBridged,
          KYC: row.kycStatus,
          Access: row.eligible ? "Eligible" : "Paused",
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.fullName ?? "Employee"}
        description="Operational record used for verification and settlement."
      >
        {selected ? (
          <div className="space-y-4">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Staff ID" value={selected.staffId} />
              <SummaryRow label="Employer" value={selected.employerName} />
              <SummaryRow label="Department" value={`${selected.department} · ${selected.jobTitle}`} />
              <SummaryRow label="Email" value={selected.email} />
              <SummaryRow label="KYC status" value={<StatusBadge status={selected.kycStatus} />} />
              <SummaryRow label="Joined" value={shortDate(selected.joinedAt)} />
              <SummaryRow label="Monthly salary" value={naira(selected.monthlySalary)} />
              <SummaryRow label="Earned so far" value={naira(selected.accruedSalary)} />
              <SummaryRow label="Already bridged" value={naira(selected.alreadyBridged)} />
              <SummaryRow
                label="Available to Bridge"
                value={naira(Math.max(0, selected.availableToBridge - selected.alreadyBridged))}
                emphasis
                tone="primary"
              />
              <SummaryRow label="Next payday" value={shortDate(selected.nextPayday)} />
              <SummaryRow label="Bridge access" value={selected.eligible ? "Active" : "Paused"} />
            </div>
            {selected.eligibilityNote ? <InfoNote>{selected.eligibilityNote}</InfoNote> : null}
            <InfoNote tone="primary">
              Employees only ever access pay they have already earned. Access changes are made by the employer
              in their own dashboard.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
