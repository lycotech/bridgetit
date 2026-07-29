import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, ProgressMeter, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { Modal, ConfirmDialog } from "@/components/dashboard/Modal";
import { SelectField, TextAreaField } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { daysBetween, ratioPct, shortDate } from "@/lib/platform/format";
import { COMPLIANCE_STATUSES, RISK_LEVELS } from "@/lib/platform/models";
import type { ComplianceCase, ComplianceStatus } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

const CASE_TYPES = [
  "KYC review",
  "KYB review",
  "Sanctions screening",
  "Transaction monitoring",
  "Complaint",
] as const;

export default function OperationsCompliancePage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ComplianceCase | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<ComplianceStatus>("In review");
  const [note, setNote] = useState("");

  const cases = useQuery({ queryKey: qk.ops("compliance"), queryFn: () => opsApi.complianceCases() });

  const update = useMutation({
    mutationFn: () => opsApi.setComplianceStatus(selected?.id ?? "", nextStatus, actor),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("compliance") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("overview") });
      setSelected(item);
      setStatusOpen(false);
      setNote("");
      toast.success(`${item.reference} set to ${nextStatus.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that case"),
  });

  const rows = cases.data ?? [];
  const today = new Date().toISOString();
  const open = rows.filter((row) => row.status === "Open" || row.status === "In review");
  const escalated = rows.filter((row) => row.status === "Escalated");
  const overdue = rows.filter(
    (row) => daysBetween(today, row.dueAt) < 0 && row.status !== "Cleared" && row.status !== "Reported",
  );

  const columns: Column<ComplianceCase>[] = [
    {
      key: "subject",
      header: "Case",
      render: (row) => <CellStack primary={row.subject} secondary={`${row.reference} · ${row.caseType}`} />,
      sortValue: (row) => row.openedAt,
    },
    {
      key: "entity",
      header: "Entity",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{row.entity}</span>,
      sortValue: (row) => row.entity,
    },
    {
      key: "owner",
      header: "Owner",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.owner}</span>,
      sortValue: (row) => row.owner,
    },
    {
      key: "due",
      header: "Due",
      hideBelow: "sm",
      render: (row) => {
        const days = daysBetween(today, row.dueAt);
        return (
          <CellStack
            primary={shortDate(row.dueAt)}
            secondary={days < 0 ? `${Math.abs(days)} days overdue` : `in ${days} days`}
          />
        );
      },
      sortValue: (row) => row.dueAt,
    },
    {
      key: "risk",
      header: "Risk",
      hideBelow: "md",
      render: (row) => <RiskPill level={row.riskLevel} />,
      sortValue: (row) => RISK_LEVELS.indexOf(row.riskLevel),
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
        eyebrow="Compliance"
        title="KYC, KYB, screening and monitoring"
        description="Every case on the compliance register, who owns it and when it is due."
      />

      <StatGrid columns={4}>
        <StatCard label="Open cases" value={String(open.length)} tone="primary" />
        <StatCard label="Escalated" value={String(escalated.length)} tone="attention" />
        <StatCard label="Past due" value={String(overdue.length)} tone="attention" />
        <StatCard
          label="Cleared or reported"
          value={String(rows.filter((row) => row.status === "Cleared" || row.status === "Reported").length)}
          tone="protected"
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Register by status" description="Where the caseload currently sits.">
          <div className="space-y-4">
            {COMPLIANCE_STATUSES.map((status) => (
              <ProgressMeter
                key={status}
                value={ratioPct(rows.filter((row) => row.status === status).length, rows.length || 1)}
                label={status}
                right={`${rows.filter((row) => row.status === status).length} cases`}
                tone={status === "Cleared" ? "protected" : status === "Escalated" ? "gold" : "primary"}
              />
            ))}
          </div>
        </Panel>

        <Panel title="By case type" description="What is generating compliance work.">
          <div className="space-y-4">
            {CASE_TYPES.map((type) => (
              <ProgressMeter
                key={type}
                value={ratioPct(rows.filter((row) => row.caseType === type).length, rows.length || 1)}
                label={type}
                right={`${rows.filter((row) => row.caseType === type).length} cases`}
                tone="available"
              />
            ))}
          </div>
          <InfoNote tone="primary" className="mt-4">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Regulatory record
            </span>{" "}
            — case notes and decisions are retained for the statutory period and are available to regulators on
            request.
          </InfoNote>
        </Panel>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each compliance case, with the type, the subject, the risk rating and its current stage"
        search={(row) => `${row.reference} ${row.subject} ${row.entity} ${row.caseType} ${row.owner} ${row.notes}`}
        searchPlaceholder="Search by case, entity or owner"
        filters={[
          { key: "status", label: "Status", options: COMPLIANCE_STATUSES, accessor: (row) => row.status },
          { key: "type", label: "Case type", options: CASE_TYPES, accessor: (row) => row.caseType },
          { key: "risk", label: "Risk", options: RISK_LEVELS, accessor: (row) => row.riskLevel },
        ]}
        dateAccessor={(row) => row.openedAt}
        isLoading={cases.isLoading}
        isError={cases.isError}
        onRetry={() => void cases.refetch()}
        emptyTitle="No compliance cases"
        emptyBody="Cases are opened automatically by screening and monitoring, or manually by a compliance officer."
        onRowClick={(row) => {
          setSelected(row);
          setNextStatus(row.status);
        }}
        initialSort={{ key: "due", direction: "asc" }}
        exportName="paybridge-compliance-register"
        exportRow={(row) => ({
          Reference: row.reference,
          Case: row.subject,
          Entity: row.entity,
          Type: row.caseType,
          Risk: row.riskLevel,
          Status: row.status,
          Owner: row.owner,
          Opened: shortDate(row.openedAt),
          Due: shortDate(row.dueAt),
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? "Compliance case"}
        description={selected ? `${selected.reference} · ${selected.caseType}` : undefined}
        footer={<ActionButton onClick={() => setStatusOpen(true)}>Update case</ActionButton>}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Entity" value={selected.entity} />
              <SummaryRow label="Case type" value={selected.caseType} />
              <SummaryRow label="Risk level" value={<RiskPill level={selected.riskLevel} />} />
              <SummaryRow label="Status" value={<StatusBadge status={selected.status} />} />
              <SummaryRow label="Owner" value={selected.owner} />
              <SummaryRow label="Opened" value={shortDate(selected.openedAt)} />
              <SummaryRow label="Due" value={shortDate(selected.dueAt)} />
            </div>
            <p className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
              {selected.notes}
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => update.mutate()}
        title="Update compliance case"
        description={selected ? `${selected.reference} · ${selected.entity}.` : undefined}
        confirmLabel="Apply update"
        loading={update.isPending}
        tone={nextStatus === "Reported" ? "danger" : "primary"}
      >
        <div className="space-y-4">
          <SelectField
            label="Case status"
            value={nextStatus}
            onChange={(value) => setNextStatus(value as ComplianceStatus)}
            options={COMPLIANCE_STATUSES.map((value) => ({ value, label: value }))}
          />
          <TextAreaField
            label="Case note"
            value={note}
            onChange={setNote}
            optional
            rows={3}
            placeholder="What did you check, and what did you conclude?"
            hint="Added to the case file and the audit log."
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
