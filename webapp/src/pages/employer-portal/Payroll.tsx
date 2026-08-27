import { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { PayrollModelPanel } from "@/components/employer-portal/PayrollModelPanel";
import { useEmployerSession } from "@/lib/employer/session";
import {
  useCreatePayrollCycle,
  useInviteEmployeeLink,
  usePayrollCycle,
  usePayrollCycles,
  usePayrollEmployees,
  useUploadPayrollCsv,
} from "@/lib/employer/payroll";

const naira = (v: number | null) =>
  v === null ? "—" : `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Real payroll ingestion — Employer portal → Payroll.
 *
 * Uploads land in `PayrollCycle`/`PayrollRecord`/`EmployeeRecord`. This page
 * does not compute or show timeliness/risk — that is `eir/risk/payroll.ts`'s
 * job, not yet wired to a route (see AGENTS.md §6). This page only gets real
 * data into the tables that engine will eventually read.
 */
export default function EmployerPortalPayroll() {
  const session = useEmployerSession();
  const canWrite = session.data?.role !== "employer_viewer";

  const cycles = usePayrollCycles(session.data?.authenticated ?? false);
  const employees = usePayrollEmployees(session.data?.authenticated ?? false);
  const createCycle = useCreatePayrollCycle();
  const upload = useUploadPayrollCsv();
  const inviteLink = useInviteEmployeeLink();
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const detail = usePayrollCycle(selectedCycle);

  const [periodStart, setPeriodStart] = useState("");
  const [expectedPayDate, setExpectedPayDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (session.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session.data?.authenticated) return <Navigate to="/employer-portal/login" replace />;

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

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-4 py-10 sm:px-6">
      <Link
        to="/employer-portal"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to company home
      </Link>

      <PageHeader
        eyebrow="Payroll"
        title="Payroll cycles"
        description="Create a pay cycle, then upload a CSV of pay records against it. Re-uploading replaces that cycle's records."
      />

      <PayrollModelPanel
        authenticated={session.data?.authenticated ?? false}
        isAdmin={session.data?.role === "employer_admin"}
      />

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
          {cycles.data?.items.length ? (
            cycles.data.items.map((cycle) => (
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

      <Panel
        title="Roster"
        description="Everyone who has ever appeared in an uploaded pay cycle. Invite them to connect their PayBridge account so their eligibility reflects real payroll."
      >
        {inviteMessage ? <p className="mb-3 text-sm text-success">{inviteMessage}</p> : null}
        {employees.data?.items.length ? (
          <div className="space-y-1.5">
            {employees.data.items.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{e.fullName ?? e.staffRef}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.staffRef}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.linked ? (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wide text-success">Connected</span>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            e.eligible ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {e.eligible ? "Eligible for Access" : e.kycApproved === false ? "KYC pending" : "Not yet eligible"}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {e.status}
                      </span>
                    )}
                    {!e.linked && canWrite ? (
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setInvitingId(invitingId === e.id ? null : e.id);
                          setInviteMessage(null);
                        }}
                      >
                        Invite
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
                {invitingId === e.id ? (
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await inviteLink.mutateAsync({ employeeRecordId: e.id, email: inviteEmail });
                      setInviteMessage(`Invitation sent to ${inviteEmail}.`);
                      setInvitingId(null);
                      setInviteEmail("");
                    }}
                    className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2.5"
                  >
                    <input
                      type="email"
                      required
                      placeholder="their email address"
                      value={inviteEmail}
                      onChange={(ev) => setInviteEmail(ev.target.value)}
                      className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                    />
                    <ActionButton type="submit" size="sm" loading={inviteLink.isPending}>
                      Send
                    </ActionButton>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No employees yet — upload a pay cycle to populate the roster.</p>
        )}
      </Panel>
    </div>
  );
}
