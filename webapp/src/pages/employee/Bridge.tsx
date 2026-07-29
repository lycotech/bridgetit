import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Copy, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { Stepper } from "@/components/dashboard/Stepper";
import { AsyncPanel, EmptyState } from "@/components/dashboard/states";
import { CheckboxField, OtpField } from "@/components/dashboard/forms";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { BridgeGauge, gaugeStep } from "@/components/bridge/BridgeGauge";
import { BridgeAmountControl, MIN_BRIDGE } from "@/components/bridge/AmountControl";
import { FeeDisclosure } from "@/components/bridge/FeeDisclosure";
import { BridgeComplete, BridgeJourney } from "@/components/bridge/BridgeAnimation";
import { PaydayTimeline } from "@/components/bridge/PaydayTimeline";
import { MDiv } from "@/lib/motion";
import { bridgeFee, employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import type { BankAccount, BridgeRequest } from "@/lib/platform/models";

type Step = "amount" | "journey" | "review" | "account" | "confirm" | "done";

const STEP_LABELS = ["Amount", "Review", "Account", "Confirm", "Done"];
const STEP_INDEX: Record<Step, number> = {
  amount: 0,
  journey: 0,
  review: 1,
  account: 2,
  confirm: 3,
  done: 4,
};

export default function BridgePage() {
  const employeeId = useAccountId("employee");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: qk.employeeOverview(employeeId),
    queryFn: () => employeeApi.overview(employeeId),
  });

  const { t } = usePreferences();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState(0);
  const [touched, setTouched] = useState(false);
  /** Ticked on the review screen. Reset whenever the amount changes, below. */
  const [understood, setUnderstood] = useState(false);
  /** Bumped each time the beacon is released, so the CTA gives one gentle pulse. */
  const [pulse, setPulse] = useState(0);
  const [accountId, setAccountId] = useState<string>("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [result, setResult] = useState<BridgeRequest | null>(null);

  /* Changing the amount unticks the confirmation. Consent is to a specific
     figure on a specific date, so it cannot survive the figure changing. */
  useEffect(() => {
    setUnderstood(false);
  }, [amount]);

  const available = overview.data?.remainingAvailable ?? 0;
  const fee = useMemo(() => (amount > 0 ? bridgeFee(amount) : 0), [amount]);
  const banks: BankAccount[] = overview.data?.employee.bankAccounts ?? [];
  const chosenAccount = banks.find((b) => b.id === accountId) ?? banks.find((b) => b.isPrimary) ?? banks[0];

  const create = useMutation({
    mutationFn: () =>
      employeeApi.createBridge({ employeeId, amount, bankAccountId: chosenAccount?.id ?? "" }),
    onSuccess: (request) => {
      setResult(request);
      setStep("done");
      void queryClient.invalidateQueries({ queryKey: qk.employeeOverview(employeeId) });
      void queryClient.invalidateQueries({ queryKey: qk.employeeRequests(employeeId) });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "employee"] });
    },
    onError: (error: unknown) => {
      setStep("review");
      toast.error(error instanceof Error ? error.message : "We could not complete that just now");
    },
  });

  const confirmOtp = async () => {
    setOtpError(null);
    try {
      await employeeApi.verifyOtp(code);
      create.mutate();
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Enter the 6-digit code");
    }
  };

  const isMax = amount > 0 && amount >= available;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bridge It"
        title={step === "done" ? "Your Bridge is Complete." : "Choose your amount"}
        description={
          step === "done"
            ? "The money is on its way to your bank account."
            : "Move your Bridge Gauge from today towards payday. You decide how much of the pay you have already earned comes to you now."
        }
      />

      <Stepper steps={STEP_LABELS} current={STEP_INDEX[step]} />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="mx-auto max-w-xl">
            {/* ---------------------------------------------------------- amount */}
            {step === "amount" ? (
              <Panel>
                {data.accrual.paused ? (
                  <EmptyState
                    title="New earned pay is on hold"
                    body={`${
                      data.accrual.pauseReason ??
                      "Your employer is confirming a change to your payroll."
                    } Anything you have already bridged is unaffected and still settles on ${longDate(
                      data.employee.nextPayday,
                    )}.`}
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <ActionButton variant="secondary" to="/employee/pay">
                          See my pay
                        </ActionButton>
                        <ActionButton variant="secondary" onClick={() => navigate("/employee")}>
                          Back to overview
                        </ActionButton>
                      </div>
                    }
                  />
                ) : available <= 0 ? (
                  <EmptyState
                    title="You've bridged all of your available earned pay"
                    body={`More becomes available as you earn. Your payroll settlement is ${longDate(
                      data.employee.nextPayday,
                    )}.`}
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <ActionButton variant="secondary" onClick={() => navigate("/employee")}>
                          Back to overview
                        </ActionButton>
                        <ActionButton variant="secondary" to="/employee/savings">
                          Build a cushion
                        </ActionButton>
                      </div>
                    }
                  />
                ) : (
                  <>
                    <BridgeGauge
                      available={available}
                      value={amount}
                      onChange={setAmount}
                      payday={data.employee.nextPayday}
                      fee={fee}
                      onFirstInteraction={() => setTouched(true)}
                      onCommit={(next) => {
                        if (next > 0) setPulse((p) => p + 1);
                      }}
                    />

                    {/* The same amount, without a drag: type it, step it, or tap
                        a preset. The gauge above is no longer the only way in. */}
                    <BridgeAmountControl
                      available={available}
                      value={amount}
                      onChange={setAmount}
                      step={gaugeStep(available)}
                      fee={fee}
                      onInteract={() => setTouched(true)}
                    />

                    <div className="mt-6">
                      <MDiv
                        key={pulse}
                        animate={
                          touched && amount > 0 && pulse > 0
                            ? { scale: [1, 1.028, 1, 1.018, 1] }
                            : { scale: 1 }
                        }
                        transition={{ duration: 1.15, ease: "easeInOut" }}
                      >
                        <ActionButton
                          size="lg"
                          fullWidth
                          disabled={amount < MIN_BRIDGE || amount > available}
                          icon={<ArrowRight className="h-4 w-4" />}
                          onClick={() => {
                            setAccountId(chosenAccount?.id ?? "");
                            setStep("journey");
                          }}
                        >
                          {amount <= 0
                            ? "Choose an amount"
                            : isMax
                              ? "Bridge Maximum"
                              : `Bridge ${naira(amount)}`}
                        </ActionButton>
                      </MDiv>
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        You will see the fee and the exact amount you receive before anything is confirmed.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/employee/pay")}
                        className="mt-3 w-full rounded-2xl border border-border bg-secondary/30 p-3.5 text-left transition-colors hover:border-primary/40"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Where this comes from
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {naira(data.accrual.netDailyEarnings)} of net pay per working day ×{" "}
                          {data.accrual.daysCompleted} days worked ={" "}
                          <span className="font-semibold text-foreground">
                            {naira(data.accrual.accruedNetEarnings)}
                          </span>{" "}
                          earned so far. You can access up to {data.accrual.maxBridgePct}% of that. Based on
                          your pay after deductions, never your gross salary.
                        </p>
                      </button>
                    </div>

                    {/* Wellbeing over volume: if a cushion would serve them better, say so here. */}
                    {data.topRecommendation?.reducesBridgeUse ? (
                      <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-4">
                        <p className="text-sm font-semibold text-foreground">
                          {data.topRecommendation.title}
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {data.topRecommendation.impact}
                        </p>
                        <div className="mt-3">
                          <ActionButton to={data.topRecommendation.actionTo} variant="secondary" size="sm">
                            {data.topRecommendation.actionLabel}
                          </ActionButton>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </Panel>
            ) : null}

            {/* --------------------------------------------------------- journey */}
            {step === "journey" ? (
              <Panel>
                <BridgeJourney amount={amount} onComplete={() => setStep("review")} />
              </Panel>
            ) : null}

            {/* ---------------------------------------------------------- review */}
            {step === "review" ? (
              <Panel
                title="Review before confirming"
                description="Everything is shown here. No charge is applied until you confirm."
              >
                {/* Premium confirmation card — the amount landing today leads. */}
                <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card">
                  <div className="px-5 py-6 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      You&apos;ll Receive Today
                    </p>
                    <p className="mt-1.5 font-display text-[2.7rem] font-extrabold leading-none tracking-tight text-foreground tnum">
                      {naira(amount)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      The full amount you selected. Nothing is deducted from your transfer.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-border/70">
                    <div className="bg-card px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Bridge Amount
                      </p>
                      <p className="mt-1 font-display text-base font-bold text-foreground tnum">
                        {naira(amount)}
                      </p>
                    </div>
                    <div className="bg-card px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Service Fee
                      </p>
                      <p className="mt-1 font-display text-base font-bold text-foreground tnum">
                        {naira(fee)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* The six numbers, in plain words, before anything is confirmed:
                    available · asked for · received · fee · taken on payday ·
                    date. Line 3 equals line 2 — the fee is added, never netted
                    off the transfer. */}
                <div className="mt-4">
                  <FeeDisclosure
                    available={available}
                    amount={amount}
                    fee={fee}
                    paydayIso={data.employee.nextPayday}
                  />
                </div>

                <Divider className="my-4" />

                <div className="divide-y divide-border/70">
                  <SummaryRow
                    label="Destination Bank"
                    value={chosenAccount ? `${chosenAccount.bankName} ${chosenAccount.accountNumberMasked}` : "—"}
                  />
                  <SummaryRow label="Expected Arrival" value="Within minutes" tone="primary" />
                  <SummaryRow
                    label="Still available after this"
                    value={naira(Math.max(0, available - amount))}
                    tone="muted"
                  />
                </div>

                <InfoNote tone="primary" className="mt-4">
                  This is salary you have already earned. {data.employee.employerName} settles it directly
                  from payroll — there is nothing to repay yourself, and your employer never sees why you
                  bridged.
                </InfoNote>

                {/* Informed consent in one sentence, with the two facts that
                    matter in it: how much, and when. Somebody with low financial
                    literacy should not have to infer the deduction from a table. */}
                <div className="mt-4 rounded-2xl border border-border bg-secondary/25 px-4">
                  <CheckboxField
                    checked={understood}
                    onChange={setUnderstood}
                    required
                    label={t("bridge.confirm_understand", {
                      total: naira(amount + fee),
                      date: longDate(data.employee.nextPayday),
                    })}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
                  <ActionButton
                    size="lg"
                    fullWidth
                    disabled={!understood}
                    icon={<ArrowRight className="h-4 w-4" />}
                    onClick={() => setStep("account")}
                  >
                    {t("common.continue")}
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    size="lg"
                    fullWidth
                    icon={<ArrowLeft className="h-4 w-4" />}
                    onClick={() => setStep("amount")}
                  >
                    Change amount
                  </ActionButton>
                </div>
              </Panel>
            ) : null}

            {/* --------------------------------------------------------- account */}
            {step === "account" ? (
              <Panel
                title="Confirm your bank account"
                description="This is where your money lands. Choose a different account if you prefer."
              >
                <ul className="space-y-2.5">
                  {banks.map((account) => {
                    const active = (chosenAccount?.id ?? "") === account.id;
                    return (
                      <li key={account.id}>
                        <button
                          type="button"
                          onClick={() => setAccountId(account.id)}
                          className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors ${
                            active
                              ? "border-primary/60 bg-primary/[0.06]"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                            <Landmark className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground">
                              {account.bankName}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground tnum">
                              {account.accountName} · {account.accountNumberMasked}
                            </span>
                          </span>
                          {active ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <Divider className="my-4" />
                <SummaryRow label="You'll receive today" value={naira(amount)} emphasis tone="primary" />

                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row-reverse">
                  <ActionButton size="lg" fullWidth onClick={() => setStep("confirm")}>
                    Confirm account
                  </ActionButton>
                  <ActionButton variant="secondary" size="lg" fullWidth onClick={() => setStep("review")}>
                    Back
                  </ActionButton>
                </div>
              </Panel>
            ) : null}

            {/* --------------------------------------------------------- confirm */}
            {step === "confirm" ? (
              <Panel
                title="Confirm it's you"
                description="Enter the 6-digit code we sent to your phone, or your PayBridge PIN."
              >
                <OtpField
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setOtpError(null);
                  }}
                  label="Verification code"
                  error={otpError ?? undefined}
                  hint="For this prototype, any 6 digits will work — try 123456."
                />

                <div className="mt-5 divide-y divide-border/70">
                  <SummaryRow label="Sending to" value={chosenAccount?.bankName ?? "—"} />
                  <SummaryRow label="You'll receive today" value={naira(amount)} emphasis tone="primary" />
                </div>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
                  <ActionButton
                    size="lg"
                    fullWidth
                    loading={create.isPending}
                    icon={<ShieldCheck className="h-4 w-4" />}
                    onClick={() => void confirmOtp()}
                  >
                    Bridge {naira(amount)}
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    size="lg"
                    fullWidth
                    disabled={create.isPending}
                    onClick={() => setStep("account")}
                  >
                    Back
                  </ActionButton>
                </div>
              </Panel>
            ) : null}

            {/* ------------------------------------------------------------ done */}
            {step === "done" && result ? (
              <Panel className="border-success/30">
                <BridgeComplete />
                <div className="text-center">
                  {/* The arrival chip. This is the one screen in the flow that
                      has actually finished, so it is the one that goes green. */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    <Check className="h-3.5 w-3.5" />
                    Sent
                  </span>
                  <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground">
                    Your Bridge is Complete.
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {naira(result.netAmount)} is on its way to {result.destination}.
                  </p>
                </div>

                <div className="mt-5 divide-y divide-border/70">
                  <SummaryRow
                    label="Reference Number"
                    value={
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(result.reference);
                          toast.success("Reference copied");
                        }}
                        className="inline-flex items-center gap-1.5 font-semibold text-primary"
                      >
                        {result.reference}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  <SummaryRow label="Bridge Amount" value={naira(result.amount)} />
                  <SummaryRow label="Service Fee" value={naira(result.fee)} />
                  {/* Green only on the two lines that are the outcome: money
                      arriving, and when. The deduction stays neutral. */}
                  <SummaryRow label="You'll Receive Today" value={naira(result.netAmount)} emphasis tone="success" />
                  <SummaryRow
                    label="Payroll Deduction"
                    value={naira(result.settlementAmount)}
                    hint={longDate(result.settlementDate)}
                  />
                  <SummaryRow label="Expected Arrival" value="Within minutes" tone="success" />
                </div>

                <Divider className="my-5" />
                <p className="mb-3 text-sm font-semibold text-foreground">What happens next</p>
                <PaydayTimeline request={result} />

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
                  <ActionButton
                    size="lg"
                    fullWidth
                    onClick={() => navigate(`/employee/transactions?ref=${result.reference}`)}
                  >
                    Track Transaction
                  </ActionButton>
                  <ActionButton variant="secondary" size="lg" fullWidth onClick={() => navigate("/employee")}>
                    Done
                  </ActionButton>
                </div>
              </Panel>
            ) : null}
          </div>
        )}
      </AsyncPanel>
    </div>
  );
}
