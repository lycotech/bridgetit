import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote, SummaryRow } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { LoadingRows } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { MoneyField, SelectField, TextField } from "@/components/dashboard/forms";
import { payrollApi, qk } from "@/lib/platform/mock-service";
import { dateTime, naira } from "@/lib/platform/format";
import type { PayrollIntegration, PayrollSyncEvent } from "@/lib/platform/models";
import { useAccountId, useActorName } from "@/lib/platform/use-account";

/** Ways payroll data can reach PayBridge. No single provider is privileged. */
const METHODS = [
  { title: "REST API", body: "Push records as they change, or let PayBridge pull on a schedule." },
  { title: "Secure CSV", body: "Encrypted upload through the portal, validated on arrival." },
  { title: "Scheduled SFTP", body: "Drop a file; PayBridge collects, validates and reconciles it." },
  { title: "Webhooks", body: "Notify PayBridge the moment payroll or HR data changes." },
  { title: "Payroll and HRIS connectors", body: "Pre-built mappings into the PayBridge payroll model." },
  { title: "Manual portal entry", body: "Always available as a fallback — no integration required." },
];

type DemoScenario =
  | "salary-increase"
  | "salary-reduction"
  | "unpaid-leave"
  | "new-joiner"
  | "leaver"
  | "suspension"
  | "new-deduction"
  | "late-file";

const DEMO_SCENARIOS: { key: DemoScenario; title: string; body: string }[] = [
  {
    key: "salary-increase",
    title: "1 · Mid-cycle salary increase",
    body: "Net pay rises. Earned pay recalculates from the effective date once you confirm.",
  },
  {
    key: "salary-reduction",
    title: "2 · Salary reduction",
    body: "Critical. New availability pauses until you confirm, so nobody over-accesses.",
  },
  {
    key: "unpaid-leave",
    title: "3 · Unpaid leave taken",
    body: "Four days removed from the eligible working days, lowering the daily accrual.",
  },
  {
    key: "new-joiner",
    title: "4 · New joiner on probation",
    body: "Accrual starts under your probation rule rather than automatically.",
  },
  {
    key: "leaver",
    title: "5 · Employee resigns",
    body: "Notice period. Accrual stops and outstanding settlement is scheduled for final pay.",
  },
  {
    key: "suspension",
    title: "6 · Suspension without pay",
    body: "Critical. Accrual pauses immediately; money already disbursed is untouched.",
  },
  {
    key: "new-deduction",
    title: "7 · New loan deduction",
    body: "A protected commitment reduces bridgeable pay without reducing net salary.",
  },
  {
    key: "late-file",
    title: "8 · Payroll file not received",
    body: "Your fallback rule applies for the grace period, then accrual stops.",
  },
];

