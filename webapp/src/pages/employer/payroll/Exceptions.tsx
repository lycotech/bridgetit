import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCheck, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, InfoNote, SummaryRow } from "@/components/dashboard/Panel";
import { Modal } from "@/components/dashboard/Modal";
import { TextField, TextAreaField } from "@/components/dashboard/forms";
import { payrollApi, qk } from "@/lib/platform/mock-service";
import type { ExceptionAction } from "@/lib/platform/mock-service";
import { dateTime, shortDate } from "@/lib/platform/format";
import { EXCEPTION_SEVERITIES, EXCEPTION_STATUSES } from "@/lib/platform/models";
import type { PayrollException } from "@/lib/platform/models";
import { useAccountId, useActorName } from "@/lib/platform/use-account";
import { useAuth } from "@/lib/auth/auth-context";

const OPEN_STATUSES = ["Open", "In review", "Information requested", "Escalated"];

/** Actions offered on an exception, in the order a reviewer thinks about them. */
const ACTIONS: { action: ExceptionAction; label: string; variant: "primary" | "secondary" | "danger" | "ghost" }[] = [
  { action: "accept", label: "Accept change", variant: "primary" },
  { action: "edit", label: "Edit value", variant: "secondary" },
  { action: "request-info", label: "Request information", variant: "secondary" },
  { action: "pause-accrual", label: "Pause accrual", variant: "secondary" },
  { action: "resume-accrual", label: "Resume accrual", variant: "secondary" },
  { action: "mark-resolved", label: "Mark resolved", variant: "secondary" },
  { action: "escalate", label: "Escalate to PayBridge", variant: "ghost" },
  { action: "reject", label: "Reject", variant: "danger" },
];

