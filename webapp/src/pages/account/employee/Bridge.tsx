import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { BridgeGauge, gaugeStep } from "@/components/bridge/BridgeGauge";
import { BridgeAmountControl } from "@/components/bridge/AmountControl";
import { naira } from "@/lib/platform/format";
import { useBridgeDraws, useEligibility, useRequestBridgeDraw } from "@/lib/account/session";
import { EligibilitySection } from "@/pages/account/AccountHome";

/**
 * Real employee Bridge — `/account/employee/bridge`.
 *
 * Reuses the demo's signature Bridge Gauge / amount-control pair
 * (`components/bridge/BridgeGauge.tsx`, `AmountControl.tsx`) — both are
 * pure, portal-agnostic controlled inputs with no mock-data coupling, so
 * they carry over unchanged. What does NOT carry over is the demo's
 * multi-step journey (choose account → OTP → confirm): that models a
 * disbursement flow that doesn't exist in the real product yet (see
 * AGENTS.md, "Disbursement/Repayment") — the real system decides a draw
 * instantly on submit, so this stays one step.
 *
 * `fee={0}` below is not a placeholder — the real Bridge system charges no
 * fee today (`backend/src/routes/bridge.ts` has no fee concept at all), so
 * the gauge's fee line is honestly zero, not fabricated to match the demo's
 * invented pricing.
 */
export default function EmployeeBridge() {
  const eligibility = useEligibility(true);
  const draws = useBridgeDraws(true);
  const request = useRequestBridgeDraw();

  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; reference: string; reason: string | null } | null>(null);

  const available = eligibility.data?.earnedWageEstimate ?? 0;
  const payday = eligibility.data?.expectedPayDate ?? null;
  const step = gaugeStep(available);

  useEffect(() => {
    setResult(null);
  }, [amount]);

  const submit = async () => {
    setError(null);
    setResult(null);
    if (amount <= 0) {
      setError("Move the gauge or enter an amount to bridge.");
      return;
    }
    try {
      const draw = await request.mutateAsync({ amount });
      setResult({ status: draw.status, reference: draw.reference, reason: draw.rejectionReason });
      if (draw.status === "approved") setAmount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That request could not be processed.");
    }
  };

  if (!eligibility.data?.eligible) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bridge" description="Access a portion of pay you've already earned this cycle." />
        <EligibilitySection />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bridge" description="Move the gauge to choose how much of your earned pay comes to you now." />

      <Panel>
        <BridgeGauge
          available={available}
          value={amount}
          onChange={setAmount}
          payday={payday ?? new Date().toISOString()}
          fee={0}
        />
        <BridgeAmountControl available={available} value={amount} onChange={setAmount} step={step} fee={0} />

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {result ? (
          <InfoNote tone={result.status === "approved" ? "success" : "attention"} className="mt-3">
            {result.status === "approved"
              ? `Approved — reference ${result.reference}.`
              : `Not approved (${result.reference}): ${result.reason}`}
          </InfoNote>
        ) : null}

        <ActionButton className="mt-5 w-full" size="lg" loading={request.isPending} onClick={() => void submit()}>
          Bridge {amount > 0 ? naira(amount) : "It"}
        </ActionButton>
      </Panel>

      {draws.data?.items.length ? (
        <Panel title="Recent Bridge activity">
          <div className="space-y-2">
            {draws.data.items.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{d.reference}</p>
                  <p className="truncate text-xs text-muted-foreground">{new Date(d.requestedAt).toLocaleDateString("en-GB")}</p>
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