export default function PayrollIntegrationsPage() {
  const employerId = useAccountId("employer");
  const actor = useActorName();
  const queryClient = useQueryClient();

  const [simulateOpen, setSimulateOpen] = useState(false);
  const [scenario, setScenario] = useState("attendance");
  const [employeeRef, setEmployeeRef] = useState("");
  const [days, setDays] = useState("4");
  const [amount, setAmount] = useState(600_000);
  const [label, setLabel] = useState("Cooperative loan");

  const integrations = useQuery({
    queryKey: qk.payrollIntegrations(employerId),
    queryFn: () => payrollApi.integrations(employerId),
  });
  const events = useQuery({
    queryKey: [...qk.payrollIntegrations(employerId), "events"],
    queryFn: () => payrollApi.syncEvents(employerId),
  });
  const connectors = useQuery({
    queryKey: ["payroll", "connectors"],
    queryFn: () => payrollApi.connectors(),
  });
  const records = useQuery({
    queryKey: qk.payrollRecords(employerId),
    queryFn: () => payrollApi.records(employerId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.payrollIntegrations(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.payrollExceptions(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.payrollCommandCentre(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.payrollRecords(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.employerEmployees(employerId) });
  };

  const sync = useMutation({
    mutationFn: (id: string) => payrollApi.runSync(id, actor),
    onSuccess: (event) => {
      invalidate();
      toast.success(`${event.integrationName}: ${event.message}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const simulate = useMutation({
    mutationFn: () => {
      const employeeId = employeeRef || records.data?.[0]?.employeeId || "";
      switch (scenario) {
        case "attendance":
          return payrollApi.attendanceUpdate({
            employeeId,
            unpaidLeaveDays: Number(days) || 0,
            actor,
          });
        case "salary":
          return payrollApi.salaryAdjustment({
            employeeId,
            newGross: amount,
            reason: "Salary review",
            actor,
          });
        case "deduction":
          return payrollApi.deductionUpdate({
            employeeId,
            label,
            kind: "Variable",
            amount,
            actor,
          });
        case "status":
          return payrollApi.employmentStatusChange({ employeeId, status: "Suspended", actor });
        default:
          return payrollApi.reportLateFile(employerId, actor);
      }
    },
    onSuccess: (exception) => {
      invalidate();
      setSimulateOpen(false);
      toast.success(`Exception raised: ${exception.type}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Eight one-click demo scenarios — the same code path a real feed takes. */
  const runScenario = useMutation({
    mutationFn: (key: DemoScenario) => {
      const record = records.data?.[0];
      const employeeId = record?.employeeId ?? "";
      const gross = record?.grossSalary ?? 400_000;
      switch (key) {
        case "salary-increase":
          return payrollApi.salaryAdjustment({
            employeeId,
            newGross: Math.round(gross * 1.15),
            reason: "Annual salary review",
            actor,
          });
        case "salary-reduction":
          return payrollApi.salaryAdjustment({
            employeeId,
            newGross: Math.round(gross * 0.85),
            reason: "Role change",
            actor,
          });
        case "unpaid-leave":
          return payrollApi.attendanceUpdate({ employeeId, unpaidLeaveDays: 4, actor });
        case "new-joiner":
          return payrollApi.employmentStatusChange({ employeeId, status: "Probation", actor });
        case "leaver":
          return payrollApi.employmentStatusChange({ employeeId, status: "Notice period", actor });
        case "suspension":
          return payrollApi.employmentStatusChange({ employeeId, status: "Suspended", actor });
        case "new-deduction":
          return payrollApi.deductionUpdate({
            employeeId,
            label: "Cooperative loan",
            kind: "Commitment",
            amount: 45_000,
            actor,
          });
        default:
          return payrollApi.reportLateFile(employerId, actor);
      }
    },
    onSuccess: (exception) => {
      invalidate();
      toast.success(`Exception raised: ${exception.type}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = integrations.data ?? [];
  const connected = rows.filter((row) => row.status === "Connected").length;
  const failing = rows.filter((row) => row.status === "Failed" || row.status === "Degraded").length;

  const eventColumns: Column<PayrollSyncEvent>[] = [
    {
      key: "integration",
      header: "Connection",
      render: (row) => <CellStack primary={row.integrationName} secondary={row.method} />,
      sortValue: (row) => row.integrationName,
    },
    {
      key: "at",
      header: "When",
      render: (row) => <span className="text-muted-foreground">{dateTime(row.at)}</span>,
      sortValue: (row) => row.at,
    },
    {
      key: "records",
      header: "Records",
      align: "right",
      hideBelow: "sm",
      render: (row) => <span className="tnum">{row.records}</span>,
      sortValue: (row) => row.records,
    },
    {
      key: "exceptions",
      header: "Exceptions",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum">{row.exceptionsRaised}</span>,
      sortValue: (row) => row.exceptionsRaised,
    },
    {
      key: "message",
      header: "Result",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.message}</span>,
      sortValue: (row) => row.message,
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
        title="Payroll connections"
        description="However your payroll data lives today, PayBridge maps it into one normalised model."
        actions={
          <ActionButton variant="secondary" icon={<PlugZap className="h-4 w-4" />} onClick={() => setSimulateOpen(true)}>
            Simulate payroll event
          </ActionButton>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Connections" value={String(rows.length)} icon={<Cable className="h-4 w-4" />} />
        <StatCard label="Healthy" value={String(connected)} tone="primary" />
        <StatCard label="Needing attention" value={String(failing)} tone={failing ? "attention" : "protected"} />
        <StatCard label="Records last sync" value={String(rows.reduce((sum, r) => sum + r.recordsLastSync, 0))} />
      </StatGrid>

      <Panel title="Your connections" description="Every source that feeds the PayBridge payroll model.">
        {integrations.isLoading ? (
          <LoadingRows rows={4} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onSync={() => sync.mutate(integration.id)}
                syncing={sync.isPending && sync.variables === integration.id}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Available connectors"
        description="Ready to configure. Adding a provider is configuration, not a rebuild."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(connectors.data ?? []).map((connector) => (
            <div key={connector.name} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{connector.name}</p>
                <span className="shrink-0 rounded-full border border-border bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {connector.category}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{connector.note}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Ways to send payroll data" description="Pick whichever fits your team. You can combine them.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METHODS.map((method) => (
            <div key={method.title} className="rounded-2xl border border-border bg-secondary/40 p-4">
              <p className="text-sm font-bold text-foreground">{method.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{method.body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <DataTable
        rows={events.data ?? []}
        columns={eventColumns}
        getRowId={(row) => row.id}
        caption="Every payroll source connected to PayBridge, with how it syncs and when it last ran"
        search={(row) => `${row.integrationName} ${row.message} ${row.status}`}
        searchPlaceholder="Search sync history"
        isLoading={events.isLoading}
        isError={events.isError}
        onRetry={() => void events.refetch()}
        emptyTitle="No syncs yet"
        emptyBody="Sync history appears here once a connection runs."
        initialSort={{ key: "at", direction: "desc" }}
        exportName="paybridge-payroll-sync-history"
        exportRow={(row) => ({
          Connection: row.integrationName,
          Method: row.method,
          When: dateTime(row.at),
          Records: row.records,
          "Exceptions raised": row.exceptionsRaised,
          Status: row.status,
          Result: row.message,
        })}
      />

      <Panel
        title="Demo scenarios"
        description="Eight payroll events, each one click. They run through the same exception engine a live feed uses."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_SCENARIOS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={runScenario.isPending}
              onClick={() => runScenario.mutate(item.key)}
              className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] disabled:opacity-60"
            >
              <p className="text-sm font-bold text-foreground">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
            </button>
          ))}
        </div>
        <InfoNote className="mt-4">
          Sandbox only. Each scenario raises a real exception in this demo environment against the first
          employee in your payroll records — review it in the exceptions inbox.
        </InfoNote>
      </Panel>

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          What PayBridge receives
        </span>{" "}
        — payroll and employment facts only. Nothing about how your employees use their pay ever travels back
        into your systems.
      </InfoNote>

      <Modal
        open={simulateOpen}
        onClose={() => setSimulateOpen(false)}
        title="Simulate a payroll event"
        description="Sandbox only. Sends a change into the exception engine so you can see how review works."
        footer={
          <ActionButton onClick={() => simulate.mutate()} loading={simulate.isPending}>
            Send event
          </ActionButton>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Event"
            value={scenario}
            onChange={setScenario}
            options={[
              { value: "attendance", label: "Unpaid leave recorded" },
              { value: "salary", label: "Salary changed" },
              { value: "deduction", label: "New deduction added" },
              { value: "status", label: "Employee suspended" },
              { value: "late", label: "Payroll file not received" },
            ]}
          />
          {scenario !== "late" ? (
            <SelectField
              label="Employee"
              value={employeeRef || records.data?.[0]?.employeeId || ""}
              onChange={setEmployeeRef}
              options={(records.data ?? []).map((record) => ({
                value: record.employeeId,
                label: `${record.fullName} · ${record.payrollId}`,
              }))}
            />
          ) : null}
          {scenario === "attendance" ? (
            <TextField label="Unpaid leave days" value={days} onChange={setDays} inputMode="numeric" />
          ) : null}
          {scenario === "salary" ? (
            <MoneyField label="New gross salary" value={amount} onChange={setAmount} hint="Monthly, before deductions" />
          ) : null}
          {scenario === "deduction" ? (
            <>
              <TextField label="Deduction name" value={label} onChange={setLabel} />
              <MoneyField label="Monthly amount" value={amount} onChange={setAmount} />
            </>
          ) : null}
          <InfoNote>
            This is a sandbox connection. Real integrations follow the same path: data arrives, the engine
            recalculates net earnings, and anything that changed becomes an exception for review.
          </InfoNote>
        </div>
      </Modal>
    </div>
  );
}

function IntegrationCard({
  integration,
  onSync,
  syncing,
}: {
  integration: PayrollIntegration;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground">{integration.name}</p>
            {integration.demo ? (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {integration.status === "Sandbox" ? "Sandbox connection" : "Demo integration"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {integration.vendor} · {integration.category} · {integration.method}
          </p>
        </div>
        <StatusBadge status={integration.status} />
      </div>

      <div className="mt-3 divide-y divide-border/70">
        <SummaryRow label="Schedule" value={integration.schedule} />
        <SummaryRow label="Last sync" value={integration.lastSyncAt ? dateTime(integration.lastSyncAt) : "Never"} />
        <SummaryRow label="Next sync" value={integration.nextSyncAt ? dateTime(integration.nextSyncAt) : "On demand"} />
        <SummaryRow label="Records last sync" value={String(integration.recordsLastSync)} />
        <SummaryRow label="Uptime" value={`${integration.uptimePct}%`} />
      </div>

      {integration.errorMessage ? (
        <InfoNote tone="attention" className="mt-3">
          {integration.errorMessage}
        </InfoNote>
      ) : null}

      <div className="mt-3">
        <ActionButton
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={onSync}
          loading={syncing}
        >
          Run sync now
        </ActionButton>
      </div>
    </div>
  );
}
