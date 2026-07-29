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
import { SelectField } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { nairaCompact, ratioPct, relativeTime, shortDate } from "@/lib/platform/format";
import { RISK_LEVELS } from "@/lib/platform/models";
import type { RiskAlert } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

const ALERT_STATUSES = ["Open", "Monitoring", "Mitigated", "Closed"] as const;
const ENTITY_TYPES = ["Employer", "Employee", "Investor", "Portfolio", "Transaction"] as const;

export default function OperationsRiskPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RiskAlert | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<RiskAlert["status"]>("Monitoring");

  const alerts = useQuery({ queryKey: qk.ops("risk"), queryFn: () => opsApi.riskAlerts() });
  const employers = useQuery({ queryKey: qk.ops("employers"), queryFn: () => opsApi.employers() });

  const update = useMutation({
    mutationFn: () => opsApi.setRiskStatus(selected?.id ?? "", nextStatus, actor),
    onSuccess: (alert) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("risk") });
      void queryClient.invalidateQueries({ queryKey: qk.ops("overview") });
      setSelected(alert);
      setStatusOpen(false);
      toast.success(`${alert.reference} set to ${nextStatus.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that alert"),
  });

  const rows = alerts.data ?? [];
  const open = rows.filter((row) => row.status === "Open");
  const critical = rows.filter((row) => row.level === "Critical" || row.level === "High");
  const exposure = (employers.data ?? [])
    .filter((employer) => employer.applicationStatus === "Approved")
    .sort((a, b) => ratioPct(b.utilisedLimit, b.approvedLimit) - ratioPct(a.utilisedLimit, a.approvedLimit))
    .slice(0, 5);

  const columns: Column<RiskAlert>[] = [
    {
      key: "title",
      header: "Alert",
      render: (row) => <CellStack primary={row.title} secondary={`${row.reference} · ${relativeTime(row.raisedAt)}`} />,
      sortValue: (row) => row.raisedAt,
    },
    {
      key: "entity",
      header: "Entity",
      hideBelow: "md",
      render: (row) => <CellStack primary={row.entity} secondary={row.entityType} />,
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
      key: "level",
      header: "Level",
      render: (row) => <RiskPill level={row.level} />,
      sortValue: (row) => RISK_LEVELS.indexOf(row.level),
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
        eyebrow="Risk"
        title="Exposure, limits and alerts"
        description="Where the platform is carrying the most risk, and what is being done about it."
      />

      <StatGrid columns={4}>
        <StatCard label="Open alerts" value={String(open.length)} tone="attention" />
        <StatCard label="High or critical" value={String(critical.length)} tone="attention" />
        <StatCard
          label="Monitoring"
          value={String(rows.filter((row) => row.status === "Monitoring").length)}
          tone="primary"
        />
        <StatCard
          label="Mitigated or closed"
          value={String(rows.filter((row) => row.status === "Mitigated" || row.status === "Closed").length)}
          tone="protected"
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Alerts by level" description="Distribution of everything currently on the register.">
          <div className="space-y-4">
            {/* Severity ramp, not the money palette — green here would read as
                "moderate risk is a good outcome". */}
            {RISK_LEVELS.map((level) => (
              <ProgressMeter
                key={level}
                value={ratioPct(rows.filter((row) => row.level === level).length, rows.length || 1)}
                label={level}
                right={`${rows.filter((row) => row.level === level).length} alerts`}
                tone={level === "Low" ? "protected" : level === "Moderate" ? "gold" : "danger"}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Highest limit utilisation" description="Employers closest to their approved limit.">
          {exposure.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No approved employers yet.</p>
          ) : (
            <div className="space-y-4">
              {exposure.map((employer) => (
                <ProgressMeter
                  key={employer.id}
                  value={ratioPct(employer.utilisedLimit, employer.approvedLimit)}
                  label={employer.name}
                  right={`${nairaCompact(employer.utilisedLimit)} of ${nairaCompact(employer.approvedLimit)}`}
                  tone={ratioPct(employer.utilisedLimit, employer.approvedLimit) > 80 ? "gold" : "primary"}
                />
              ))}
            </div>
          )}
          <InfoNote className="mt-4">
            Utilisation above 80% is reviewed before any further funding is released to that employer.
          </InfoNote>
        </Panel>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each entry on the risk register, with its level, the exposure affected and the action taken"
        search={(row) => `${row.reference} ${row.title} ${row.entity} ${row.detail} ${row.owner}`}
        searchPlaceholder="Search by alert, entity or owner"
        filters={[
          { key: "level", label: "Level", options: RISK_LEVELS, accessor: (row) => row.level },
          { key: "status", label: "Status", options: ALERT_STATUSES, accessor: (row) => row.status },
          { key: "entityType", label: "Entity", options: ENTITY_TYPES, accessor: (row) => row.entityType },
        ]}
        dateAccessor={(row) => row.raisedAt}
        isLoading={alerts.isLoading}
        isError={alerts.isError}
        onRetry={() => void alerts.refetch()}
        emptyTitle="No risk alerts"
        emptyBody="Alerts are raised automatically when exposure, limits or repayment behaviour move outside expected ranges."
        onRowClick={(row) => {
          setSelected(row);
          setNextStatus(row.status);
        }}
        initialSort={{ key: "level", direction: "desc" }}
        exportName="paybridge-risk-alerts"
        exportRow={(row) => ({
          Reference: row.reference,
          Alert: row.title,
          Entity: row.entity,
          "Entity type": row.entityType,
          Level: row.level,
          Status: row.status,
          Owner: row.owner,
          Raised: shortDate(row.raisedAt),
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Risk alert"}
        description={selected?.reference}
        footer={<ActionButton onClick={() => setStatusOpen(true)}>Update status</ActionButton>}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Entity" value={`${selected.entity} · ${selected.entityType}`} />
              <SummaryRow label="Level" value={<RiskPill level={selected.level} />} />
              <SummaryRow label="Status" value={<StatusBadge status={selected.status} />} />
              <SummaryRow label="Owner" value={selected.owner} />
              <SummaryRow label="Raised" value={shortDate(selected.raisedAt)} />
            </div>
            <p className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
              {selected.detail}
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => update.mutate()}
        title="Update risk alert"
        description={selected ? `${selected.reference} · ${selected.entity}.` : undefined}
        confirmLabel="Apply status"
        loading={update.isPending}
      >
        <SelectField
          label="Alert status"
          value={nextStatus}
          onChange={(value) => setNextStatus(value as RiskAlert["status"])}
          options={ALERT_STATUSES.map((value) => ({ value, label: value }))}
        />
      </ConfirmDialog>
    </div>
  );
}
