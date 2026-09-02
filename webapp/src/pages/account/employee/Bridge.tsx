import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { Stepper } from "@/components/dashboard/Stepper";
import { EmptyState } from "@/components/dashboard/states";
import { CheckboxField } from "@/components/dashboard/forms";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { BridgeGauge, gaugeStep } from "@/components/bridge/BridgeGauge";
import { BridgeAmountControl, MIN_BRIDGE } from "@/components/bridge/AmountControl";
import { FeeDisclosure } from "@/components/bridge/FeeDisclosure";
import { BridgeComplete, BridgeJourney } from "@/components/bridge/BridgeAnimation";
import { MDiv } from "@/lib/motion";
import { longDate, naira } from "@/lib/platform/format";
import {
  useBridgeDraws,
  useEligibility,
  useMySalaryAccountRequests,
  useRequestBridgeDraw,
} from "@/lib/account/session";
import { EligibilitySection } from "@/pages/account/AccountHome";
import type { BridgeDrawView } from "../../../../../backend/src/types";

/**
 * Real employee Bridge — `/account/employee/bridge`.
 *
 * Same five-step shape and the same design as the mock (`pages/employee/
 * Bridge.tsx`): Amount → Review → Account → Confirm → Done, inside the same
 * `max-w-xl` column. The gauge on its own filled the full dashboard width,
 * which is what made this page feel oversized next to the mock.
 *
 * WHAT IS DELIBERATELY NOT COPIED, because the real product has no such thing
 * and a real customer must never be shown an invented one:
 *
 *  - THE FEE. The mock charges a service fee; the real Bridge charges nothing
 *    (`backend/src/routes/bridge.ts` has no fee concept at all). `fee` is 0
 *    everywhere below because that is literally true, and the review screen
 *    says so in words rather than showing a blank.
 *  - THE BANK PICKER. `requestBridgeDrawSchema` takes `{ amount }` and nothing
 *    else — there is no destination to choose. The Account step shows the
 *    employee's real PayBridge Salary Account when one is active, and says
 *    plainly where the money goes when one is not. It never renders a list of
 *    accounts that the request could not honour anyway.
 *  - THE OTP. The mock accepts any six digits. Putting a decorative code box
 *    in front of a real money movement is security theatre, so Confirm is an
 *    explicit final confirmation instead — real intent, no fake check.
 *
 * Everything the flow does show — the amount, the payday, the employer, the
 * reference, the decision — comes from `useEligibility`/`useRequestBridgeDraw`.
 */

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

