import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/dashboard/Modal";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { MoneyField } from "@/components/dashboard/forms";
import { useCreateSavingsGoal, useEligibility, useSavingsDeposit, useSavingsGoals } from "@/lib/account/session";

/**
 * AI Assist — real counterpart of the demo-only mock widget. Keeps the
 * useful, real part (suggest setting aside part of unused earned pay into
 * real Savings) and drops the mock's interest-rate projection: real Savings
 * goals carry no rate/product concept anywhere in this codebase, so there is
 * nothing honest to project. Explicitly rules-based, not a live AI call —
 * same as the mock's own framing, just without a number this system cannot
 * back up.
 */
export function AIAssistWidget() {
  const { data: eligibility } = useEligibility(true);
  const goals = useSavingsGoals(true);
  const createGoal = useCreateSavingsGoal();
  const deposit = useSavingsDeposit();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [goalId, setGoalId] = useState<string>("");
  const [newGoalLabel, setNewGoalLabel] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const excess = eligibility?.earnedWageEstimate ?? 0;
  const suggested = Math.max(0, Math.round((excess * 0.4) / 1_000) * 1_000);

  useEffect(() => {
    if (!seeded && excess > 0) {
      setAmount(suggested);
      setSeeded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excess, seeded]);

  useEffect(() => {
    if (!goalId && goals.data?.items.length) setGoalId(goals.data.items[0].id);
  }, [goalId, goals.data]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    try {
      let targetGoalId = goalId;
      if (!targetGoalId) {
        if (!newGoalLabel.trim()) {
          setError("Name your new savings goal, or choose an existing one.");
          return;
        }
        const goal = await createGoal.mutateAsync({ label: newGoalLabel });
        targetGoalId = goal.id;
      }
      await deposit.mutateAsync({ goalId: targetGoalId, amount });
      setSuccess("Deposit recorded.");
      setNewGoalLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be recorded.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-3 text-sm font-semibold text-primary shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <Sparkles className="h-4 w-4" /> AI Assist
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Your savings, worked out for you"
        description={
          excess > 0
            ? `You currently have ₦${excess.toLocaleString("en-NG")} available that you haven't bridged. Setting part of it aside instead could quietly grow.`
            : "Once you have earned pay available and unused, this is where a savings suggestion will appear."
        }
        footer={
          excess > 0 ? (
            <>
              <ActionButton variant="secondary" onClick={() => setOpen(false)}>
                Not now
              </ActionButton>
              <ActionButton onClick={() => void submit()} loading={deposit.isPending || createGoal.isPending}>
                Set it aside
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
          <div className="space-y-3">
            <MoneyField
              label="Amount to set aside"
              value={amount}
              onChange={setAmount}
              max={excess}
              quickAmounts={[Math.round(excess * 0.25), suggested, excess].filter((v, i, a) => a.indexOf(v) === i)}
              hint={`Up to ₦${excess.toLocaleString("en-NG")} available today`}
            />

            {goals.data?.items.length ? (
              <label className="block text-sm font-medium text-muted-foreground">
                Savings goal
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  className="mt-1.5 block h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
                >
                  {goals.data.items.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                  <option value="">+ New goal</option>
                </select>
              </label>
            ) : null}

            {!goalId ? (
              <input
                type="text"
                placeholder="Goal name, e.g. Rent buffer"
                value={newGoalLabel}
                onChange={(e) => setNewGoalLabel(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
              />
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? <p className="text-sm text-success">{success}</p> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
