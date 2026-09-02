import { useRef, useState } from "react";
import { Layers, Upload, Users, Wallet } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { PayrollModelPanel } from "@/components/employer-portal/PayrollModelPanel";
import { useEmployerSession } from "@/lib/employer/session";
import { useCreatePayrollCycle, usePayrollCycle, usePayrollCycles, useUploadPayrollCsv } from "@/lib/employer/payroll";

const naira = (v: number | null) =>
  v === null ? "—" : `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Real payroll ingestion — Employer Portal → Payroll.
 *
 * Uploads land in `PayrollCycle`/`PayrollRecord`/`EmployeeRecord`. This page
 * does not compute or show timeliness/risk — that is `eir/risk/payroll.ts`'s
 * job, not yet wired to a route (see AGENTS.md §6). This page only gets real
 * data into the tables that engine will eventually read.
 *
 * The roster used to be shown again at the bottom of this page — now that
 * Employees has its own dedicated page (`real/Employees.tsx`), showing it
 * twice would just be duplication, so it was removed from here.
 */
export default function EmployerPortalPayroll() {
  const session = useEmployerSession();
  const canWrite = session.data?.role !== "employer_viewer";

  const cycles = usePayrollCycles(session.data?.authenticated ?? false);
  const createCycle = useCreatePayrollCycle();
  const upload = useUploadPayrollCsv();

  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const detail = usePayrollCycle(selectedCycle);

  const [periodStart, setPeriodStart] = useState("");
  const [expectedPayDate, setExpectedPayDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function createCycleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setCreateError(null);
    try {
      const cycle = await createCycle.mutateAsync({ periodStart, expectedPayDate });
      setSelectedCycle(cycle.id);
      setPeriodStart("");
      setExpectedPayDate("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "That cycle could not be created.");
    }
  }

  async function uploadCsv() {
    const file = fileInput.current?.files?.[0];
    if (!file || !selectedCycle) return;
    setUploadError(null);
    setUploadResult(null);
    try {
      const result = await upload.mutateAsync({ cycleId: selectedCycle, file });
      setUploadResult(`Imported ${result?.recordsImported ?? 0} pay records.`);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "That file could not be uploaded.");
    }
  }

  const rows = cycles.data?.items ?? [];
  const latest = rows[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Create a pay cycle, then upload a CSV of pay records against it. Re-uploading replaces that cycle's records."
      />

      <StatGrid columns={3}>
        <StatCard label="Pay cycles" value={rows.length} icon={<Layers className="h-4 w-4" />} tone="primary" />
        <StatCard label="Latest cycle employees" value={latest?.employeeCount ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Latest cycle total" value={naira(latest?.totalAmount ?? null)} icon={<Wallet className="h-4 w-4" />} tone="protected" />
      </StatGrid>

      <PayrollModelPanel authenticated={session.data?.authenticated ?? false} isAdmin={session.data?.role === "employer_admin"} />

      {canWrite ? (
        <Panel title="New pay cycle">
          <form onSubmit={(e) => void createCycleSubmit(e)} className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-muted-foreground">
              Period start
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-1.5 block h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
              />
            </label>
            <label className="text-sm font-medium text-muted-foreground">
              Expected pay date
              <input
                type="date"
                required
                value={expectedPayDate}
                onChange={(e) => setExpectedPayDate(e.target.value)}
                className="mt-1.5 block h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
              />
            </label>
            <ActionButton type="submit" size="sm" loading={createCycle.isPending}>
              Create cycle
            </ActionButton>
          </form>
          {createError ? <p className="mt-2 text-sm text-destructive">{createError}</p> : null}
        </Panel>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Panel title="Cycles" bodyClassName="space-y-2">
          {rows.length ? (
            rows.map((cycle) => (
              <button
                key={cycle.id}
                type="button"
                onClick={() => setSelectedCycle(cycle.id)}
                className={`block w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  selectedCycle === cycle.id
                    ? "border-primary/60 bg-primary/[0.06]"
                    : "border-border bg-card/60 hover:border-border/80"
                }`}
              >
                <span className="block font-semibold text-foreground">{cycle.periodStart}</span>
                <span className="block text-xs text-muted-foreground">
                  {cycle.employeeCount ?? 0} employees · {naira(cycle.totalAmount)}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No pay cycles yet. Create one above.</p>
          )}
        </Panel>

        <div>
          {!selectedCycle ? (
            <Panel title="No cycle selected" description="Choose a cycle to upload or view its records." />
          ) : (
            <div className="space-y-5">
              {canWrite ? (
                <Panel title="Upload pay records" description="CSV with columns: staffRef, fullName, grossPay, netPay, deductions, allowances, bonus, accountNumber, paymentStatus, paidAt. Only staffRef and grossPay are required.">
                  <div className="flex flex-wrap items-center gap-3">
                    <input ref={fileInput} type="file" accept=".csv,text/csv" className="text-sm text-foreground" />
                    <ActionButton
                      size="sm"
                      icon={<Upload className="h-4 w-4" />}
                      loading={upload.isPending}
                      onClick={() => void uploadCsv()}
                    >
                      Upload CSV
                    </ActionButton>
                  </div>
                  {uploadError ? <p className="mt-2 text-sm text-destructive">{uploadError}</p> : null}
                  {uploadResult ? <p className="mt-2 text-sm text-success">{uploadResult}</p> : null}
                </Panel>
              ) : null}

              <Panel title={`Records — ${detail.data?.periodStart ?? ""}`}>
                {detail.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : detail.data?.records.length ? (
                  <div className="space-y-1.5">
                    <SummaryRow label="Total" value={naira(detail.data.totalAmount)} emphasis />
                    <SummaryRow label="Employees" value={detail.data.employeeCount ?? 0} />
                    <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                      {detail.data.records.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{r.fullName ?? r.staffRef}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.staffRef} · {r.paymentStatus}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tnum text-foreground">{naira(r.grossPay)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No records uploaded yet for this cycle.</p>
                )}
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
