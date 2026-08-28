import { useQuery } from "@tanstack/react-query";
import { Briefcase, Coins, PiggyBank, TrendingUp } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, Divider, ProgressMeter } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { AsyncPanel } from "@/components/dashboard/states";
import { ChartTabs, DonutSplit, TrendChart, sliceSeries, useChartRange } from "@/components/dashboard/charts";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { InvestorDisclosure } from "@/components/investor/Disclosures";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, pct, shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { LiveModeTabs } from "@/components/investor/LiveModeTabs";
import { InvestmentSection } from "@/pages/account/AccountHome";

export default function InvestorOverviewPage() {
  const investorId = useAccountId("investor");
  const range = useChartRange(["3M", "6M", "12M"]);

  const overview = useQuery({
    queryKey: qk.investorOverview(investorId),
    queryFn: () => investorApi.overview(investorId),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investor"
        title="Capital working where it matters"
        description="Your position across PayBridge's approved portfolios and funding mandates."
        actions={<ActionButton to="/investor/invest">Commit capital</ActionButton>}
      />

      <LiveModeTabs
        gateTitle="Account sign-in required"
        gateDescription="Sign in to your real PayBridge account to see your real committed capital and portfolio snapshot instead of demo data."
        live={<InvestmentSection />}
        demo={
      <AsyncPanel query={overview}>
        {(data) => {
          const investor = data.investor;
          const deployedPct = investor.capitalCommitted
            ? (investor.capitalDeployed / investor.capitalCommitted) * 100
            : 0;
          return (
            <div className="space-y-6">
              <StatGrid columns={4}>
                <StatCard
                  label="Portfolio value"
                  value={naira(investor.portfolioValue)}
                  hint={`${investor.type} investor`}
                  icon={<Briefcase className="h-4 w-4" />}
                  tone="primary"
                />
                <StatCard
                  label="Capital deployed"
                  value={naira(investor.capitalDeployed)}
                  hint={`${pct(deployedPct)} of commitments`}
                  tone="protected"
                />
                <StatCard
                  label="Net income earned"
                  value={naira(investor.netIncomeEarned)}
                  hint="After fees, to date"
                  icon={<TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                  label="Available for withdrawal"
                  value={naira(investor.availableForWithdrawal)}
                  icon={<PiggyBank className="h-4 w-4" />}
                />
              </StatGrid>

              <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
                <Panel
                  title="Portfolio performance"
                  description="Portfolio value over time. Indicative only."
                  action={<ChartTabs options={range.options} value={range.value} onChange={range.setValue} />}
                >
                  <TrendChart data={sliceSeries(data.performance, range.value)} format={nairaCompact} />
                  <Divider />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Capital committed</p>
                      <p className="mt-1 text-lg font-semibold text-foreground tnum">
                        {naira(investor.capitalCommitted)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Awaiting deployment</p>
                      <p className="mt-1 text-lg font-semibold text-foreground tnum">
                        {naira(investor.undeployedCapital)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fees to date</p>
                      <p className="mt-1 text-lg font-semibold text-foreground tnum">
                        {naira(investor.feesToDate)}
                      </p>
                    </div>
                  </div>
                </Panel>

                <div className="space-y-6">
                  <Panel title="Allocation" description="Where your capital currently sits.">
                    <DonutSplit
                      slices={data.allocation}
                      centerLabel="Portfolio"
                      centerValue={nairaCompact(investor.portfolioValue)}
                    />
                  </Panel>

                  <Panel title="Your account">
                    <ProgressMeter
                      value={deployedPct}
                      label="Capital deployed"
                      right={`${naira(investor.capitalDeployed)} of ${naira(investor.capitalCommitted)}`}
                      tone="protected"
                    />
                    <div className="mt-4 divide-y divide-border/70">
                      <SummaryRow label="Verification" value={<StatusBadge status={investor.kybStatus} />} />
                      <SummaryRow label="Accreditation" value={investor.accreditation} />
                      <SummaryRow label="Risk profile" value={<RiskPill level={investor.riskProfile} />} />
                      <SummaryRow label="Investor since" value={shortDate(investor.joinedAt)} />
                    </div>
                  </Panel>
                </div>
              </div>

              <Panel
                title="Your mandates"
                description="Each holding sits inside an approved portfolio."
                action={
                  <ActionButton to="/investor/transactions" size="sm" variant="ghost">
                    View transactions
                  </ActionButton>
                }
              >
                <ul className="space-y-2.5">
                  {data.investments.map((investment) => (
                    <li key={investment.id} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Coins className="h-3.5 w-3.5 text-gold" />
                            {investment.portfolioName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {investment.reference} · {investment.distributionFrequency} distributions
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground tnum">{naira(investment.amount)}</p>
                          <StatusBadge status={investment.status} className="mt-1" />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>Income earned {naira(investment.incomeEarned)}</span>
                        <span>Fees {naira(investment.feesCharged)}</span>
                        <span>Matures {shortDate(investment.maturityDate)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <InfoNote className="mt-4">
                  Next settlement dates and distribution amounts are confirmed by the investment manager each
                  cycle.
                </InfoNote>
              </Panel>

              <InvestorDisclosure />
            </div>
          );
        }}
      </AsyncPanel>
        }
      />
    </div>
  );
}
