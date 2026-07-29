import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpRight, Plus, ShieldCheck, Sprout } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, ProgressMeter, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { EmptyState, LoadingPanel, ErrorState } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { MoneyField, SelectField, TextField } from "@/components/dashboard/forms";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";

const ALLOCATIONS = ["0", "1", "2", "3", "5", "7", "10"];

type Movement = { goalId: string; goalName: string; direction: "in" | "out"; balance: number };

export default function EmployeeSavePage() {
  const employeeId = useAccountId("employee");
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(0);
  const [allocation, setAllocation] = useState("2");
  const [productId, setProductId] = useState("");
  const [movement, setMovement] = useState<Movement | null>(null);
  const [movementAmount, setMovementAmount] = useState(0);

  const goals = useQuery({
    queryKey: qk.employeeSavings(employeeId),
    queryFn: () => employeeApi.savings(employeeId),
  });
  const products = useQuery({
    queryKey: qk.employeeSavingsProducts(),
    queryFn: () => employeeApi.savingsProducts(),
  });

  const openProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.status === "Available"),
    [products.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.employeeSavings(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeOverview(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeWellbeing(employeeId) });
  };

  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "That did not go through");

  const updateAllocation = useMutation({
    mutationFn: (input: { goalId: string; pct: number }) =>
      employeeApi.updateSavings(employeeId, input.goalId, input.pct),
    onSuccess: () => {
      invalidate();
      toast.success("Payday amount updated");
    },
    onError,
  });

  const addPlan = useMutation({
    mutationFn: () =>
      employeeApi.addSavingsGoal({
        name,
        target,
        allocationPct: Number(allocation),
        productId: productId || openProducts[0]?.id || "",
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setName("");
      setTarget(0);
      toast.success("Savings plan opened");
    },
    onError,
  });

  const moveMoney = useMutation({
    mutationFn: () => {
      if (!movement) throw new Error("Nothing selected");
      return movement.direction === "in"
        ? employeeApi.topUpSavings(movement.goalId, movementAmount)
        : employeeApi.withdrawSavings(movement.goalId, movementAmount);
    },
    onSuccess: () => {
      invalidate();
      toast.success(movement?.direction === "in" ? "Money added" : "Money on its way to you");
      setMovement(null);
      setMovementAmount(0);
    },
    onError,
  });

  const list = goals.data ?? [];
  const totalSaved = list.reduce((sum, goal) => sum + goal.balance, 0);
  const totalInterest = list.reduce((sum, goal) => sum + (goal.interestEarned ?? 0), 0);
  const totalAllocation = list.reduce((sum, goal) => sum + goal.allocationPct, 0);

  const startPlan = (preselect?: string) => {
    setProductId(preselect ?? openProducts[0]?.id ?? "");
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Save"
        title="Build a cushion that holds"
        description="Structured savings plans that put a share of each payday aside automatically. The stronger your cushion, the less of your earned pay you need to bring forward."
        actions={
          <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => startPlan()}>
            Open a plan
          </ActionButton>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Total saved"
          value={naira(totalSaved)}
          tone="protected"
          icon={<Sprout className="h-4 w-4" />}
        />
        <StatCard label="Interest earned" value={naira(totalInterest)} hint="Accrued to date, before tax" />
        <StatCard label="Set aside each payday" value={`${totalAllocation}%`} hint="Of your monthly salary" />
        <StatCard label="Active plans" value={String(list.length)} />
      </StatGrid>

      {goals.isLoading ? (
        <LoadingPanel />
      ) : goals.isError ? (
        <ErrorState onRetry={() => void goals.refetch()} className="rounded-2xl border border-border bg-card" />
      ) : list.length === 0 ? (
        <Panel>
          <EmptyState
            title="No savings plan yet"
            body="Start with something small — a transport fund or a school-fees goal — and let it build in the background."
            icon={<Sprout className="h-5 w-5" />}
            action={<ActionButton onClick={() => startPlan()}>Open a plan</ActionButton>}
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {list.map((goal) => (
            <Panel key={goal.id} title={goal.name} description={goal.productName}>
              <ProgressMeter
                value={goal.target ? (goal.balance / goal.target) * 100 : 0}
                label="Progress"
                right={`${naira(goal.balance)} of ${naira(goal.target)}`}
                tone="protected"
              />
              <div className="mt-4 divide-y divide-border/70">
                <SummaryRow label="Set aside each payday" value={`${goal.allocationPct}% of salary`} />
                <SummaryRow label="Next deduction" value={longDate(goal.nextDeduction)} />
                <SummaryRow label="Interest earned" value={naira(goal.interestEarned ?? 0)} tone="primary" />
                <SummaryRow label="Still to go" value={naira(Math.max(0, goal.target - goal.balance))} />
                {goal.maturesAt ? (
                  <SummaryRow label="Matures" value={longDate(goal.maturesAt)} tone="muted" />
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton
                  variant="secondary"
                  icon={<ArrowUpRight className="h-4 w-4" />}
                  onClick={() => {
                    setMovement({ goalId: goal.id, goalName: goal.name, direction: "in", balance: goal.balance });
                    setMovementAmount(0);
                  }}
                >
                  Add money
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  icon={<ArrowDownToLine className="h-4 w-4" />}
                  onClick={() => {
                    setMovement({ goalId: goal.id, goalName: goal.name, direction: "out", balance: goal.balance });
                    setMovementAmount(0);
                  }}
                >
                  Withdraw
                </ActionButton>
              </div>
              <div className="mt-4">
                <SelectField
                  label="Change payday amount"
                  value={String(goal.allocationPct)}
                  onChange={(value) => updateAllocation.mutate({ goalId: goal.id, pct: Number(value) })}
                  options={ALLOCATIONS.map((value) => ({ value, label: `${value}% of salary` }))}
                  hint="Takes effect from your next payday."
                />
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel
        title="Savings plans available to you"
        description="Every plan is held and administered by the licensed asset manager named below."
      >
        {products.isLoading ? (
          <LoadingPanel />
        ) : products.isError ? (
          <ErrorState onRetry={() => void products.refetch()} />
        ) : (
          <div className="space-y-4">
            {(products.data ?? []).map((product, index) => (
              <div key={product.id}>
                {index > 0 ? <Divider className="mb-4" /> : null}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-foreground">{product.name}</h3>
                      <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {product.type}
                      </span>
                      {product.status === "Pending approval" ? (
                        <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                          Coming soon
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                  </div>
                  <div className="text-right">
                    {product.ratePct ? (
                      <p className="font-display text-xl font-extrabold text-foreground tnum">
                        {product.ratePct}%
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">Rate on approval</p>
                    )}
                    {product.rateBasis ? (
                      <p className="mt-0.5 max-w-[13rem] text-[11px] leading-snug text-muted-foreground/80">
                        {product.rateBasis}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <p className="text-xs text-muted-foreground">
                    From {naira(product.minimumAmount)}
                    {product.tenorDays ? ` · ${product.tenorDays}-day tenor` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{product.liquidity}</p>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">{product.disclosure}</p>
                {product.status === "Available" ? (
                  <div className="mt-3">
                    <ActionButton variant="secondary" onClick={() => startPlan(product.id)}>
                      Open this plan
                    </ActionButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <InfoNote tone="primary">
        <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
        Savings balances are held separately from PayBridge working capital and administered by{" "}
        {openProducts[0]?.manager ?? "the appointed asset manager"}. Published rates are indicative, shown in line
        with the approved offering, and can change. Flexible balances can be withdrawn at any time; fixed plans
        apply early-exit terms.
      </InfoNote>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Open a savings plan"
        description="Choose a plan, name your goal, and decide how much of each payday goes in."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={addPlan.isPending}
              disabled={name.trim().length < 2 || target <= 0 || !productId}
              onClick={() => addPlan.mutate()}
            >
              Open plan
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Savings plan"
            value={productId}
            onChange={setProductId}
            options={openProducts.map((product) => ({
              value: product.id,
              label: product.ratePct ? `${product.name} — ${product.ratePct}%` : product.name,
            }))}
            hint={openProducts.find((p) => p.id === productId)?.liquidity}
          />
          <TextField label="Goal name" value={name} onChange={setName} placeholder="School fees" />
          <MoneyField
            label="Target amount"
            value={target}
            onChange={setTarget}
            quickAmounts={[50_000, 100_000, 250_000]}
            hint={
              productId
                ? `Starts from ${naira(openProducts.find((p) => p.id === productId)?.minimumAmount ?? 0)}`
                : undefined
            }
          />
          <SelectField
            label="Set aside each payday"
            value={allocation}
            onChange={setAllocation}
            options={ALLOCATIONS.map((value) => ({ value, label: `${value}% of salary` }))}
          />
        </div>
      </Modal>

      <Modal
        open={movement !== null}
        onClose={() => setMovement(null)}
        title={movement?.direction === "in" ? `Add to ${movement?.goalName}` : `Withdraw from ${movement?.goalName}`}
        description={
          movement?.direction === "in"
            ? "This comes from your salary account and lands in your plan today."
            : "Withdrawals from flexible plans arrive the same day."
        }
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setMovement(null)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={moveMoney.isPending}
              disabled={movementAmount <= 0}
              onClick={() => moveMoney.mutate()}
            >
              {movement?.direction === "in" ? "Add money" : "Withdraw"}
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <MoneyField
            label="Amount"
            value={movementAmount}
            onChange={setMovementAmount}
            max={movement?.direction === "out" ? movement.balance : undefined}
            quickAmounts={[5_000, 10_000, 25_000]}
            hint={movement ? `Plan balance ${naira(movement.balance)}` : undefined}
          />
        </div>
      </Modal>
    </div>
  );
}
