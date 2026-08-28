import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, ProgressMeter, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { Modal, ConfirmDialog } from "@/components/dashboard/Modal";
import { MoneyField, SelectField } from "@/components/dashboard/forms";
import { Stepper } from "@/components/dashboard/Stepper";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, ratioPct, shortDate } from "@/lib/platform/format";
import { EMPLOYER_APPLICATION_STATUSES, RISK_LEVELS } from "@/lib/platform/models";
import type { Employer, EmployerApplicationStatus } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";
import { LiveModeTabs } from "@/components/operations/LiveModeTabs";
import RealCreditRisk from "@/pages/admin/portal/CreditRisk";

const ONBOARDING_STEPS = ["Application", "Documents", "Review", "Credit assessment", "Live"];

export default function OperationsEmployersPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Employer | null>(null);
  const [nextStatus, setNextStatus] = useState<EmployerApplicationStatus>("Approved");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limit, setLimit] = useState(0);

  const employers = useQuery({ queryKey: qk.ops("employers"), queryFn: () => opsApi.employers() });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.ops("employers") });
    void queryClient.invalidateQueries({ queryKey: qk.ops("overview") });
  };

  const setStatus = useMutation({
    mutationFn: () => opsApi.setEmployerStatus(selected?.id ?? "", nextStatus, actor),
    onSuccess: (employer) => {
      invalidate();
      setSelected(employer);
      setConfirmOpen(false);
      toast.success(`${employer.name} set to ${nextStatus.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that employer"),
  });

  const setLimitMutation = useMutation({
    mutationFn: () => opsApi.setEmployerLimit(selected?.id ?? "", limit, actor),
    onSuccess: (employer) => {
      invalidate();
      setSelected(employer);
      setLimitOpen(false);
      toast.success(`Approved limit updated to ${naira(limit)}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that limit"),
  });

  const rows = employers.data ?? [];
  const approved = rows.filter((row) => row.applicationStatus === "Approved");
  const inQueue = rows.filter(
    (row) => row.applicationStatus !== "Approved" && row.applicationStatus !== "Rejected",
  );

  const columns: Column<Employer>[] = [
    {
      key: "name",
      header: "Employer",
      render: (row) => <CellStack primary={row.name} secondary={`${row.industry} · RC ${row.rcNumber}`} />,
      sortValue: (row) => row.name,
    },
    {
      key: "employees",
      header: "Employees",
      align: "right",
      hideBelow: "sm",
      render: (row) => (
        <CellStack
          primary={<span className="tnum">{row.employeeCount.toLocaleString("en-NG")}</span>}
          secondary={`${row.employeesUsingBridge} using Bridge`}
        />
      ),
      sortValue: (row) => row.employeeCount,
    },
    {
      key: "limit",
      header: "Approved limit",
      align: "right",
      hideBelow: "md",
      render: (row) => (
        <CellStack
          primary={<span className="tnum">{nairaCompact(row.approvedLimit)}</span>}
          secondary={`${ratioPct(row.utilisedLimit, row.approvedLimit)}% utilised`}
        />
      ),
      sortValue: (row) => row.approvedLimit,
    },
    {
      key: "payroll",
      header: "Next payroll",
      align: "right",
      hideBelow: "lg",
      render: (row) => (
        <CellStack
          primary={<span className="tnum">{nairaCompact(row.payrollObligation)}</span>}
          secondary={shortDate(row.nextPayrollDate)}
        />
      ),
      sortValue: (row) => row.nextPayrollDate,
    },
    {
      key: "risk",
      header: "Risk",
      hideBelow: "md",
      render: (row) => <RiskPill level={row.riskLevel} />,
      sortValue: (row) => row.riskLevel,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.applicationStatus} dot />,
      sortValue: (row) => row.applicationStatus,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employers"
        title="Employer onboarding and limits"
        description="Review applications, set approved limits and manage the status of every employer on the platform."
      />

      <LiveModeTabs
        gateTitle="Staff credentials required"
        gateDescription="Sign in with your PayBridge staff account to see the real employer risk register instead of demo data."
        live={<RealCreditRisk />}
        demo={
          <>
      <StatGrid columns={4}>
        <StatCard label="Employers live" value={String(approved.length)} tone="primary" />
        <StatCard label="In the queue" value={String(inQueue.length)} tone="attention" hint="Awaiting a decision" />
        <StatCard
          label="Total approved limits"
          value={nairaCompact(approved.reduce((sum, row) => sum + row.approvedLimit, 0))}
        />
        <StatCard
          label="Utilised"
          value={nairaCompact(approved.reduce((sum, row) => sum + row.utilisedLimit, 0))}
          tone="protected"
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Every employer on the platform, with onboarding stage, approved limit and current exposure"
        search={(row) => `${row.name} ${row.rcNumber} ${row.industry} ${row.contactName} ${row.applicationStatus}`}
        searchPlaceholder="Search by employer, RC number or contact"
        filters={[
          {
            key: "status",
            label: "Status",
            options: EMPLOYER_APPLICATION_STATUSES,
            accessor: (row) => row.applicationStatus,
          },
          { key: "risk", label: "Risk", options: RISK_LEVELS, accessor: (row) => row.riskLevel },
        ]}
        dateAccessor={(row) => row.createdAt}
        isLoading={employers.isLoading}
        isError={employers.isError}
        onRetry={() => void employers.refetch()}
        emptyTitle="No employers yet"
        emptyBody="Employer applications appear here as soon as they are submitted."
        onRowClick={(row) => {
          setSelected(row);
          setLimit(row.approvedLimit);
          setNextStatus(row.applicationStatus);
        }}
        initialSort={{ key: "name", direction: "asc" }}
        exportName="paybridge-employers"
        exportRow={(row) => ({
          Employer: row.name,
          "RC number": row.rcNumber,
          Industry: row.industry,
          Employees: row.employeeCount,
          "Using Bridge": row.employeesUsingBridge,
          "Approved limit": row.approvedLimit,
          Utilised: row.utilisedLimit,
          Risk: row.riskLevel,
          Status: row.applicationStatus,
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Employer"}
        description="Onboarding progress, exposure and the actions available to you."
        size="wide"
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setLimitOpen(true)}>
              Adjust limit
            </ActionButton>
            <ActionButton onClick={() => setConfirmOpen(true)}>Change status</ActionButton>
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <Stepper steps={ONBOARDING_STEPS} current={selected.onboardingStep} />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Status" value={<StatusBadge status={selected.applicationStatus} />} />
                <SummaryRow label="Risk level" value={<RiskPill level={selected.riskLevel} />} />
                <SummaryRow label="RC number" value={selected.rcNumber} />
                <SummaryRow label="Industry" value={selected.industry} />
                <SummaryRow label="Primary contact" value={selected.contactName} />
                <SummaryRow label="Contact email" value={selected.contactEmail} />
                <SummaryRow label="Applied" value={shortDate(selected.createdAt)} />
              </div>
              <div className="divide-y divide-border/70">
                <SummaryRow label="Employees" value={selected.employeeCount.toLocaleString("en-NG")} />
                <SummaryRow label="Active on PayBridge" value={selected.activeEmployees.toLocaleString("en-NG")} />
                <SummaryRow label="Using Bridge" value={String(selected.employeesUsingBridge)} />
                <SummaryRow label="Payroll obligation" value={naira(selected.payrollObligation)} />
                <SummaryRow label="Funds confirmed" value={naira(selected.payrollFundsConfirmed)} />
                <SummaryRow label="Payroll day" value={`Day ${selected.payrollDay}`} />
                <SummaryRow
                  label="Approved limit"
                  value={naira(selected.approvedLimit)}
                  emphasis
                  tone="primary"
                />
              </div>
            </div>
            <ProgressMeter
              value={ratioPct(selected.utilisedLimit, selected.approvedLimit)}
              label="Limit utilisation"
              right={`${naira(selected.utilisedLimit)} of ${naira(selected.approvedLimit)}`}
            />
            <InfoNote>
              Limit and status changes take effect immediately for the employer and are written to the audit log.
            </InfoNote>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="Adjust approved limit"
        description={selected ? `Applies to ${selected.name}.` : undefined}
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setLimitOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={setLimitMutation.isPending}
              disabled={limit <= 0}
              onClick={() => setLimitMutation.mutate()}
            >
              Save limit
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <MoneyField
            label="Approved limit"
            value={limit}
            onChange={setLimit}
            quickAmounts={[10_000_000, 20_000_000, 50_000_000]}
            hint="The maximum exposure PayBridge will carry for this employer."
          />
          <div className="divide-y divide-border/70">
            <SummaryRow label="Currently utilised" value={naira(selected?.utilisedLimit ?? 0)} />
            <SummaryRow
              label="Headroom after change"
              value={naira(Math.max(0, limit - (selected?.utilisedLimit ?? 0)))}
              emphasis
              tone="primary"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setStatus.mutate()}
        title="Change employer status"
        description={
          selected
            ? `${selected.name} will move to the status you select. The employer is notified automatically.`
            : undefined
        }
        confirmLabel="Apply status"
        loading={setStatus.isPending}
        tone={nextStatus === "Rejected" || nextStatus === "Suspended" ? "danger" : "primary"}
      >
        <SelectField
          label="New status"
          value={nextStatus}
          onChange={(value) => setNextStatus(value as EmployerApplicationStatus)}
          options={EMPLOYER_APPLICATION_STATUSES.map((value) => ({ value, label: value }))}
        />
      </ConfirmDialog>
          </>
        }
      />
    </div>
  );
}
