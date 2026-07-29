import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Landmark, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, Divider, SegmentedMeter } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Stepper, Timeline } from "@/components/dashboard/Stepper";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CheckboxField, MoneyField, SelectField, UploadDropzone } from "@/components/dashboard/forms";
import type { SimulatedFile } from "@/components/dashboard/forms";
import { AsyncPanel, EmptyState } from "@/components/dashboard/states";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira, pct, shortDate } from "@/lib/platform/format";
import type { SalaryBufferRequest } from "@/lib/platform/models";
import { useAccountId, useActorName } from "@/lib/platform/use-account";

const STEPS = [
  "Obligation",
  "Funds",
  "Shortfall",
  "Amount",
  "Documents",
  "Offer",
  "Terms",
  "Funding",
  "Repayment",
];

const TENORS = ["15", "30", "45"];

const ACTIVE_STATUSES = ["Offer issued", "Accepted", "Funded", "Repaying"];

function stepForStatus(status: SalaryBufferRequest["status"]): number {
  if (status === "Offer issued") return 5;
  if (status === "Accepted") return 7;
  if (status === "Funded" || status === "Repaying") return 7;
  if (status === "Repaid") return 8;
  return 5;
}

export default function EmployerSalaryBufferPage() {
  const employerId = useAccountId("employer");
  const actor = useActorName();
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: qk.employerOverview(employerId),
    queryFn: () => employerApi.overview(employerId),
  });
  const buffers = useQuery({
    queryKey: qk.employerBuffers(employerId),
    queryFn: () => employerApi.buffers(employerId),
  });

  const active = useMemo(
    () => (buffers.data ?? []).find((b) => ACTIVE_STATUSES.includes(b.status)) ?? null,
    [buffers.data],
  );

  const [restarted, setRestarted] = useState(false);
  const [step, setStep] = useState(0);
  const [obligation, setObligation] = useState(0);
  const [funds, setFunds] = useState(0);
  const [requested, setRequested] = useState(0);
  const [tenor, setTenor] = useState("30");
  const [files, setFiles] = useState<SimulatedFile[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed the journey from the employer's live payroll figures on first load.
  if (!seeded && overview.data) {
    setObligation(overview.data.employer.payrollObligation);
    setFunds(overview.data.employer.payrollFundsConfirmed);
    setRequested(overview.data.projectedShortfall);
    setSeeded(true);
  }

  const shortfall = Math.max(0, obligation - funds);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.employerBuffers(employerId) });
    void queryClient.invalidateQueries({ queryKey: qk.employerOverview(employerId) });
  };

  const create = useMutation({
    mutationFn: () =>
      employerApi.createBuffer({
        employerId,
        payrollObligation: obligation,
        fundsConfirmed: funds,
        requestedAmount: requested,
        tenorDays: Number(tenor),
        documents: files.map((file) => ({ name: file.name, sizeKb: file.sizeKb, category: file.category })),
        createdBy: actor,
      }),
    onSuccess: () => {
      invalidate();
      setRestarted(false);
      setStep(5);
      toast.success("Request submitted — your offer is ready to review");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not submit that request"),
  });

  const accept = useMutation({
    mutationFn: (reference: string) => employerApi.acceptBufferOffer(reference, actor),
    onSuccess: () => {
      invalidate();
      setStep(7);
      toast.success("Terms accepted — funding is on its way");
    },
  });

  const journeyStep = active && !restarted ? stepForStatus(active.status) : step;
  const showWizard = !active || restarted;

  const startAgain = () => {
    setRestarted(true);
    setStep(0);
    setFiles([]);
    setAccepted(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salary Buffer"
        title="Keep payroll on time"
        description="If this month's payroll is short, PayBridge can bridge the gap so salaries land on the day."
        actions={
          active && !restarted ? (
            <ActionButton variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={startAgain}>
              New request
            </ActionButton>
          ) : null
        }
      />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="space-y-6">
            <StatGrid columns={4}>
              <StatCard label="Payroll obligation" value={naira(data.employer.payrollObligation)} />
              <StatCard
                label="Funds confirmed"
                value={naira(data.employer.payrollFundsConfirmed)}
                tone="protected"
              />
              <StatCard
                label="Projected shortfall"
                value={naira(data.projectedShortfall)}
                tone={data.projectedShortfall > 0 ? "attention" : "protected"}
              />
              <StatCard
                label="Approved buffer"
                value={naira(data.approvedBuffer)}
                hint={active ? active.reference : "No active request"}
                tone="primary"
              />
            </StatGrid>

            <Panel
              title={showWizard ? "Request a Salary Buffer" : `Request ${active?.reference}`}
              description={
                showWizard
                  ? "Nine short steps. You can review everything before anything is agreed."
                  : "Where your current request stands."
              }
            >
              <Stepper steps={STEPS} current={journeyStep} className="mb-6" />

              {showWizard ? (
                <WizardBody
                  step={step}
                  setStep={setStep}
                  obligation={obligation}
                  setObligation={setObligation}
                  funds={funds}
                  setFunds={setFunds}
                  shortfall={shortfall}
                  requested={requested}
                  setRequested={setRequested}
                  tenor={tenor}
                  setTenor={setTenor}
                  files={files}
                  setFiles={setFiles}
                  submitting={create.isPending}
                  onSubmit={() => create.mutate()}
                  nextPayrollDate={data.employer.nextPayrollDate}
                />
              ) : active ? (
                <TrackBody
                  request={active}
                  accepted={accepted}
                  setAccepted={setAccepted}
                  accepting={accept.isPending}
                  onAccept={() => accept.mutate(active.reference)}
                />
              ) : null}
            </Panel>
          </div>
        )}
      </AsyncPanel>

      <Panel title="Request history" description="Every Salary Buffer you have requested.">
        {(buffers.data ?? []).length === 0 ? (
          <EmptyState
            title="No requests yet"
            body="When you request a Salary Buffer it appears here with its full history."
            icon={<Landmark className="h-5 w-5" />}
          />
        ) : (
          <ul className="space-y-2.5">
            {(buffers.data ?? []).map((request) => (
              <li key={request.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{request.reference}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Requested {shortDate(request.createdAt)} · repayment {shortDate(request.repaymentDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground tnum">
                      {naira(request.approvedAmount ?? request.requestedAmount)}
                    </p>
                    <StatusBadge status={request.status} className="mt-1" />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>Shortfall {naira(request.shortfall)}</span>
                  <span>Rate {pct(request.pricingRatePct)}</span>
                  <span>Tenor {request.tenorDays} days</span>
                  <span>{request.documents.length} documents</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <InfoNote>
        A Salary Buffer is a facility for your organisation, agreed with PayBridge and priced up front. Pricing
        and approval remain subject to review.
      </InfoNote>
    </div>
  );
}

/* ----------------------------------------------------------------- wizard */

function WizardBody({
  step,
  setStep,
  obligation,
  setObligation,
  funds,
  setFunds,
  shortfall,
  requested,
  setRequested,
  tenor,
  setTenor,
  files,
  setFiles,
  submitting,
  onSubmit,
  nextPayrollDate,
}: {
  step: number;
  setStep: (step: number) => void;
  obligation: number;
  setObligation: (value: number) => void;
  funds: number;
  setFunds: (value: number) => void;
  shortfall: number;
  requested: number;
  setRequested: (value: number) => void;
  tenor: string;
  setTenor: (value: string) => void;
  files: SimulatedFile[];
  setFiles: (files: SimulatedFile[]) => void;
  submitting: boolean;
  onSubmit: () => void;
  nextPayrollDate: string;
}) {
  const back = step > 0 ? () => setStep(step - 1) : undefined;

  const footer = (label: string, disabled: boolean, onNext: () => void, loading = false) => (
    <div className="mt-6 flex flex-wrap gap-2.5">
      <ActionButton disabled={disabled} loading={loading} onClick={onNext}>
        {label}
      </ActionButton>
      {back ? (
        <ActionButton variant="ghost" onClick={back}>
          Back
        </ActionButton>
      ) : null}
    </div>
  );

  if (step === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Confirm the total salary you owe your team for this cycle.
        </p>
        <div className="mt-4 max-w-md">
          <MoneyField
            label="Payroll obligation"
            value={obligation}
            onChange={setObligation}
            quickAmounts={[25_000_000, 48_500_000, 60_000_000]}
          />
        </div>
        {footer("Continue", obligation <= 0, () => setStep(1))}
      </div>
    );
  }

  if (step === 1) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Now confirm how much of that you already have available.
        </p>
        <div className="mt-4 max-w-md">
          <MoneyField
            label="Funds confirmed"
            value={funds}
            onChange={setFunds}
            quickAmounts={[20_000_000, 35_000_000, obligation]}
          />
        </div>
        {footer("Continue", funds < 0, () => setStep(2))}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">This is the gap we would cover.</p>
        <div className="mt-4 max-w-lg">
          <SegmentedMeter
            segments={[
              { label: "Funds confirmed", value: funds, tone: "protected" },
              { label: "Shortfall", value: shortfall, tone: "gold" },
            ]}
          />
          <div className="mt-4 divide-y divide-border/70">
            <SummaryRow label="Payroll obligation" value={naira(obligation)} />
            <SummaryRow label="Funds confirmed" value={naira(funds)} />
            <SummaryRow label="Shortfall" value={naira(shortfall)} emphasis tone="primary" />
            <SummaryRow label="Payroll date" value={longDate(nextPayrollDate)} />
          </div>
        </div>
        {footer(
          shortfall > 0 ? "Continue" : "No buffer needed",
          shortfall <= 0,
          () => {
            setRequested(shortfall);
            setStep(3);
          },
        )}
      </div>
    );
  }

  if (step === 3) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          How much would you like PayBridge to bridge? You can request less than the full shortfall.
        </p>
        <div className="mt-4 max-w-md space-y-4">
          <MoneyField
            label="Requested amount"
            value={requested}
            onChange={setRequested}
            quickAmounts={[Math.round(shortfall / 2), shortfall]}
            hint={`Shortfall is ${naira(shortfall)}`}
          />
          <SelectField
            label="Repayment tenor"
            value={tenor}
            onChange={setTenor}
            options={TENORS.map((value) => ({ value, label: `${value} days` }))}
          />
        </div>
        {footer("Continue", requested <= 0 || requested > shortfall, () => setStep(4))}
      </div>
    );
  }

  if (step === 4) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Attach your supporting documents so our team can issue an offer.
        </p>
        <div className="mt-4 space-y-4">
          <UploadDropzone
            label="Supporting documents"
            hint="Payroll schedule, recent bank statement, board resolution. PDF, CSV or image."
            category="Salary Buffer"
            files={files}
            onFilesChange={setFiles}
          />
          {files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate text-foreground">{file.name}</span>
                  <span className="ml-auto tnum">{file.sizeKb} KB</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {footer("Submit for review", files.length === 0, onSubmit, submitting)}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">Your request is with our team. Your offer appears here.</p>
      {footer("Refresh", false, () => setStep(5))}
    </div>
  );
}

/* --------------------------------------------------------------- tracking */

function TrackBody({
  request,
  accepted,
  setAccepted,
  accepting,
  onAccept,
}: {
  request: SalaryBufferRequest;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  accepting: boolean;
  onAccept: () => void;
}) {
  const amount = request.approvedAmount ?? request.requestedAmount;
  const fee = Math.round((amount * request.pricingRatePct) / 100);
  const offerStage = request.status === "Offer issued";

  const events: Array<{
    label: string;
    at?: string;
    note?: string;
    state: "done" | "current" | "pending" | "failed";
  }> = [
    { label: "Request submitted", at: shortDate(request.createdAt), state: "done" },
    { label: "Documents received", note: `${request.documents.length} files`, state: "done" },
    {
      label: "Offer issued",
      note: `${naira(amount)} at ${pct(request.pricingRatePct)} for ${request.tenorDays} days`,
      state: "done",
    },
    {
      label: "Terms accepted",
      state: offerStage ? "current" : "done",
    },
    {
      label: "Funds disbursed to your payroll account",
      at: request.fundedAt ? shortDate(request.fundedAt) : undefined,
      state: request.status === "Funded" || request.status === "Repaying" ? "done" : "pending",
    },
    {
      label: "Repayment and reconciliation",
      note: `Due ${shortDate(request.repaymentDate)}`,
      state: request.status === "Repaying" ? "current" : "pending",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-sm font-semibold text-foreground">Your offer</p>
        <div className="mt-3 divide-y divide-border/70">
          <SummaryRow label="Payroll obligation" value={naira(request.payrollObligation)} />
          <SummaryRow label="Funds confirmed" value={naira(request.fundsConfirmed)} />
          <SummaryRow label="Shortfall" value={naira(request.shortfall)} />
          <SummaryRow label="Buffer amount" value={naira(amount)} emphasis tone="primary" />
          <SummaryRow label="Pricing" value={`${pct(request.pricingRatePct)} for ${request.tenorDays} days`} />
          <SummaryRow label="Total repayable" value={naira(amount + fee)} />
          <SummaryRow label="Repayment date" value={longDate(request.repaymentDate)} />
          <SummaryRow label="Status" value={<StatusBadge status={request.status} />} />
        </div>

        {offerStage ? (
          <div className="mt-5 space-y-4">
            <CheckboxField
              checked={accepted}
              onChange={setAccepted}
              label="I accept the Salary Buffer terms on behalf of my organisation."
            />
            <ActionButton disabled={!accepted} loading={accepting} onClick={onAccept}>
              Accept terms
            </ActionButton>
          </div>
        ) : (
          <div className="mt-5">
            <ActionButton to="/employer/repayments" variant="secondary" size="sm">
              View repayment schedule
            </ActionButton>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">Progress</p>
        <div className="mt-3">
          <Timeline events={events} />
        </div>
        <Divider />
        <InfoNote tone="primary">
          Funds are released to your payroll account only after you accept. Repayment is a single settlement on
          the date above.
        </InfoNote>
      </div>
    </div>
  );
}
