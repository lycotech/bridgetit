import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/dashboard/Modal";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { MoneyField } from "@/components/dashboard/forms";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { naira } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { cn } from "@/lib/utils";
import type { SavingsProduct } from "@/lib/platform/models";

const TERMS = [3, 6, 12] as const;

/** Highest-rate plan the amount actually qualifies for — falls back to whatever is open. */
function bestProductFor(amount: number, products: SavingsProduct[]): SavingsProduct | null {
  const open = products.filter((p) => p.status === "Available");
  const eligible = open.filter((p) => amount >= p.minimumAmount);
  const pool = eligible.length > 0 ? eligible : open;
  if (pool.length === 0) return null;
  return pool.reduce((best, p) => (p.ratePct ?? 0) > (best.ratePct ?? 0) ? p : best);
}

/** Simple, non-compounding projection — the same "per annum" basis shown on every plan's disclosure. */
function projectedInterest(amount: number, ratePct: number, months: number): number {
  return Math.round(amount * (ratePct / 100) * (months / 12));
}

/**
 * A lightweight, rules-based nudge — not a live AI call. Framed as "AI Assist" for the demo, but
 * everything it says is computed here from the employee's own numbers and the published product
 * rates, same honesty bar as the rest of Save (see savings products' own disclosure text).
 */
export function AIAssistWidget() {
  const employeeId = useAccountId("employee");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [months, setMonths] = useState<(typeof TERMS)[number]>(6);
  const [seeded, setSeeded] = useState(false);

  const overview = useQuery({
    queryKey: qk.employeeOverview(employeeId),
    queryFn: () => employeeApi.overview(employeeId),
  });
  const products = useQuery({
    queryKey: qk.employeeSavingsProducts(),
    queryFn: () => employeeApi.savingsProducts(),
  });

  const excess = overview.data?.remainingAvailable ?? 0;
  const suggested = Math.max(0, Math.round((excess * 0.4) / 1_000) * 1_000);

  /* Seed the field with the suggested amount once, the first time we have real data —
     after that the employee's own edits win, even if the query refetches. */
  if (!seeded && overview.data) {
    setAmount(suggested);
    setSeeded(true);
  }

  const plan = useMemo(() => bestProductFor(amount || suggested, products.data ?? []), [amount, suggested, products.data]);
  const interest = plan ? projectedInterest(amount, plan.ratePct ?? 0, months) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-4 z-30 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition hover:brightness-110 sm:right-6"
      >
        <Sparkles className="h-4 w-4" />
        AI Assist
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Your savings, worked out for you"
        description={
          excess > 0
            ? `You currently have ${naira(excess)} available that you haven't bridged. Setting part of it aside instead could quietly grow.`
            : "Once you have earned pay available and unused, this is where a savings suggestion will appear."
        }
        size="wide"
        footer={
          excess > 0 ? (
            <>
              <ActionButton variant="secondary" onClick={() => setOpen(false)}>
                Not now
              </ActionButton>
              <ActionButton
                onClick={() => {
                  setOpen(false);
                  navigate("/employee/savings");
                }}
              >
                Open a savings plan
              </ActionButton>
            </>
          ) : (
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Close
            </ActionButton>
          )
        }
      >
        {excess > 0 ? (
          <div className="space-y-5">
            <MoneyField
              label="Amount to set aside"
              value={amount}
              onChange={setAmount}
              max={excess}
              quickAmounts={[Math.round(excess * 0.25 / 1_000) * 1_000, suggested, excess]}
              hint={`Up to ${naira(excess)} available today`}
            />

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Project over
              </p>
              <div className="flex gap-2">
                {TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setMonths(term)}
                    className={cn(
                      "min-h-[40px] flex-1 rounded-xl border px-3 text-sm font-semibold transition",
                      months === term
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {term} months
                  </button>
                ))}
              </div>
            </div>

            {plan ? (
              <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                <div className="divide-y divide-border/70">
                  <SummaryRow label="Plan" value={`${plan.name} · ${plan.ratePct}% p.a.`} />
                  <SummaryRow label="Amount set aside" value={naira(amount)} />
                  <SummaryRow
                    label={`Projected interest (${months} months)`}
                    value={naira(interest)}
                    tone="primary"
                  />
                  <SummaryRow label="Projected total" value={naira(amount + interest)} emphasis tone="primary" />
                </div>
              </div>
            ) : null}

            <InfoNote>
              Illustrative only, worked out from {plan?.name ?? "the plan above"}'s published rate. Not a guaranteed
              return — actual interest depends on the amounts you actually set aside and can change with the
              approved offering.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
