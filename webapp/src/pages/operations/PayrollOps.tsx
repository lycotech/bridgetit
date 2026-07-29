import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Cable, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { payrollApi, qk } from "@/lib/platform/mock-service";
import { dateTime, naira, shortDate } from "@/lib/platform/format";
import type { PayrollException, PayrollOpsRow, PayrollSyncEvent } from "@/lib/platform/models";

type OpsSyncEvent = PayrollSyncEvent & { employerName: string };
type OpsException = PayrollException & { employerName: string };

export default function OpsPayrollPage() {
  const rows = useQuery({ queryKey: qk.ops("payroll-rows"), queryFn: () => payrollApi.opsRows() });
  const events = useQuery({
    queryKey: qk.ops("payroll-sync"),
    queryFn: () => payrollApi.opsSyncEvents(),
  });
  const exceptions = useQuery({
    queryKey: qk.ops("payroll-exceptions"),
    queryFn: () => payrollApi.opsExceptions(),
  });
  const audit = useQuery({
    queryKey: qk.ops("payroll-audit"),
    queryFn: () => payrollApi.payrollAudit(),
  });

  const list = rows.data ?? [];
  const failing = list.filter((row) => row.syncStatus !== "Healthy").length;
  const critical = list.reduce((sum, row) => sum + row.criticalExceptions, 0);
  const paused = list.reduce((sum, row) => sum + row.accrualsPaused, 0);
  const fundingGap = list.reduce((sum, row) => sum + row.fundingGap, 0);

  const columns: Column<PayrollOpsRow>[] = [
    {
      key: "employer",
      header: "Employer",
      render: (row) => <CellStack primary={row.employerName} secondary={`${row.mode} · ${row.periodLabel}`} />,
      sortValue: (row) => row.employerName,
    },
    {
      key: "stage",
      header: "Cycle stage",
      hideBelow: "lg",
      render: (row) => <CellStack primary={row.stage} secondary={`Payday ${shortDate(row.payday)}`} />,
      sortValue: (row) => row.stage,
    },
    {
      key: "sync",
      header: "Data feed",
      render: (row) => <StatusBadge status={row.syncStatus} />,
      sortValue: (row) => row.syncStatus,
    },
    {
      key: "uptime",
      header: "Uptime",
      align: "right",
      hideBelow: "lg",
      render: (row) => <span className="tnum text-muted-foreground">{row.uptimePct}%</span>,
      sortValue: (row) => row.uptimePct,
    },
    {
      key: "exceptions",
      header: "Exceptions",
      align: "right",
      render: (row) => (
        <span className="tnum">
          {row.openExceptions}
          {row.criticalExceptions ? (
            <span className="ml-1.5 text-xs text-gold">· {row.criticalExceptions} critical</span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.criticalExceptions * 1000 + row.openExceptions,
    },
    {
      key: "paused",
      header: "Paused",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum text-muted-foreground">{row.accrualsPaused}</span>,
      sortValue: (row) => row.accrualsPaused,
    },
    {
      key: "funding",
      header: "Funding gap",
      align: "right",
      hideBelow: "sm",
      render: (row) => (
        <span className={`tnum font-semibold ${row.fundingGap ? "text-gold" : "text-muted-foreground"}`}>
          {naira(row.fundingGap)}
        </span>
      ),
      sortValue: (row) => row.fundingGap,
    },
    {
      key: "settlement",
      header: "Settlement due",
      align: "right",
      hideBelow: "lg",
      render: (row) => <span className="tnum">{naira(row.settlementObligation)}</span>,
      sortValue: (row) => row.settlementObligation,
    },
  ];

  const eventColumns: Column<OpsSyncEvent>[] = [
    {
      key: "at",
      header: "When",
      render: (row) => <CellStack primary={dateTime(row.at)} secondary={row.employerName} />,
      sortValue: (row) => row.at,
    },
    {
      key: "integration",
      header: "Source",
      render: (row) => <CellStack primary={row.integrationName} secondary={row.method} />,
      sortValue: (row) => row.integrationName,
    },
    {
      key: "records",
      header: "Records",
      align: "right",
      hideBelow: "md",
      render: (row) => <span className="tnum">{row.records}</span>,
      sortValue: (row) => row.records,
    },
    {
      key: "raised",
      header: "Exceptions raised",
      align: "right",
      hideBelow: "lg",
      render: (row) => <span className="tnum text-muted-foreground">{row.exceptionsRaised}</span>,
      sortValue: (row) => row.exceptionsRaised,
    },
    {
      key: "status",
      header: "Result",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
  ];

  const exceptionColumns: Column<OpsException>[] = [
    {
      key: "employer",
      header: "Employer",
      render: (row) => <CellStack primary={row.employerName} secondary={row.reference} />,
      sortValue: (row) => row.employerName,
    },
    {
      key: "type",
      header: "Exception",
      render: (row) => <CellStack primary={row.type} secondary={`Raised ${shortDate(row.detectedAt)}`} />,
      sortValue: (row) => row.type,
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
      hideBelow: "md",
      render: (row) => <span className="text-sm text-muted-foreground">{shortDate(row.deadline)}</span>,
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
        eyebrow="Operations"
        title="Payroll integration monitoring"
        description="Every employer's payroll feed, exception backlog and funding position in one place."
      />

      <StatGrid columns={4}>
        <StatCard
          label="Employers monitored"
          value={String(list.length)}
          icon={<Cable className="h-4 w-4" />}
        />
        <StatCard
          label="Feeds needing attention"
          value={String(failing)}
          tone={failing ? "attention" : "protected"}
          hint="Late or failed syncs"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Critical exceptions"
          value={String(critical)}
          tone={critical ? "attention" : "protected"}
          hint={`${paused} employees with accrual paused`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard label="Total funding gap" value={naira(fundingGap)} tone={fundingGap ? "attention" : "default"} />
      </StatGrid>

      <DataTable
        rows={list}
        columns={columns}
        getRowId={(row) => row.employerId}
        caption="Each employer's payroll connection, with its sync health and last successful run"
        search={(row) => `${row.employerName} ${row.mode} ${row.stage}`}
        searchPlaceholder="Search employers"
        filters={[
          {
            key: "sync",
            label: "Data feed",
            options: ["Healthy", "Late", "Failed"],
            accessor: (row) => row.syncStatus,
          },
          {
            key: "mode",
            label: "Mode",
            options: ["Native payroll", "Integration", "Manual"],
            accessor: (row) => row.mode,
          },
        ]}
        isLoading={rows.isLoading}
        isError={rows.isError}
        onRetry={() => void rows.refetch()}
        emptyTitle="No employers on payroll yet"
        emptyBody="Approved employers appear here once their payroll period opens."
        initialSort={{ key: "exceptions", direction: "desc" }}
        exportName="paybridge-payroll-monitoring"
        exportRow={(row) => ({
          Employer: row.employerName,
          Mode: row.mode,
          Period: row.periodLabel,
          Stage: row.stage,
          "Data feed": row.syncStatus,
          "Uptime %": row.uptimePct,
          "Open exceptions": row.openExceptions,
          "Critical exceptions": row.criticalExceptions,
          "Accruals paused": row.accrualsPaused,
          "Funding gap": row.fundingGap,
          "Settlement due": row.settlementObligation,
        })}
      />

      <Panel
        title="Exception backlog"
        description="Open across every employer, soonest deadline first."
      >
        <DataTable
          rows={exceptions.data ?? []}
          columns={exceptionColumns}
          getRowId={(row) => row.id}
          caption="Every open payroll exception across all employers, with its severity and age"
          search={(row) => `${row.employerName} ${row.type} ${row.reference}`}
          searchPlaceholder="Search exceptions"
          isLoading={exceptions.isLoading}
          isError={exceptions.isError}
          onRetry={() => void exceptions.refetch()}
          emptyTitle="No open exceptions"
          emptyBody="Every employer is confirmed and accruing normally."
          pageSize={8}
        />
      </Panel>

      <Panel title="Sync history" description="Ingestion events across all connected payroll sources.">
        <DataTable
          rows={events.data ?? []}
          columns={eventColumns}
          getRowId={(row) => row.id}
          caption="Each payroll ingestion event, with the source, the records processed and the outcome"
          search={(row) => `${row.employerName} ${row.integrationName} ${row.message}`}
          searchPlaceholder="Search sync events"
          filters={[
            {
              key: "status",
              label: "Result",
              options: ["Success", "Partial", "Failed", "Late"],
              accessor: (row) => row.status,
            },
          ]}
          isLoading={events.isLoading}
          isError={events.isError}
          onRetry={() => void events.refetch()}
          emptyTitle="No sync events"
          emptyBody="Events appear as payroll data arrives."
          pageSize={8}
        />
      </Panel>

      <Panel
        title="Payroll audit trail"
        description="Append-only. Every confirmation, edit and pause is recorded with actor, role and time."
      >
        <div className="divide-y divide-border/70">
          {(audit.data ?? []).slice(0, 12).map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{log.action}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {log.entity} · {log.actor} ({log.actorRole}) · {log.ip}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{dateTime(log.at)}</span>
            </div>
          ))}
          {(audit.data ?? []).length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No payroll actions recorded yet.</p>
          ) : null}
        </div>
      </Panel>

      <InfoNote tone="primary">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          Monitoring, not surveillance
        </span>{" "}
        — operations sees payroll data quality, exception ageing and funding. Individual earned-pay behaviour
        is never exposed to employers, and audit entries can be added but never edited or deleted.
      </InfoNote>
    </div>
  );
}
