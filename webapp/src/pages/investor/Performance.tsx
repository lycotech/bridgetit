import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote, Divider } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { AsyncPanel, LoadingPanel } from "@/components/dashboard/states";
import {
  BarSeries,
  ChartTabs,
  DonutSplit,
  TrendChart,
  sliceSeries,
  useChartRange,
} from "@/components/dashboard/charts";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { InvestorDisclosure } from "@/components/investor/Disclosures";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, pct, shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";

export default function InvestorPerformancePage() {
  const investorId = useAccountId("investor");
  const range = useChartRange(["3M", "6M", "12M"]);
  const view = useChartRange(["Portfolio value", "Income"]);

  const overview = useQuery({
    queryKey: qk.investorOverview(investorId),
    queryFn: () => investorApi.overview(investorId),
  });
  const portfolios = useQuery({
    queryKey: qk.investorPortfolios(),
    queryFn: () => investorApi.portfolios(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="Portfolio performance"
        description="How your capital has performed across mandates. Indicative and not a forecast."
      />

      <AsyncPanel query={overview}>
        {(data) => {
          const investor = data.investor;
          const series = sliceSeries(data.performance, range.value);
          const first = series[0]?.value ?? 0;
          const last = series[series.length - 1]?.value ?? 0;
          const growth = first ? ((last - first) / first) * 100 : 0;
          const incomeSeries = series.map((point) => ({
            label: point.label,
            value: Math.round(point.value * 0.0045),
          }));

          return (
            <div className="space-y-6">
              <StatGrid columns={4}>
                <StatCard label="Portfolio value" value={naira(investor.portfolioValue)} tone="primary" />
                <StatCard
                  label="Change over period"
                  value={pct(growth)}
                  hint={`${range.value} · indicative`}
                  tone={growth >= 0 ? "protected" : "attention"}
                />
                <StatCard label="Net income earned" value={naira(investor.netIncomeEarned)} hint="After fees" />
                <StatCard label="Fees to date" value={naira(investor.feesToDate)} />
              </StatGrid>

              <Panel
                title={view.value}
                description="Use the filters to change the period and the measure."
                action={
                  <div className="flex flex-wrap gap-2">
                    <ChartTabs options={view.options} value={view.value} onChange={view.setValue} />
                    <ChartTabs options={range.options} value={range.value} onChange={range.setValue} />
                  </div>
                }
              >
                {view.value === "Income" ? (
                  <BarSeries data={incomeSeries} format={nairaCompact} tone="protected" />
                ) : (
                  <TrendChart data={series} format={nairaCompact} />
                )}
                <Divider />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Opening value</p>
                    <p className="mt-1 text-lg font-semibold text-foreground tnum">{naira(first)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Closing value</p>
                    <p className="mt-1 text-lg font-semibold text-foreground tnum">{naira(last)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capital deployed</p>
                    <p className="mt-1 text-lg font-semibold text-foreground tnum">
                      {naira(investor.capitalDeployed)}
                    </p>
                  </div>
                </div>
              </Panel>

              <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Allocation" description="Split of your capital across mandates.">
                  <DonutSplit
                    slices={data.allocation}
                    centerLabel="Portfolio"
                    centerValue={nairaCompact(investor.portfolioValue)}
                  />
                </Panel>

                <Panel title="Holding by mandate" description="Income and fees per mandate, to date.">
                  <ul className="space-y-2.5">
                    {data.investments.map((investment) => (
                      <li key={investment.id} className="rounded-2xl border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {investment.portfolioName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Since {shortDate(investment.startDate)} · matures{" "}
                              {shortDate(investment.maturityDate)}
                            </p>
                          </div>
                          <StatusBadge status={investment.status} />
                        </div>
                        <div className="mt-3 divide-y divide-border/70">
                          <SummaryRow label="Capital" value={naira(investment.amount)} />
                          <SummaryRow label="Income earned" value={naira(investment.incomeEarned)} tone="primary" />
                          <SummaryRow label="Fees charged" value={naira(investment.feesCharged)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <Panel title="Mandate targets" description="Indicative return targets set by the investment manager.">
                {portfolios.isLoading ? (
                  <LoadingPanel />
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-3">
                    {(portfolios.data ?? []).map((portfolio) => (
                      <li key={portfolio.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                        <p className="text-sm font-semibold text-foreground">{portfolio.name}</p>
                        <p className="mt-2 font-display text-xl font-extrabold text-foreground tnum">
                          {pct(portfolio.indicativeReturnPct)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Target p.a. · {portfolio.tenorMonths} months · {portfolio.distributionFrequency}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <InfoNote className="mt-4">
                  Targets are indicative. Actual returns depend on portfolio performance and are not guaranteed.
                </InfoNote>
              </Panel>

              <InvestorDisclosure />
            </div>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
