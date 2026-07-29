import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ClipboardCheck, LineChart, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, ProgressMeter, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { EmptyState, LoadingPanel, ErrorState } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { MoneyField } from "@/components/dashboard/forms";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate, naira } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import type { InvestmentProduct, SuitabilityBand } from "@/lib/platform/models";

const BAND_ORDER: SuitabilityBand[] = ["Conservative", "Balanced", "Growth"];

const BAND_NOTE: Record<SuitabilityBand, string> = {
  Conservative: "Steadier products, shorter horizons, easier access.",
  Balanced: "A mix of income and growth over a few years.",
  Growth: "Longer horizons and larger movements in value.",
};

export default function EmployeeInvestPage() {
  const employeeId = useAccountId("employee");
  const queryClient = useQueryClient();

  const [assessing, setAssessing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<InvestmentProduct | null>(null);
  const [amount, setAmount] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [redeemId, setRedeemId] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState(0);

  const profile = useQuery({
    queryKey: qk.employeeSuitability(employeeId),
    queryFn: () => employeeApi.suitability(employeeId),
  });
  const questions = useQuery({
    queryKey: ["employee", "suitability-questions"],
    queryFn: () => employeeApi.suitabilityQuestions(),
  });
  const products = useQuery({
    queryKey: qk.employeeInvestProducts(),
    queryFn: () => employeeApi.investProducts(),
  });
  const holdings = useQuery({
    queryKey: qk.employeeHoldings(employeeId),
    queryFn: () => employeeApi.holdings(employeeId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.employeeHoldings(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeSuitability(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeOverview(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeWellbeing(employeeId) });
  };

  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "That did not go through");

  const submitAssessment = useMutation({
    mutationFn: () =>
      employeeApi.submitSuitability(
        Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
      ),
    onSuccess: (result) => {
      invalidate();
      setAssessing(false);
      toast.success(`Your profile is ${result.band}`);
    },
    onError,
  });

  const invest = useMutation({
    mutationFn: () => {
      if (!chosen) throw new Error("Nothing selected");
      return employeeApi.invest({ productId: chosen.id, amount });
    },
    onSuccess: () => {
      invalidate();
      setReviewing(false);
      setChosen(null);
      setAmount(0);
      toast.success("Your investment instruction has been placed");
    },
    onError,
  });

  const redeem = useMutation({
    mutationFn: () => {
      if (!redeemId) throw new Error("Nothing selected");
      return employeeApi.redeem(redeemId, redeemAmount);
    },
    onSuccess: () => {
      invalidate();
      setRedeemId(null);
      setRedeemAmount(0);
      toast.success("Redemption requested");
    },
    onError,
  });

  const band = profile.data?.band;
  const completed = profile.data?.completed ?? false;
  const list = holdings.data ?? [];
  const invested = list.reduce((sum, holding) => sum + holding.value, 0);
  const contributed = list.reduce((sum, holding) => sum + holding.contributed, 0);
  const growth = invested - contributed;
  const redeemTarget = list.find((holding) => holding.id === redeemId) ?? null;

  const suitable = useMemo(
    () => (product: InvestmentProduct) =>
      band ? BAND_ORDER.indexOf(product.band) <= BAND_ORDER.indexOf(band) : false,
    [band],
  );

  const answered = questions.data ? Object.keys(answers).length === questions.data.length : false;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Invest"
        title="Put your money to work"
        description="Professionally managed solutions across money market funds, treasury bills, government bonds, mutual funds, equity funds and managed portfolios — offered only where they suit you."
        actions={
          completed ? (
            <ActionButton
              variant="secondary"
              icon={<ClipboardCheck className="h-4 w-4" />}
              onClick={() => setAssessing(true)}
            >
              Review my profile
            </ActionButton>
          ) : null
        }
      />

      {profile.isLoading ? (
        <LoadingPanel />
      ) : !completed ? (
        <Panel title="First, a short suitability assessment" description="Five questions. About a minute.">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Investing is only right when it matches your timeline and your comfort with movement in value. We ask
            before we show you anything, and we only offer what fits your answers. Nothing is invested until you
            confirm.
          </p>
          <div className="mt-4">
            <ActionButton icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => setAssessing(true)}>
              Start the assessment
            </ActionButton>
          </div>
        </Panel>
      ) : (
        <>
          <StatGrid columns={4}>
            <StatCard
              label="Current value"
              value={naira(invested)}
              tone="primary"
              icon={<LineChart className="h-4 w-4" />}
            />
            <StatCard label="You put in" value={naira(contributed)} />
            <StatCard
              label="Change in value"
              value={`${growth >= 0 ? "+" : "−"}${naira(Math.abs(growth))}`}
              hint="Values move up and down"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Your profile"
              value={band ?? "—"}
              hint={band ? BAND_NOTE[band] : undefined}
              tone="protected"
              icon={<BadgeCheck className="h-4 w-4" />}
            />
          </StatGrid>

          <Panel title="Your holdings" description="Valued at the last available price.">
            {holdings.isLoading ? (
              <LoadingPanel />
            ) : holdings.isError ? (
              <ErrorState onRetry={() => void holdings.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState
                title="Nothing invested yet"
                body="When you are ready, start with a product matched to your profile below."
                icon={<LineChart className="h-5 w-5" />}
              />
            ) : (
              <div className="space-y-5">
                {list.map((holding, index) => {
                  const change = holding.value - holding.contributed;
                  return (
                    <div key={holding.id}>
                      {index > 0 ? <Divider className="mb-5" /> : null}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-bold text-foreground">
                            {holding.productName}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {holding.assetClass} · {holding.manager}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-extrabold text-foreground tnum">
                            {naira(holding.value)}
                          </p>
                          <p
                            className={
                              change >= 0
                                ? "text-xs font-semibold text-available tnum"
                                : "text-xs font-semibold text-muted-foreground tnum"
                            }
                          >
                            {change >= 0 ? "+" : "−"}
                            {naira(Math.abs(change))} since you invested
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 divide-y divide-border/70">
                        <SummaryRow label="You put in" value={naira(holding.contributed)} />
                        <SummaryRow label="Valued" value={longDate(holding.asOf)} tone="muted" />
                      </div>
                      <div className="mt-3">
                        <ActionButton
                          variant="secondary"
                          onClick={() => {
                            setRedeemId(holding.id);
                            setRedeemAmount(0);
                          }}
                        >
                          Redeem
                        </ActionButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            title="Products available to you"
            description="Matched against your suitability profile. Anything outside it stays visible, but closed."
          >
            {products.isLoading ? (
              <LoadingPanel />
            ) : products.isError ? (
              <ErrorState onRetry={() => void products.refetch()} />
            ) : (
              <div className="space-y-5">
                {(products.data ?? []).map((product, index) => {
                  const fits = suitable(product);
                  const openForBusiness = product.status === "Available";
                  return (
                    <div key={product.id}>
                      {index > 0 ? <Divider className="mb-5" /> : null}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-sm font-bold text-foreground">{product.name}</h3>
                            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {product.assetClass}
                            </span>
                            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {product.band}
                            </span>
                            {!openForBusiness ? (
                              <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                Awaiting approval
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        </div>
                        <div className="text-right">
                          {product.indicativeYieldPct ? (
                            <>
                              <p className="font-display text-xl font-extrabold text-foreground tnum">
                                {product.indicativeYieldPct}%
                              </p>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Indicative
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-semibold text-muted-foreground">Published on approval</p>
                          )}
                          {product.yieldBasis ? (
                            <p className="mt-0.5 max-w-[13rem] text-[11px] leading-snug text-muted-foreground/80">
                              {product.yieldBasis}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-3">
                        <p className="text-xs text-muted-foreground">From {naira(product.minimumAmount)}</p>
                        <p className="text-xs text-muted-foreground">{product.horizon}</p>
                        <p className="text-xs text-muted-foreground">{product.liquidity}</p>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
                        {product.disclosure}
                      </p>
                      <div className="mt-3">
                        {openForBusiness && fits ? (
                          <ActionButton
                            variant="secondary"
                            onClick={() => {
                              setChosen(product);
                              setAmount(product.minimumAmount);
                            }}
                          >
                            Invest in this
                          </ActionButton>
                        ) : (
                          <p className="text-xs font-medium text-muted-foreground">
                            {!openForBusiness
                              ? "Opens once regulatory approval is in place."
                              : `Outside your ${band} profile. Review your assessment if your circumstances have changed.`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </>
      )}

      <InfoNote tone="primary">
        <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
        All investment funds are managed by Invest-Trust Asset Management Limited, a SEC-licensed asset manager.
        PayBridge does not manage investment capital and does not give investment advice. Returns are not
        guaranteed, values can fall as well as rise, and past performance does not guarantee future results.
        Products remain subject to legal, regulatory and investment-manager approval.
      </InfoNote>

      {/* ---------------------------------------------- suitability assessment */}
      <Modal
        open={assessing}
        onClose={() => setAssessing(false)}
        title="Suitability assessment"
        description="Answer honestly — this decides what we offer you, not what you can afford."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setAssessing(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={submitAssessment.isPending}
              disabled={!answered}
              onClick={() => submitAssessment.mutate()}
            >
              Save my profile
            </ActionButton>
          </>
        }
      >
        {questions.isLoading ? (
          <LoadingPanel />
        ) : (
          <div className="space-y-5">
            {(questions.data ?? []).map((question) => (
              <fieldset key={question.id}>
                <legend className="text-sm font-semibold text-foreground">{question.question}</legend>
                <div className="mt-2 space-y-2">
                  {question.options.map((option) => {
                    const active = answers[question.id] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.value }))}
                        className={
                          active
                            ? "flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-primary bg-primary/8 px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition"
                            : "flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        }
                      >
                        <span
                          className={
                            active
                              ? "h-4 w-4 shrink-0 rounded-full border-[5px] border-primary"
                              : "h-4 w-4 shrink-0 rounded-full border border-border"
                          }
                          aria-hidden
                        />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {profile.data?.reviewedAt ? (
              <InfoNote>Last reviewed {longDate(profile.data.reviewedAt)}.</InfoNote>
            ) : null}
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------ invest: amount */}
      <Modal
        open={chosen !== null && !reviewing}
        onClose={() => setChosen(null)}
        title={chosen ? `Invest in ${chosen.name}` : "Invest"}
        description={chosen ? `${chosen.assetClass} · managed by ${chosen.manager}` : undefined}
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setChosen(null)}>
              Cancel
            </ActionButton>
            <ActionButton
              disabled={!chosen || amount < (chosen?.minimumAmount ?? 0)}
              onClick={() => setReviewing(true)}
            >
              Review
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <MoneyField
            label="Amount to invest"
            value={amount}
            onChange={setAmount}
            min={chosen?.minimumAmount ?? 0}
            quickAmounts={
              chosen
                ? [chosen.minimumAmount, chosen.minimumAmount * 2, chosen.minimumAmount * 5]
                : undefined
            }
            hint={chosen ? `Minimum ${naira(chosen.minimumAmount)} · ${chosen.horizon}` : undefined}
          />
          {chosen ? (
            <InfoNote>
              {chosen.disclosure} Only invest money you will not need before {chosen.horizon.toLowerCase()}.
            </InfoNote>
          ) : null}
        </div>
      </Modal>

      {/* ------------------------------------------------------ invest: review */}
      <Modal
        open={chosen !== null && reviewing}
        onClose={() => setReviewing(false)}
        title="Review your instruction"
        description="Nothing moves until you confirm."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setReviewing(false)}>
              Back
            </ActionButton>
            <ActionButton loading={invest.isPending} onClick={() => invest.mutate()}>
              Confirm investment
            </ActionButton>
          </>
        }
      >
        {chosen ? (
          <div className="space-y-4">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Product" value={chosen.name} />
              <SummaryRow label="Asset class" value={chosen.assetClass} />
              <SummaryRow label="Managed by" value={chosen.manager} />
              <SummaryRow label="Suggested horizon" value={chosen.horizon} />
              <SummaryRow label="Access" value={chosen.liquidity} />
              <SummaryRow label="Amount" value={naira(amount)} emphasis tone="primary" />
            </div>
            <InfoNote tone="attention">
              Returns are not guaranteed and the value of this investment can fall as well as rise. Past
              performance does not guarantee future results.
            </InfoNote>
          </div>
        ) : null}
      </Modal>

      {/* ------------------------------------------------------------- redeem */}
      <Modal
        open={redeemTarget !== null}
        onClose={() => setRedeemId(null)}
        title={redeemTarget ? `Redeem from ${redeemTarget.productName}` : "Redeem"}
        description="Proceeds land in your primary bank account."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setRedeemId(null)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={redeem.isPending}
              disabled={redeemAmount <= 0}
              onClick={() => redeem.mutate()}
            >
              Request redemption
            </ActionButton>
          </>
        }
      >
        {redeemTarget ? (
          <div className="space-y-4">
            <ProgressMeter
              value={redeemTarget.value ? (redeemAmount / redeemTarget.value) * 100 : 0}
              label="Share of this holding"
              right={naira(redeemTarget.value)}
              tone="primary"
            />
            <MoneyField
              label="Amount"
              value={redeemAmount}
              onChange={setRedeemAmount}
              max={redeemTarget.value}
              quickAmounts={[10_000, 25_000, Math.round(redeemTarget.value)]}
              hint={`Current value ${naira(redeemTarget.value)}`}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
