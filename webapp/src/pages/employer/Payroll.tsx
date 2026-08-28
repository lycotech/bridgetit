import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Panel, SummaryRow, InfoNote, ProgressMeter } from "@/components/dashboard/Panel";
import { Modal } from "@/components/dashboard/Modal";
import { MoneyField, SelectField, TextField, UploadDropzone } from "@/components/dashboard/forms";
import type { SimulatedFile } from "@/components/dashboard/forms";
import { AsyncPanel } from "@/components/dashboard/states";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { dateTime, naira, pct, shortDate } from "@/lib/platform/format";
import type { PayrollRun } from "@/lib/platform/models";
import { useAccountId, useActorName } from "@/lib/platform/use-account";
import { LiveModeTabs } from "@/components/employer/LiveModeTabs";
import RealEmployerPayroll from "@/pages/employer-portal/Payroll";

const PERIODS = ["July 2026", "August 2026", "September 2026"];
const KINDS = ["Payroll", "Accrued salary"] as const;

export default function EmployerPayrollPage() {
  const employerId = useAccountId("employer");
  const actor = useActorName();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [fundsOpen, setFundsOpen] = useState(false);
  const [period, setPeriod] = useState(PERIODS[1]);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Payroll");
  const [headcount, setHeadcount] = useState("284");
  const [gross, setGross] = useState(48_500_000);
  const [files, setFiles] = useState<SimulatedFile[]>([]);
  const [confirmedAmount, setConfirmedAmount] = useState(0);

  const overview = useQuery({
    queryKey: qk.employerOverview(employerId),
    queryFn: () => employerApi.overview(employerId),
  });
  const runs = useQuery({
    queryKey: qk.employerPayroll(employerId),
    queryFn: () => employerApi.payrollRuns(employerId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.employerPayroll(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.employerOverview(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.employerEmployees(employerId) });
  };

  const upload = useMutation({
    mutationFn: () =>
      employerApi.uploadPayroll({
        employerId,
        period,
        fileName: files[0]?.name ?? "payroll.csv",
        headcount: Number(headcount) || 0,
        grossAmount: gross,
        uploadedBy: actor,
        kind,
      }),
    onSuccess: (run) => {
      invalidate();
      setUploadOpen(false);
      setFiles([]);
      toast.success(
        run.flaggedRecords
          ? `${run.matchedRecords} records matched, ${run.flaggedRecords} need a second look`
          : `${run.matchedRecords} records matched`,
      );
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not process that file"),
  });

  const confirmFunds = useMutation({
    mutationFn: () => employerApi.confirmPayrollFunds(employerId, confirmedAmount),
    onSuccess: () => {
      invalidate();
      setFundsOpen(false);
      toast.success("Payroll funds confirmed");
    },
  });

  const columns: Column<PayrollRun>[] = [
    {
      key: "period",
      header: "Period",
      render: (row) => <CellStack primary={row.period} secondary={shortDate(row.uploadedAt)} />,
      sortValue: (row) => row.uploadedAt,
    },
    {
      key: "headcount",
      header: "Records",
      align: "right",
      render: (row) => <span className="tnum">{row.headcount}</span>,
      sortValue: (row) => row.headcount,
    },
    {
      key: "gross",
      header: "Gross amount",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{naira(row.grossAmount)}</span>,
      sortValue: (row) => row.grossAmount,
    },
    {
      key: "matched",
      header: "Matched",
      align: "right",
      hideBelow: "md",
      render: (row) => (
        <span className="tnum">
          {row.matchedRecords}
          {row.flaggedRecords ? (
            <span className="ml-1.5 text-xs text-gold">· {row.flaggedRecords} flagged</span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.matchedRecords,
    },
    {
      key: "uploadedBy",
      header: "Uploaded by",
      hideBelow: "lg",
      render: (row) => <CellStack primary={row.uploadedBy} secondary={dateTime(row.uploadedAt)} />,
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
        title="Payroll files and funding"
        description="Upload your payroll or accrued-salary file, then confirm the funds you have in place. Anything that changed becomes an exception to review."
        actions={
          <>
            <ActionButton variant="secondary" onClick={() => setFundsOpen(true)}>
              Confirm funds
            </ActionButton>
            <ActionButton icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
              Upload file
            </ActionButton>
          </>
        }
      />

      <LiveModeTabs
        gateTitle="Company sign-in required"
        gateDescription="Sign in to your company's PayBridge account to see your real payroll cycles instead of demo data."
        live={<RealEmployerPayroll />}
        demo={
          <>
      <AsyncPanel query={overview}>
        {(data) => {
          const fundedPct = data.employer.payrollObligation
            ? (data.employer.payrollFundsConfirmed / data.employer.payrollObligation) * 100
            : 0;
          return (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="This cycle" description={`Payroll date ${shortDate(data.employer.nextPayrollDate)}`}>
                <ProgressMeter
                  value={fundedPct}
                  label="Funds confirmed"
                  right={pct(fundedPct)}
                  tone="protected"
                />
                <div className="mt-4 divide-y divide-border/70">
                  <SummaryRow label="Payroll obligation" value={naira(data.employer.payrollObligation)} />
                  <SummaryRow label="Funds confirmed" value={naira(data.employer.payrollFundsConfirmed)} />
                  <SummaryRow
                    label="Projected shortfall"
                    value={naira(data.projectedShortfall)}
                    emphasis
                    tone="primary"
                  />
                </div>
                {data.projectedShortfall > 0 ? (
                  <div className="mt-5">
                    <ActionButton to="/employer/salary-buffer" size="sm">
                      Cover with a Salary Buffer
                    </ActionButton>
                  </div>
                ) : null}
              </Panel>

              <Panel title="How the file should look" description="A simple CSV is all we need.">
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "Staff ID",
                    "Full name",
                    "Monthly salary",
                    "Salary accrued to date",
                    "Bank name and account number",
                  ].map((field) => (
                    <li key={field} className="flex items-center gap-2.5">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                      {field}
                    </li>
                  ))}
                </ul>
                <InfoNote className="mt-4">
                  We validate every row before anything goes live. Rows we cannot match are flagged for you
                  rather than guessed.
                </InfoNote>
              </Panel>
            </div>
          );
        }}
      </AsyncPanel>

      <DataTable
        rows={runs.data ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each payroll run you have submitted, with the period, headcount and processing state"
        search={(row) => `${row.period} ${row.uploadedBy} ${row.status}`}
        searchPlaceholder="Search by period or uploader"
        filters={[
          {
            key: "status",
            label: "Status",
            options: ["Draft", "Validated", "Processing", "Reconciled", "Failed"],
            accessor: (row) => row.status,
          },
        ]}
        dateAccessor={(row) => row.uploadedAt}
        isLoading={runs.isLoading}
        isError={runs.isError}
        onRetry={() => void runs.refetch()}
        emptyTitle="No payroll files yet"
        emptyBody="Upload your first payroll file to bring your team onto PayBridge."
        emptyAction={<ActionButton onClick={() => setUploadOpen(true)}>Upload file</ActionButton>}
        initialSort={{ key: "period", direction: "desc" }}
        exportName="paybridge-payroll-runs"
        exportRow={(row) => ({
          Period: row.period,
          Records: row.headcount,
          Gross: row.grossAmount,
          Matched: row.matchedRecords,
          Flagged: row.flaggedRecords,
          "Uploaded by": row.uploadedBy,
          Status: row.status,
        })}
      />

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload a payroll file"
        description="CSV or Excel. Nothing goes live until validation passes."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={upload.isPending}
              disabled={files.length === 0 || gross <= 0 || Number(headcount) <= 0}
              onClick={() => upload.mutate()}
            >
              Validate and upload
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Period"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((value) => ({ value, label: value }))}
          />
          <SelectField
            label="File type"
            value={kind}
            onChange={(value) => setKind(value as (typeof KINDS)[number])}
            options={KINDS.map((value) => ({ value, label: value }))}
            hint="Accrued salary files update how much each employee has earned so far."
          />
          <TextField
            label="Number of records"
            value={headcount}
            onChange={(value) => setHeadcount(value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
          />
          <MoneyField
            label="Total gross amount"
            value={gross}
            onChange={setGross}
            quickAmounts={[25_000_000, 48_500_000, 60_000_000]}
          />
          <UploadDropzone
            label="Payroll file"
            hint="Drag your CSV here, or browse. Maximum one file per upload."
            accept=".csv,.xlsx"
            category="Payroll"
            files={files}
            onFilesChange={setFiles}
            multiple={false}
          />
        </div>
      </Modal>

      <Modal
        open={fundsOpen}
        onClose={() => setFundsOpen(false)}
        title="Confirm payroll funds"
        description="Tell us how much of this payroll you already have in place."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setFundsOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={confirmFunds.isPending}
              disabled={confirmedAmount <= 0}
              onClick={() => confirmFunds.mutate()}
            >
              Confirm funds
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <MoneyField
            label="Funds confirmed"
            value={confirmedAmount}
            onChange={setConfirmedAmount}
            quickAmounts={[20_000_000, 35_000_000, 48_500_000]}
            hint="We use this to calculate your projected shortfall."
          />
          <InfoNote>
            This figure is yours to update at any time before payroll runs. Nothing is drawn from your account.
          </InfoNote>
        </div>
      </Modal>
          </>
        }
      />
    </div>
  );
}