export default function EmployeeBridge() {
  const navigate = useNavigate();
  const eligibility = useEligibility(true);
  const draws = useBridgeDraws(true);
  const salaryAccounts = useMySalaryAccountRequests(true);
  const request = useRequestBridgeDraw();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState(0);
  const [touched, setTouched] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BridgeDrawView | null>(null);

  /* Changing the amount unticks the confirmation: consent is to a specific
     figure, so it cannot survive the figure changing. Same rule as the mock. */
  useEffect(() => {
    setUnderstood(false);
  }, [amount]);

  const available = eligibility.data?.earnedWageEstimate ?? 0;
  const payday = eligibility.data?.expectedPayDate ?? null;
  const employerName = eligibility.data?.employerName ?? "Your employer";
  const netPay = eligibility.data?.netPay ?? null;
  const step0 = gaugeStep(available);
  const isMax = amount > 0 && amount >= available;

  /* The one real destination the product has today. An approved Salary Account
     request is the only place PayBridge knows to send salary; anything else is
     the employee's existing payroll account, which PayBridge does not hold. */
  const salaryAccount = useMemo(
    () => salaryAccounts.data?.items.find((item) => item.status === "active") ?? null,
    [salaryAccounts.data],
  );

  const submit = async () => {
    setError(null);
    try {
      const draw = await request.mutateAsync({ amount });
      setResult(draw);
      setStep("done");
    } catch (err) {
      setStep("review");
      const message = err instanceof Error ? err.message : "That request could not be processed.";
      setError(message);
      toast.error(message);
    }
  };

  const restart = () => {
    setResult(null);
    setAmount(0);
    setUnderstood(false);
    setTouched(false);
    setError(null);
    setStep("amount");
  };

  if (!eligibility.data?.eligible) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bridge" description="Access a portion of pay you've already earned this cycle." />
        <EligibilitySection />
      </div>
    );
  }

  const approved = result?.status === "approved";
  const settledAmount = result?.approvedAmount ?? result?.requestedAmount ?? amount;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bridge It"
        title={step === "done" ? (approved ? "Your Bridge is Complete." : "This Bridge was not approved") : "Choose your amount"}
        description={
          step === "done"
            ? approved
              ? "The money is on its way to your bank account."
              : "Nothing has been taken and nothing is owed."
            : "Move your Bridge Gauge from today towards payday. You decide how much of the pay you have already earned comes to you now."
        }
      />

      <Stepper steps={STEP_LABELS} current={STEP_INDEX[step]} />

      <div className="mx-auto max-w-xl">
        {/* ------------------------------------------------------------ amount */}
        {step === "amount" ? (
          <Panel>
            {available <= 0 ? (
              <EmptyState
                title="You've bridged all of your available earned pay"
                body={
                  payday
                    ? `More becomes available as you earn. Your payroll settlement is ${longDate(payday)}.`
                    : "More becomes available as you earn."
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <ActionButton variant="secondary" to="/account/employee">
                      Back to overview
                    </ActionButton>
                    <ActionButton variant="secondary" to="/account/employee/savings">
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
                  payday={payday ?? new Date().toISOString()}
                  fee={0}
                  onFirstInteraction={() => setTouched(true)}
                  onCommit={(next) => {
                    if (next > 0) setPulse((p) => p + 1);
                  }}
                />

                <BridgeAmountControl
                  available={available}
                  value={amount}
                  onChange={setAmount}
                  step={step0}
                  fee={0}
                  onInteract={() => setTouched(true)}
                />

                <div className="mt-6">
                  <MDiv
                    key={pulse}
                    animate={touched && amount > 0 && pulse > 0 ? { scale: [1, 1.028, 1, 1.018, 1] } : { scale: 1 }}
                    transition={{ duration: 1.15, ease: "easeInOut" }}
                  >
                    <ActionButton
                      size="lg"
                      fullWidth
                      disabled={amount < MIN_BRIDGE || amount > available}
                      icon={<ArrowRight className="h-4 w-4" />}
                      onClick={() => setStep("journey")}
                    >
                      {amount <= 0 ? "Choose an amount" : isMax ? "Bridge Maximum" : `Bridge ${naira(amount)}`}
                    </ActionButton>
                  </MDiv>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    You will see the exact amount you receive before anything is confirmed.
                  </p>

                  {/* Real payroll figures only — netPay is null until the
                      employer's payroll record is verified, and then this
                      whole note is omitted rather than estimated. */}
                  {netPay !== null ? (
                    <button
                      type="button"
                      onClick={() => navigate("/account/employee/pay")}
                      className="mt-3 w-full rounded-2xl border border-border bg-secondary/30 p-3.5 text-left transition-colors hover:border-primary/40"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Where this comes from
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        Your last verified pay record from {employerName} was{" "}
                        <span className="font-semibold text-foreground">{naira(netPay)}</span> after deductions.
                        Your available amount is a portion of what you have earned so far this cycle — based on
                        your pay after deductions, never your gross salary.
                      </p>
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </Panel>
        ) : null}

        {/* ----------------------------------------------------------- journey */}
        {step === "journey" ? (
          <Panel>
            <BridgeJourney amount={amount} onComplete={() => setStep("review")} />
          </Panel>
        ) : null}

        {/* ------------------------------------------------------------ review */}
        {step === "review" ? (
          <Panel
            title="Review before confirming"
            description="Everything is shown here. Nothing is requested until you confirm."
          >
            <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card">
              <div className="px-5 py-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  You&apos;ll Receive
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
                  <p className="mt-1 font-display text-base font-bold text-foreground tnum">{naira(amount)}</p>
                </div>
                <div className="bg-card px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Service Fee
                  </p>
                  <p className="mt-1 font-display text-base font-bold text-foreground tnum">{naira(0)}</p>
                </div>
              </div>
            </div>

            <InfoNote tone="success" className="mt-3">
              PayBridge does not charge a fee for a Bridge. The amount taken at settlement is exactly the amount
              you receive.
            </InfoNote>

            {payday ? (
              <div className="mt-4">
                <FeeDisclosure available={available} amount={amount} fee={0} paydayIso={payday} />
              </div>
            ) : null}

            <Divider className="my-4" />

            <div className="divide-y divide-border/70">
              <SummaryRow
                label="Destination"
                value={
                  salaryAccount
                    ? `${salaryAccount.newBankName} ${salaryAccount.newAccountMasked}`
                    : "Your existing salary account"
                }
              />
              <SummaryRow
                label="Settles on"
                value={payday ? longDate(payday) : "Your next payday"}
                tone="primary"
              />
              <SummaryRow
                label="Still available after this"
                value={naira(Math.max(0, available - amount))}
                tone="muted"
              />
            </div>

            <InfoNote tone="primary" className="mt-4">
              This is salary you have already earned. {employerName} settles it directly from payroll — there is
              nothing to repay yourself, and your employer never sees why you bridged.
            </InfoNote>

            <div className="mt-4 rounded-2xl border border-border bg-secondary/25 px-4">
              <CheckboxField
                checked={understood}
                onChange={setUnderstood}
                required
                label={
                  payday
                    ? `I understand that ${naira(amount)} will be settled from my pay on ${longDate(payday)}.`
                    : `I understand that ${naira(amount)} will be settled from my next pay.`
                }
              />
            </div>

            {error ? (
              <InfoNote tone="attention" role="alert" className="mt-4">
                {error}
              </InfoNote>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
              <ActionButton
                size="lg"
                fullWidth
                disabled={!understood}
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() => setStep("account")}
              >
                Continue
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

        {/* ----------------------------------------------------------- account */}
        {step === "account" ? (
          <Panel
            title="Where your money lands"
            description="Confirm the account this Bridge settles against."
          >
            {salaryAccount ? (
              <div className="flex items-center gap-3.5 rounded-2xl border border-primary/60 bg-primary/[0.06] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <Landmark className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{salaryAccount.newBankName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground tnum">
                    PayBridge Salary Account · {salaryAccount.newAccountMasked}
                  </span>
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <Landmark className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">Your existing salary account</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      The account {employerName} already pays you into.
                    </span>
                  </span>
                </div>
                <InfoNote className="mt-3">
                  PayBridge does not hold a separate destination account for you yet, so there is nothing to
                  choose here. If you would like your salary paid into a PayBridge Salary Account, you can request
                  one from My Pay — your employer reviews it, and your payroll process does not change.
                </InfoNote>
                <div className="mt-3">
                  <ActionButton variant="secondary" size="sm" to="/account/employee/pay">
                    Go to My Pay
                  </ActionButton>
                </div>
              </>
            )}

            <Divider className="my-4" />
            <SummaryRow label="You'll receive" value={naira(amount)} emphasis tone="primary" />

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row-reverse">
              <ActionButton size="lg" fullWidth onClick={() => setStep("confirm")}>
                Continue
              </ActionButton>
              <ActionButton variant="secondary" size="lg" fullWidth onClick={() => setStep("review")}>
                Back
              </ActionButton>
            </div>
          </Panel>
        ) : null}

        {/* ----------------------------------------------------------- confirm */}
        {step === "confirm" ? (
          <Panel
            title="Confirm your Bridge"
            description="This is the last step. Your request is decided as soon as you confirm."
          >
            <div className="divide-y divide-border/70">
              <SummaryRow label="Amount" value={naira(amount)} emphasis tone="primary" />
              <SummaryRow label="Service fee" value={naira(0)} />
              <SummaryRow
                label="Sending to"
                value={salaryAccount ? salaryAccount.newBankName : "Your existing salary account"}
              />
              <SummaryRow
                label="Settled from your pay on"
                value={payday ? longDate(payday) : "Your next payday"}
              />
            </div>

            {error ? (
              <InfoNote tone="attention" role="alert" className="mt-4">
                {error}
              </InfoNote>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
              <ActionButton
                size="lg"
                fullWidth
                loading={request.isPending}
                icon={<ShieldCheck className="h-4 w-4" />}
                onClick={() => void submit()}
              >
                Bridge {naira(amount)}
              </ActionButton>
              <ActionButton
                variant="secondary"
                size="lg"
                fullWidth
                disabled={request.isPending}
                onClick={() => setStep("account")}
              >
                Back
              </ActionButton>
            </div>
          </Panel>
        ) : null}

        {/* -------------------------------------------------------------- done */}
        {step === "done" && result ? (
          <Panel className={approved ? "border-success/30" : "border-gold/30"}>
            {approved ? <BridgeComplete /> : null}
            <div className="text-center">
              <span
                className={
                  approved
                    ? "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                    : "inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold"
                }
              >
                {approved ? <Check className="h-3.5 w-3.5" /> : null}
                {approved ? "Sent" : "Not approved"}
              </span>
              <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground">
                {approved ? "Your Bridge is Complete." : "This Bridge was not approved"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {approved
                  ? `${naira(settledAmount)} is on its way to ${
                      salaryAccount ? salaryAccount.newBankName : "your salary account"
                    }.`
                  : (result.rejectionReason ?? "No reason was recorded for this decision.")}
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
              <SummaryRow label="Amount requested" value={naira(result.requestedAmount)} />
              <SummaryRow label="Service fee" value={naira(0)} />
              {approved ? (
                <>
                  <SummaryRow label="You'll receive" value={naira(settledAmount)} emphasis tone="success" />
                  <SummaryRow
                    label="Settled from your pay on"
                    value={payday ? longDate(payday) : "Your next payday"}
                  />
                </>
              ) : null}
              {result.decidedAt ? (
                <SummaryRow label="Decided" value={new Date(result.decidedAt).toLocaleString("en-NG")} />
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
              <ActionButton size="lg" fullWidth to="/account/employee/transactions">
                View transactions
              </ActionButton>
              <ActionButton variant="secondary" size="lg" fullWidth onClick={restart}>
                {approved ? "Done" : "Try a different amount"}
              </ActionButton>
            </div>
          </Panel>
        ) : null}
      </div>

      {step === "amount" && draws.data?.items.length ? (
        <Panel title="Recent Bridge activity" className="mx-auto max-w-xl">
          <div className="space-y-2">
            {draws.data.items.slice(0, 6).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{d.reference}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(d.requestedAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-sm font-bold tnum text-foreground">{naira(d.requestedAmount)}</span>
                  <StatusBadge status={d.status} dot />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
