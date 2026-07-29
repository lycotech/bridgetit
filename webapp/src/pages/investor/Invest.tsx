import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, ProgressMeter } from "@/components/dashboard/Panel";
import { Modal } from "@/components/dashboard/Modal";
import { CheckboxField, MoneyField } from "@/components/dashboard/forms";
import { AsyncPanel, LoadingCards } from "@/components/dashboard/states";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { Stepper } from "@/components/dashboard/Stepper";
import { InvestorDisclosure } from "@/components/investor/Disclosures";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { naira, pct, shortDate } from "@/lib/platform/format";
import type { Portfolio } from "@/lib/platform/models";
import { useAccountId } from "@/lib/platform/use-account";

const STEPS = ["Choose mandate", "Amount", "Review", "Confirm"];

export default function InvestorInvestPage() {
  const investorId = useAccountId("investor");
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Portfolio | null>(null);
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState<{ reference: string; amount: number } | null>(null);

  const overview = useQuery({
    queryKey: qk.investorOverview(investorId),
    queryFn: () => investorApi.overview(investorId),
  });
  const portfolios = useQuery({
    queryKey: qk.investorPortfolios(),
    queryFn: () => investorApi.portfolios(),
  });

  const invest = useMutation({
    mutationFn: () =>
      investorApi.invest({ investorId, portfolioId: selected?.id ?? "", amount }),
    onSuccess: (investment) => {
      void queryClient.invalidateQueries({ queryKey: qk.investorOverview(investorId) });
      void queryClient.invalidateQueries({ queryKey: qk.investorInvestments(investorId) });
      void queryClient.invalidateQueries({ queryKey: qk.investorTransactions(investorId) });
      void queryClient.invalidateQueries({ queryKey: qk.investorPortfolios() });
      setDone({ reference: investment.reference, amount: investment.amount });
      setStep(0);
      setAccepted(false);
      setSelected(null);
      toast.success("Commitment recorded");
    },
    onError: (error: unknown) => {
      setStep(2);
      toast.error(error instanceof Error ? error.message : "We could not record that commitment");
    },
  });

  const verified = overview.data?.investor.kybStatus === "Verified";

  const open = (portfolio: Portfolio) => {
    setSelected(portfolio);
    setAmount(portfolio.minimumInvestment);
    setStep(1);
    setAccepted(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Invest"
        title="Approved portfolios and mandates"
        description="Choose a mandate, commit capital, and PayBridge's investment manager deploys it."
      />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Available to commit" className="lg:col-span-1">
              <p className="font-display text-2xl font-extrabold text-foreground tnum">
                {naira(data.investor.undeployedCapital)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">Awaiting deployment</p>
              <div className="mt-4 divide-y divide-border/70">
                <SummaryRow label="Capital committed" value={naira(data.investor.capitalCommitted)} />
                <SummaryRow label="Capital deployed" value={naira(data.investor.capitalDeployed)} />
                <SummaryRow label="Verification" value={<StatusBadge status={data.investor.kybStatus} />} />
              </div>
              {!verified ? (
                <InfoNote className="mt-4">
                  Your KYB verification must be approved before you can commit capital.{" "}
                  <a href="/investor/documents" className="font-semibold text-primary hover:underline">
                    Complete verification
                  </a>
                </InfoNote>
              ) : null}
            </Panel>

            <div className="lg:col-span-2">
              <Panel title="How commitments work" description="Four short steps, reviewed before anything is final.">
                <Stepper steps={STEPS} current={0} />
                <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Capital is pooled into the mandate you choose — never allocated to an individual employee.
                  </li>
                  <li className="flex gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Funds are held with the mandate's appointed custodian and deployed by the investment manager.
                  </li>
                  <li className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    You see every deployment, distribution and fee in your transactions and statements.
                  </li>
                </ul>
              </Panel>
            </div>
          </div>
        )}
      </AsyncPanel>

      {portfolios.isLoading ? (
        <LoadingCards />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {(portfolios.data ?? []).map((portfolio) => (
            <Panel
              key={portfolio.id}
              title={portfolio.name}
              description={portfolio.summary}
              footer={
                <ActionButton
                  fullWidth
                  disabled={!verified || portfolio.status === "Closed"}
                  onClick={() => open(portfolio)}
                >
                  {portfolio.status === "Closed" ? "Closed to new capital" : "Commit capital"}
                </ActionButton>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={portfolio.status} />
                <RiskPill level={portfolio.riskLevel} />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{portfolio.detail}</p>
              <div className="mt-4 divide-y divide-border/70">
                <SummaryRow
                  label="Indicative return"
                  value={`${pct(portfolio.indicativeReturnPct)} p.a.`}
                  hint="Target, not guaranteed"
                  emphasis
                  tone="primary"
                />
                <SummaryRow label="Minimum" value={naira(portfolio.minimumInvestment)} />
                <SummaryRow label="Tenor" value={`${portfolio.tenorMonths} months`} />
                <SummaryRow label="Liquidity" value={portfolio.liquidity} />
                <SummaryRow label="Distributions" value={portfolio.distributionFrequency} />
              </div>
              <div className="mt-4">
                <ProgressMeter
                  value={
                    portfolio.capitalUnderManagement
                      ? (portfolio.capitalDeployed / portfolio.capitalUnderManagement) * 100
                      : 0
                  }
                  label="Deployed"
                  right={`${naira(portfolio.capitalDeployed)} of ${naira(portfolio.capitalUnderManagement)}`}
                />
                <p className="mt-2 text-xs text-muted-foreground">{portfolio.investorCount} investors</p>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <InvestorDisclosure />

      {/* Commitment journey */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Commit capital"}
        description={selected?.summary}
        size="wide"
        footer={
          selected ? (
            step === 1 ? (
              <>
                <ActionButton variant="secondary" onClick={() => setSelected(null)}>
                  Cancel
                </ActionButton>
                <ActionButton
                  disabled={amount < selected.minimumInvestment}
                  onClick={() => setStep(2)}
                >
                  Review
                </ActionButton>
              </>
            ) : (
              <>
                <ActionButton variant="ghost" onClick={() => setStep(1)}>
                  Back
                </ActionButton>
                <ActionButton
                  disabled={!accepted}
                  loading={invest.isPending}
                  onClick={() => {
                    setStep(3);
                    invest.mutate();
                  }}
                >
                  Confirm commitment
                </ActionButton>
              </>
            )
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <Stepper steps={STEPS} current={step} />

            {step === 1 ? (
              <div className="space-y-4">
                <MoneyField
                  label="Amount to commit"
                  value={amount}
                  onChange={setAmount}
                  quickAmounts={[
                    selected.minimumInvestment,
                    selected.minimumInvestment * 2,
                    selected.minimumInvestment * 5,
                  ]}
                  hint={`Minimum ${naira(selected.minimumInvestment)}`}
                />
                <InfoNote>
                  Your commitment is deployed by the investment manager in line with the mandate. It is not
                  matched to any individual employee.
                </InfoNote>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-border/70">
                  <SummaryRow label="Mandate" value={selected.name} />
                  <SummaryRow label="Amount committed" value={naira(amount)} emphasis tone="primary" />
                  <SummaryRow label="Indicative return" value={`${pct(selected.indicativeReturnPct)} p.a.`} hint="Target, not guaranteed" />
                  <SummaryRow label="Tenor" value={`${selected.tenorMonths} months`} />
                  <SummaryRow label="Distributions" value={selected.distributionFrequency} />
                  <SummaryRow label="Liquidity" value={selected.liquidity} />
                  <SummaryRow label="Funding instructions" value="Bank transfer, sent by email" />
                </div>
                <CheckboxField
                  checked={accepted}
                  onChange={setAccepted}
                  label="I have read the mandate documents and understand that returns are not guaranteed and my capital may be at risk."
                />
                <InvestorDisclosure />
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Confirmation */}
      <Modal
        open={Boolean(done)}
        onClose={() => setDone(null)}
        title="Commitment recorded"
        description="We have emailed your funding instructions."
        footer={
          <>
            <ActionButton variant="secondary" to="/investor/transactions" onClick={() => setDone(null)}>
              View transactions
            </ActionButton>
            <ActionButton onClick={() => setDone(null)}>Done</ActionButton>
          </>
        }
      >
        {done ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.07] p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Amount committed</p>
              <p className="mt-2 font-display text-3xl font-extrabold text-foreground tnum">
                {naira(done.amount)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Reference {done.reference}</p>
            </div>
            <div className="divide-y divide-border/70">
              <SummaryRow label="Status" value={<StatusBadge status="Pending funding" />} />
              <SummaryRow label="Expected deployment" value={shortDate(new Date().toISOString())} hint="Once funds are received and reconciled" />
            </div>
            <InfoNote>
              Your capital is deployed only after funds are received and reconciled by the investment manager.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
