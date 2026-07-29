import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, ProgressMeter, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { DonutSplit } from "@/components/dashboard/charts";
import { AsyncPanel } from "@/components/dashboard/states";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { naira, nairaCompact, pct, ratioPct, shortDate } from "@/lib/platform/format";
import type { AllocationSlice, Investment } from "@/lib/platform/models";

const TONES: AllocationSlice["tone"][] = ["primary", "available", "protected", "gold", "muted"];

export default function OperationsPortfoliosPage() {
  const [selected, setSelected] = useState<Investment | null>(null);

  const portfolios = useQuery({ queryKey: qk.ops("portfolios"), queryFn: () => opsApi.portfolios() });

  const columns: Column<Investment>[] = [
    {
      key: "reference",
      header: "Investment",
      render: (row) => <CellStack primary={row.reference} secondary={row.investorName} />,
      sortValue: (row) => row.startDate,
    },
    {
      key: "portfolio",
      header: "Mandate",
      hideBelow: "md",
      render: (row) => <span className="text-muted-foreground">{row.portfolioName}</span>,
      sortValue: (row) => row.portfolioName,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="font-semibold tnum">{nairaCompact(row.amount)}</span>,
      sortValue: (row) => row.amount,
    },
    {
      key: "income",
      header: "Income",
      align: "right",
      hideBelow: "lg",
      render: (row) => (
        <CellStack
          primary={<span className="tnum">{nairaCompact(row.incomeEarned)}</span>}
          secondary={`fees ${nairaCompact(row.feesCharged)}`}
        />
      ),
      sortValue: (row) => row.incomeEarned,
    },
    {
      key: "maturity",
      header: "Maturity",
      hideBelow: "sm",
      render: (row) => <span className="text-muted-foreground">{shortDate(row.maturityDate)}</span>,
      sortValue: (row) => row.maturityDate,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolios"
        title="Mandates and capital under management"
        description="How investor capital is allocated across each approved portfolio, and every investment inside it."
      />

      <AsyncPanel query={portfolios}>
        {(data) => {
          const cum = data.portfolios.reduce((sum, row) => sum + row.capitalUnderManagement, 0);
          const deployed = data.portfolios.reduce((sum, row) => sum + row.capitalDeployed, 0);
          const slices: AllocationSlice[] = data.portfolios.map((portfolio, index) => ({
            label: portfolio.name,
            value: portfolio.capitalUnderManagement,
            tone: TONES[index % TONES.length],
          }));

          return (
            <div className="space-y-6">
              <StatGrid columns={4}>
                <StatCard label="Under management" value={nairaCompact(cum)} tone="primary" />
                <StatCard
                  label="Deployed"
                  value={nairaCompact(deployed)}
                  hint={`${ratioPct(deployed, cum)}% of capital`}
                  tone="protected"
                />
                <StatCard label="Available to deploy" value={nairaCompact(cum - deployed)} />
                <StatCard
                  label="Investors"
                  value={String(data.portfolios.reduce((sum, row) => sum + row.investorCount, 0))}
                  hint={`${data.portfolios.length} mandates`}
                />
              </StatGrid>

              <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
                <Panel title="Allocation by mandate" description="Capital under management.">
                  <DonutSplit
                    slices={slices}
                    centerLabel="Total"
                    centerValue={nairaCompact(cum)}
                    format={nairaCompact}
                  />
                </Panel>

                <div className="space-y-4">
                  {data.portfolios.map((portfolio) => (
                    <Panel key={portfolio.id} title={portfolio.name} description={portfolio.summary}>
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <StatusBadge status={portfolio.status} />
                        <RiskPill level={portfolio.riskLevel} />
                        <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          {portfolio.investorCount} investors
                        </span>
                      </div>
                      <ProgressMeter
                        value={ratioPct(portfolio.capitalDeployed, portfolio.capitalUnderManagement)}
                        label="Capital deployed"
                        right={`${nairaCompact(portfolio.capitalDeployed)} of ${nairaCompact(portfolio.capitalUnderManagement)}`}
                      />
                      <div className="mt-4 divide-y divide-border/70">
                        <SummaryRow
                          label="Indicative return"
                          value={`${pct(portfolio.indicativeReturnPct)} a year`}
                          hint="Target, not guaranteed"
                        />
                        <SummaryRow label="Minimum investment" value={naira(portfolio.minimumInvestment)} />
                        <SummaryRow label="Tenor" value={`${portfolio.tenorMonths} months`} />
                        <SummaryRow label="Liquidity" value={portfolio.liquidity} />
                        <SummaryRow label="Distributions" value={portfolio.distributionFrequency} />
                      </div>
                    </Panel>
                  ))}
                </div>
              </div>

              <DataTable
                rows={data.investments}
                columns={columns}
                getRowId={(row) => row.id}
                caption="Every investment inside this mandate, with the employer, amount and expected return"
                search={(row) => `${row.reference} ${row.investorName} ${row.portfolioName} ${row.status}`}
                searchPlaceholder="Search by reference, investor or mandate"
                filters={[
                  {
                    key: "portfolio",
                    label: "Mandate",
                    options: Array.from(new Set(data.investments.map((row) => row.portfolioName))),
                    accessor: (row) => row.portfolioName,
                  },
                  {
                    key: "status",
                    label: "Status",
                    options: ["Pending funding", "Active", "Maturing", "Matured", "Withdrawn"],
                    accessor: (row) => row.status,
                  },
                ]}
                dateAccessor={(row) => row.startDate}
                emptyTitle="No investments recorded"
                emptyBody="Investments appear here once an investor commits capital to a mandate."
                onRowClick={setSelected}
                initialSort={{ key: "amount", direction: "desc" }}
                exportName="paybridge-investments"
                exportRow={(row) => ({
                  Reference: row.reference,
                  Investor: row.investorName,
                  Mandate: row.portfolioName,
                  Amount: row.amount,
                  Income: row.incomeEarned,
                  Fees: row.feesCharged,
                  Start: shortDate(row.startDate),
                  Maturity: shortDate(row.maturityDate),
                  Status: row.status,
                })}
              />

              <InfoNote>
                Capital is deployed through approved mandates. No investor is ever matched to an individual
                employee, and returns are not guaranteed.
              </InfoNote>
            </div>
          );
        }}
      </AsyncPanel>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.reference ?? "Investment"}
        description={selected ? `${selected.investorName} · ${selected.portfolioName}` : undefined}
      >
        {selected ? (
          <div className="divide-y divide-border/70">
            <SummaryRow label="Amount" value={naira(selected.amount)} emphasis tone="primary" />
            <SummaryRow label="Income earned" value={naira(selected.incomeEarned)} />
            <SummaryRow label="Fees charged" value={naira(selected.feesCharged)} />
            <SummaryRow label="Distributions" value={selected.distributionFrequency} />
            <SummaryRow label="Start date" value={shortDate(selected.startDate)} />
            <SummaryRow label="Maturity date" value={shortDate(selected.maturityDate)} />
            <SummaryRow label="Status" value={<StatusBadge status={selected.status} />} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