export default function PayrollExceptionsPage() {
  const employerId = useAccountId("employer");
  const actor = useActorName();
  const { can } = useAuth();
  const canManage = can("employer.payroll.exceptions.manage");
  const queryClient = useQueryClient();

  const [active, setActive] = useState<PayrollException | null>(null);
  const [note, setNote] = useState("");
  const [newValue, setNewValue] = useState("");

  const exceptions = useQuery({
    queryKey: qk.payrollExceptions(employerId),
    queryFn: () => payrollApi.exceptions(employerId),
  });
  const health = useQuery({
    queryKey: [...qk.payrollExceptions(employerId), "health"],
    queryFn: () => payrollApi.health(employerId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.payrollExceptions(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.payrollCommandCentre(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.employerEmployees(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.payrollRecords(employerId) });
  };

  const resolve = useMutation({
    mutationFn: (input: { id: string; action: ExceptionAction }) =>
      payrollApi.resolveException({
        id: input.id,
        action: input.action,
        actor,
        note: note.trim() || undefined,
        newValue: newValue.trim() || undefined,
      }),
    onSuccess: (exception, input) => {
      invalidate();
      setActive(null);
      setNote("");
      setNewValue("");
      toast.success(`${exception.type} — ${input.action.replace("-", " ")}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkAccept = useMutation({
    mutationFn: () => payrollApi.bulkAcceptLowRisk(employerId, actor),
    onSuccess: (count) => {
      invalidate();
      toast.success(count ? `${count} low-risk exceptions accepted` : "Nothing low-risk to accept");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = exceptions.data ?? [];
  const open = rows.filter((row) => OPEN_STATUSES.includes(row.status));
  const critical = open.filter((row) => row.severity === "Critical");
  const lowRisk = open.filter((row) => row.severity === "Informational" && !row.pausesAccrual);
  const resolved = rows
    .filter((row) => row.resolvedAt)
    .sort((a, b) => +new Date(b.resolvedAt ?? 0) - +new Date(a.resolvedAt ?? 0))
    .slice(0, 8);

  const columns: Column<PayrollException>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (row) => <CellStack primary={row.employeeRef} secondary={row.employeeName ?? "All employees"} />,
      sortValue: (row) => row.employeeRef,
    },
    {
      key: "type",
      header: "Exception",
      render: (row) => <CellStack primary={row.type} secondary={row.reference} />,
      sortValue: (row) => row.type,
    },
    {
      key: "change",
      header: "Change",
      hideBelow: "lg",
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="line-through decoration-muted-foreground/50">{row.previousValue}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="font-semibold text-foreground">{row.newValue}</span>
        </span>
      ),
      sortValue: (row) => row.newValue,
    },
    {
      key: "effective",
      header: "Effective",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.effectiveDate)}</span>,
      sortValue: (row) => row.effectiveDate,
    },
    {
      key: "severity",
      header: "Severity",
      render: (row) => <StatusBadge status={row.severity} />,
      sortValue: (row) => row.severity,
    },
    {
      key: "deadline",
      header: "Deadline",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.deadline)}</span>,
      sortValue: (row) => row.deadline,
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
        eyebrow="PayBridge Payroll"
        title="Payroll exceptions"
        description="Confirm only what changed. Employees whose pay and status are unchanged keep accruing automatically."
        actions={
          canManage ? (
            <ActionButton
              variant="secondary"
              icon={<CheckCheck className="h-4 w-4" />}
              onClick={() => bulkAccept.mutate()}
              loading={bulkAccept.isPending}
              disabled={!lowRisk.length}
            >
              Accept {lowRisk.length} low-risk
            </ActionButton>
          ) : null
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Needs your attention" value={String(open.length)} tone={open.length ? "attention" : "default"} />
        <StatCard
          label="Critical"
          value={String(critical.length)}
          tone={critical.length ? "attention" : "protected"}
          hint="New availability paused until resolved"
        />
        <StatCard
          label="Accruing normally"
          value={String(health.data?.accruingNormally ?? 0)}
          tone="primary"
          hint="No action needed from you"
        />
        <StatCard label="Accrual paused" value={String(health.data?.accrualsPaused ?? 0)} />
      </StatGrid>

      {critical.length ? (
        <InfoNote tone="attention">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Critical exceptions pause new availability automatically
          </span>{" "}
          — earned pay already sent to an employee is never altered or reversed. Where a settlement can no longer
          be recovered in full, PayBridge operations handles reconciliation with you directly.
        </InfoNote>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each employee whose payroll record needs your confirmation, with the severity and what changed"
        search={(row) => `${row.employeeRef} ${row.employeeName ?? ""} ${row.type} ${row.reference}`}
        searchPlaceholder="Search by employee, type or reference"
        filters={[
          {
            key: "severity",
            label: "Severity",
            options: [...EXCEPTION_SEVERITIES],
            accessor: (row) => row.severity,
          },
          {
            key: "status",
            label: "Status",
            options: [...EXCEPTION_STATUSES],
            accessor: (row) => row.status,
          },
          {
            key: "source",
            label: "Source",
            options: Array.from(new Set(rows.map((row) => row.source))).sort(),
            accessor: (row) => row.source,
          },
        ]}
        dateAccessor={(row) => row.detectedAt}
        isLoading={exceptions.isLoading}
        isError={exceptions.isError}
        onRetry={() => void exceptions.refetch()}
        emptyTitle="No exceptions"
        emptyBody="Every payroll record matched what PayBridge already had. Nothing needs confirming."
        initialSort={{ key: "severity", direction: "asc" }}
        onRowClick={(row) => {
          setActive(row);
          setNote("");
          setNewValue(row.newValue);
        }}
        exportName="paybridge-payroll-exceptions"
        exportRow={(row) => ({
          Reference: row.reference,
          "Employee ID": row.employeeRef,
          Employee: row.employeeName ?? "",
          Type: row.type,
          Severity: row.severity,
          "Previous value": row.previousValue,
          "New value": row.newValue,
          "Effective date": shortDate(row.effectiveDate),
          Source: row.source,
          "Recommended action": row.recommendedAction,
          Deadline: shortDate(row.deadline),
          Status: row.status,
          Reviewer: row.assignedReviewer ?? "",
        })}
      />

      <Panel title="How exception review works" description="Three severities, three different expectations of you.">
        <div className="grid gap-3 sm:grid-cols-3">
          <SeverityCard
            severity="Informational"
            body="Recorded for your audit trail. Accrual continues. You can bulk accept these."
          />
          <SeverityCard
            severity="Review required"
            body="Confirm the change so accrual uses the right figures from the effective date."
          />
          <SeverityCard
            severity="Critical"
            body="New earned-pay availability pauses automatically until you resolve it."
          />
        </div>
      </Panel>

      <Panel
        title="Confirmation history"
        description="Append-only. Entries are added, never edited or deleted."
      >
        {resolved.length ? (
          <div className="divide-y divide-border/70">
            {resolved.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {row.type} · {row.previousValue} → {row.newValue}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.status} by {row.resolvedBy ?? "an administrator"} · {row.reference}
                    {row.resolutionNote ? ` · “${row.resolutionNote}”` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.resolvedAt ? dateTime(row.resolvedAt) : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing confirmed yet this period. Actions you take appear here with your name and the time.
          </p>
        )}
      </Panel>

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          What we never ask you to do
        </span>{" "}
        — approve an individual earned-pay request, or re-approve earnings that have not changed. Your payroll
        rules were approved once at onboarding and apply automatically from then on.
      </InfoNote>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.type ?? "Exception"}
        description={active ? `${active.reference} · ${active.employeeRef}` : undefined}
        size="wide"
        footer={
          active ? (
            canManage ? (
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((item) => (
                <ActionButton
                  key={item.action}
                  variant={item.variant}
                  size="sm"
                  loading={resolve.isPending}
                  onClick={() => resolve.mutate({ id: active.id, action: item.action })}
                >
                  {item.label}
                </ActionButton>
              ))}
            </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Your role can view exceptions but not confirm them. Ask a payroll or HR administrator to
                action this one.
              </p>
            )
          ) : null
        }
      >
        {active ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Recommended action
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{active.recommendedAction}</p>
            </div>

            <div className="divide-y divide-border/70">
              <SummaryRow label="Employee" value={active.employeeName ?? "All employees"} hint={active.employeeRef} />
              <SummaryRow label="Severity" value={<StatusBadge status={active.severity} />} />
              <SummaryRow label="Previous value" value={active.previousValue} />
              <SummaryRow label="New value" value={active.newValue} emphasis tone="primary" />
              <SummaryRow label="Effective date" value={shortDate(active.effectiveDate)} />
              <SummaryRow label="Data source" value={active.source} />
              <SummaryRow label="Detected" value={dateTime(active.detectedAt)} />
              <SummaryRow label="Deadline" value={shortDate(active.deadline)} />
              <SummaryRow label="Status" value={<StatusBadge status={active.status} />} />
              <SummaryRow label="Reviewer" value={active.assignedReviewer ?? "Unassigned"} />
              <SummaryRow
                label="Accrual"
                value={active.pausesAccrual ? "Paused by this exception" : "Continuing"}
                hint={
                  active.pausesAccrual
                    ? "Money already disbursed is unaffected and settles as scheduled"
                    : undefined
                }
              />
            </div>

            {active.resolvedAt ? (
              <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Audit trail
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  {active.status} by {active.resolvedBy ?? "an administrator"} on{" "}
                  {dateTime(active.resolvedAt)}.
                </p>
                {active.resolutionNote ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    “{active.resolutionNote}”
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  This record cannot be edited or deleted. Further changes are added as new entries.
                </p>
              </div>
            ) : null}

            <TextField
              label="Corrected value"
              value={newValue}
              onChange={setNewValue}
              hint="Used by Accept and Edit. Leave as-is to accept what payroll sent."
            />
            <TextAreaField
              label="Note for the audit trail"
              value={note}
              onChange={setNote}
              rows={3}
              optional
              placeholder="Why you accepted, rejected or paused this."
            />

            <InfoNote>
              <Info className="mr-1.5 inline h-3.5 w-3.5" />
              Every action here is recorded with your name, role, the previous value, the new value and the time.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function SeverityCard({ severity, body }: { severity: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <StatusBadge status={severity} />
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
