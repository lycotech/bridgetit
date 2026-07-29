/**
 * FINANCIAL HEALTH MODULE — deterministic arithmetic, no AI.
 *
 * The specification is explicit that ratios must not be calculated by a model,
 * and the reason is worth stating: a language model asked for a ratio will
 * produce a plausible number, silently, and there is no way to tell a wrong one
 * from a right one by looking at it. Every figure here comes from summing and
 * dividing rows, and every figure carries the formula that produced it so a
 * reviewer — or a regulator, years later — can check the arithmetic by hand.
 *
 * SHAPE OF THE OUTPUT: each metric returns its value, a formatted display
 * value, the formula in words, the policy benchmark in force, a risk
 * classification, a trend series and the data it came from. That is the
 * explainability requirement satisfied at the point of calculation rather than
 * reconstructed afterwards, which is the only version that stays true.
 *
 * SCORED VS INFORMATIONAL: some figures are context, not judgements. "Average
 * monthly inflow is ₦40m" is not good or bad on its own — it is the denominator
 * for figures that are. Those carry `scored: false` and are displayed without
 * affecting the component score, because averaging a context number into a risk
 * score is how a score stops meaning anything.
 */

import {
  type Benchmark,
  type Classification,
  type CreditPolicy,
  benchmarkFor,
  classify,
  formatMetric,
  formatNaira,
} from "./policy";
import { isLowSeason } from "./industry";

/* ------------------------------------------------------------------- INPUTS */

/** One month of normalised financials. Mirrors the FinancialPeriod row. */
export interface PeriodInput {
  periodStart: Date;
  source: string;
  inflows: number | null;
  outflows: number | null;
  openingBalance: number | null;
  closingBalance: number | null;
  lowestBalance: number | null;
  revenue: number | null;
  costOfSales: number | null;
  operatingExpenses: number | null;
  operatingProfit: number | null;
  payrollCost: number | null;
  debtService: number | null;
  taxRemitted: number | null;
  pensionRemitted: number | null;
  returnedPayments: number;
}

export interface FinancialInput {
  periods: PeriodInput[];
  /** Verified monthly payroll from payroll cycles — preferred over declared. */
  verifiedMonthlyPayroll: number | null;
  /** Employer's declared monthly payroll, used only as a fallback. */
  declaredMonthlyPayroll: number | null;
  /** Largest customer share of revenue, 0–1, where disclosed. */
  customerConcentration: number | null;
  /** Largest counterparty share of receivables, 0–1, where disclosed. */
  receivablesConcentration: number | null;
  /** Total outstanding balance with other lenders. */
  existingLenderExposure: number | null;
  /** Current liabilities falling due within twelve months, where known. */
  currentLiabilities: number | null;
  /** Current assets, where known. */
  currentAssets: number | null;
  industry: string | null;
  /** Count of payroll cycles in which pension was remitted on time. */
  pensionOnTimeCycles: number | null;
  /** Count of payroll cycles in which tax was remitted on time. */
  taxOnTimeCycles: number | null;
  /** Total cycles those two counts are out of. */
  remittanceCyclesObserved: number | null;
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface MetricResult {
  metric: string;
  label: string;
  value: number | null;
  displayValue: string;
  /** The arithmetic in words, exactly as applied. */
  formula: string;
  /** The policy threshold in force, rendered for display. */
  benchmark: string | null;
  classification: Classification;
  /** 0–100. Null for informational metrics and for genuine data gaps. */
  score: number | null;
  /** False where the metric is context rather than a judgement. */
  scored: boolean;
  /** What rows fed it. */
  dataSource: string;
  /** Chronological series for the trend chart. */
  trend: { period: string; value: number }[];
}

export interface FinancialResult {
  score: number;
  classification: Classification;
  metrics: MetricResult[];
  monthsAvailable: number;
  dataInsufficient: boolean;
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
  explanation: string;
}

/* ------------------------------------------------------------------ HELPERS */

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function periodLabel(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Present values only. Nulls are absent data, not zeros. */
function defined(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/**
 * Coefficient of variation — standard deviation over the mean.
 *
 * WHY this rather than raw standard deviation: a ₦2m swing is noise for an
 * employer turning over ₦400m a month and an existential event for one turning
 * over ₦8m. Dividing by the mean makes the figure comparable across the
 * portfolio, which is the only way one benchmark can serve every employer.
 */
function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 3) return null;
  const avg = mean(values);
  if (avg === null || Math.abs(avg) < Number.EPSILON) return null;
  const variance = values.reduce((sum, n) => sum + (n - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(avg);
}

/**
 * Trend as a fractional change from the first half of the window to the second.
 *
 * A two-half comparison rather than a regression slope, deliberately: it is
 * explainable in one sentence to a credit committee ("the last six months
 * averaged 12% below the six before"), and a slope in currency units per month
 * is not.
 */
function halfOverHalfTrend(series: { value: number }[]): number | null {
  if (series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const first = mean(series.slice(0, mid).map((p) => p.value));
  const second = mean(series.slice(mid).map((p) => p.value));
  if (first === null || second === null || Math.abs(first) < Number.EPSILON) return null;
  return (second - first) / Math.abs(first);
}

/** Render a benchmark as the sentence shown next to the value. */
function describeBenchmark(benchmark: Benchmark | undefined): string | null {
  if (!benchmark) return null;
  const dir = benchmark.direction === "higher_is_better" ? "at least" : "no more than";
  return `Acceptable: ${dir} ${formatMetric(benchmark.acceptable, benchmark.unit)} · Strong: ${dir} ${formatMetric(benchmark.strong, benchmark.unit)}`;
}

/* --------------------------------------------------------------- THE ENGINE */

/**
 * Compute every financial metric and the weighted component score.
 *
 * The component score is the mean of the SCORED metrics' scores, weighted so
 * the four figures that actually decide whether a payroll advance can be repaid
 * — salary coverage, cash reserve, payroll-to-inflow and cash-flow volatility —
 * carry more than the contextual ratios. A flat average would let a strong
 * customer-diversification figure offset an inability to cover next month's
 * salaries, which is precisely backwards for this product.
 */
export function assessFinancialHealth(input: FinancialInput, policy: CreditPolicy): FinancialResult {
  const periods = [...input.periods].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  const monthsAvailable = periods.length;
  const bench = (metric: string) => benchmarkFor(policy, metric, input.industry);

  const monthlyPayroll =
    input.verifiedMonthlyPayroll ??
    input.declaredMonthlyPayroll ??
    (mean(defined(periods.map((p) => p.payrollCost))) || null);

  /*
   * Seasonal months are excluded from the VOLATILITY and TREND windows only —
   * never from averages or minimums. An employer must still be able to pay
   * salaries in August; the seasonal adjustment says only that a quiet August
   * is not evidence of deterioration. Dropping the month from the averages too
   * would flatter the employer by hiding the trough the facility has to survive.
   */
  const nonSeasonal = periods.filter((p) => !isLowSeason(input.industry, p.periodStart.getUTCMonth() + 1));
  const trendWindow = nonSeasonal.length >= 4 ? nonSeasonal : periods;
  const seasonallyAdjusted = trendWindow.length !== periods.length;

  const metrics: MetricResult[] = [];

  const push = (
    metric: string,
    label: string,
    value: number | null,
    formula: string,
    dataSource: string,
    options: {
      scored?: boolean;
      unit?: Benchmark["unit"];
      trend?: { period: string; value: number }[];
    } = {},
  ) => {
    const benchmark = bench(metric);
    const scored = options.scored ?? true;
    const { classification, score } = scored
      ? classify(value, benchmark)
      : {
          classification: (value === null ? "insufficient_data" : "acceptable") as Classification,
          score: null,
        };
    const unit = benchmark?.unit ?? options.unit ?? "currency";
    metrics.push({
      metric,
      label,
      value,
      displayValue: formatMetric(value, unit),
      formula,
      benchmark: describeBenchmark(benchmark),
      classification,
      score: scored ? score : null,
      scored,
      dataSource,
      trend: options.trend ?? [],
    });
  };

  const first = periods.at(0);
  const last = periods.at(-1);
  const src =
    first && last
      ? `${monthsAvailable} monthly period${monthsAvailable === 1 ? "" : "s"}, ${periodLabel(first.periodStart)} to ${periodLabel(last.periodStart)}`
      : "No financial periods loaded";

  /* ---------------------------------------------- Context (not scored) ---- */

  const inflowSeries = periods
    .filter((p) => p.inflows !== null)
    .map((p) => ({ period: periodLabel(p.periodStart), value: p.inflows as number }));
  const avgInflows = mean(inflowSeries.map((p) => p.value));
  push(
    "average_monthly_inflows",
    "Average monthly inflows",
    avgInflows,
    "Sum of credit turnover across the observed months ÷ number of months.",
    src,
    { scored: false, unit: "currency", trend: inflowSeries },
  );

  const outflowSeries = periods
    .filter((p) => p.outflows !== null)
    .map((p) => ({ period: periodLabel(p.periodStart), value: p.outflows as number }));
  const avgOutflows = mean(outflowSeries.map((p) => p.value));
  push(
    "average_monthly_outflows",
    "Average monthly outflows",
    avgOutflows,
    "Sum of debit turnover across the observed months ÷ number of months.",
    src,
    { scored: false, unit: "currency", trend: outflowSeries },
  );

  const closingSeries = periods
    .filter((p) => p.closingBalance !== null)
    .map((p) => ({ period: periodLabel(p.periodStart), value: p.closingBalance as number }));
  const avgClosing = mean(closingSeries.map((p) => p.value));
  push(
    "average_closing_balance",
    "Average closing balance",
    avgClosing,
    "Sum of month-end balances ÷ number of months.",
    src,
    { scored: false, unit: "currency", trend: closingSeries },
  );

  const lowestBalances = defined(periods.map((p) => p.lowestBalance ?? p.closingBalance));
  const lowestBalance = lowestBalances.length > 0 ? Math.min(...lowestBalances) : null;
  push(
    "lowest_closing_balance",
    "Lowest balance observed",
    lowestBalance,
    "Minimum of the lowest daily balance in each month, or the month-end balance where daily data is unavailable.",
    src,
    { scored: false, unit: "currency" },
  );

  /* ------------------------------------------------------ Scored ratios --- */

  /*
   * Salary coverage: how many times over could the average month's inflow pay
   * the payroll? The single most important figure in this module, because it is
   * the direct answer to "can this employer fund the salaries we are advancing
   * against?".
   */
  const salaryCoverage =
    avgInflows !== null && monthlyPayroll !== null && monthlyPayroll > 0 ? avgInflows / monthlyPayroll : null;
  push(
    "salary_coverage",
    "Salary coverage ratio",
    salaryCoverage,
    "Average monthly inflows ÷ verified monthly payroll.",
    `${src}; payroll from ${input.verifiedMonthlyPayroll !== null ? "verified payroll cycles" : "employer declaration"}`,
    {
      trend: inflowSeries.map((p) => ({
        period: p.period,
        value: monthlyPayroll && monthlyPayroll > 0 ? p.value / monthlyPayroll : 0,
      })),
    },
  );

  const cashReserveMonths =
    avgClosing !== null && monthlyPayroll !== null && monthlyPayroll > 0 ? avgClosing / monthlyPayroll : null;
  push(
    "cash_reserve_months",
    "Cash reserve in months of payroll",
    cashReserveMonths,
    "Average closing balance ÷ verified monthly payroll.",
    src,
  );

  const lowestToPayroll =
    lowestBalance !== null && monthlyPayroll !== null && monthlyPayroll > 0
      ? lowestBalance / monthlyPayroll
      : null;
  push(
    "lowest_balance_to_payroll",
    "Lowest balance as a share of payroll",
    lowestToPayroll,
    "Lowest balance observed ÷ verified monthly payroll.",
    /* The trough matters more than the average for a payroll product: the
     * question is not whether the employer is usually liquid but whether there
     * was a moment they could not have made payroll. */
    `${src}. Measures the worst moment in the window, not the typical one.`,
  );

  const revenueSeries = trendWindow
    .filter((p) => p.revenue !== null)
    .map((p) => ({ period: periodLabel(p.periodStart), value: p.revenue as number }));
  const avgRevenue = mean(revenueSeries.map((p) => p.value));

  const payrollToRevenue =
    avgRevenue !== null && avgRevenue > 0 && monthlyPayroll !== null ? monthlyPayroll / avgRevenue : null;
  push(
    "payroll_to_revenue",
    "Payroll to revenue",
    payrollToRevenue,
    "Verified monthly payroll ÷ average monthly revenue.",
    src,
  );

  const payrollToInflow =
    avgInflows !== null && avgInflows > 0 && monthlyPayroll !== null ? monthlyPayroll / avgInflows : null;
  push(
    "payroll_to_inflow",
    "Payroll to cash inflow",
    payrollToInflow,
    "Verified monthly payroll ÷ average monthly cash inflows.",
    `${src}. Uses banked cash rather than booked revenue, so unpaid invoices do not flatter the ratio.`,
  );

  const cashVolatility = coefficientOfVariation(trendWindow.map((p) => p.inflows).filter((v): v is number => v !== null));
  push(
    "cash_flow_volatility",
    "Cash-flow volatility",
    cashVolatility,
    "Standard deviation of monthly inflows ÷ mean monthly inflows (coefficient of variation).",
    seasonallyAdjusted
      ? `${src}. Structurally quiet months for this sector are excluded from the volatility window.`
      : src,
  );

  const revenueTrend = halfOverHalfTrend(revenueSeries);
  push(
    "revenue_trend",
    "Revenue trend",
    revenueTrend,
    "(Mean revenue of the later half − mean revenue of the earlier half) ÷ mean revenue of the earlier half.",
    seasonallyAdjusted ? `${src}. Seasonal months excluded from the comparison.` : src,
    { trend: revenueSeries },
  );

  const marginSeries = trendWindow
    .filter((p) => p.revenue !== null && p.revenue > 0 && p.operatingProfit !== null)
    .map((p) => ({
      period: periodLabel(p.periodStart),
      value: (p.operatingProfit as number) / (p.revenue as number),
    }));
  const operatingMargin = mean(marginSeries.map((p) => p.value));
  push(
    "operating_margin",
    "Operating margin",
    operatingMargin,
    "Mean of (operating profit ÷ revenue) across the observed months.",
    src,
    { trend: marginSeries },
  );

  const avgDebtService = mean(defined(periods.map((p) => p.debtService)));
  const debtServiceBurden =
    avgDebtService !== null && avgInflows !== null && avgInflows > 0 ? avgDebtService / avgInflows : null;
  push(
    "debt_service_burden",
    "Debt-service burden",
    debtServiceBurden,
    "Average monthly debt service ÷ average monthly inflows.",
    `${src}; debt service identified from classified statement lines`,
  );

  const liquidityCoverage =
    input.currentAssets !== null && input.currentLiabilities !== null && input.currentLiabilities > 0
      ? input.currentAssets / input.currentLiabilities
      : null;
  push(
    "liquidity_coverage",
    "Liquidity coverage",
    liquidityCoverage,
    "Current assets ÷ current liabilities.",
    input.currentAssets === null ? "Not available — requires management or audited accounts" : "Management or audited accounts",
  );

  const lenderExposure =
    input.existingLenderExposure !== null && monthlyPayroll !== null && monthlyPayroll > 0
      ? input.existingLenderExposure / monthlyPayroll
      : null;
  push(
    "lender_exposure",
    "Existing lender exposure",
    lenderExposure,
    "Total outstanding balance with other lenders ÷ verified monthly payroll.",
    "Declared obligations and credit bureau data",
  );

  push(
    "customer_concentration",
    "Customer concentration",
    input.customerConcentration,
    "Revenue from the largest single customer ÷ total revenue.",
    input.customerConcentration === null ? "Not disclosed" : "Employer disclosure and contract review",
  );

  push(
    "receivables_concentration",
    "Receivables concentration",
    input.receivablesConcentration,
    "Receivables owed by the largest single counterparty ÷ total receivables.",
    input.receivablesConcentration === null ? "Not disclosed" : "Debtor ageing schedule",
  );

  const totalReturned = periods.reduce((sum, p) => sum + (p.returnedPayments ?? 0), 0);
  const returnedRate = monthsAvailable > 0 ? totalReturned / Math.max(1, monthsAvailable * 30) : null;
  push(
    "returned_payment_rate",
    "Returned payments",
    returnedRate,
    "Count of returned or reversed payments ÷ approximate transaction days observed.",
    `${totalReturned} returned payment${totalReturned === 1 ? "" : "s"} across ${monthsAvailable} month${monthsAvailable === 1 ? "" : "s"}`,
  );

  const remittanceObserved = input.remittanceCyclesObserved ?? 0;
  const remittanceConsistency =
    remittanceObserved > 0
      ? ((input.pensionOnTimeCycles ?? 0) + (input.taxOnTimeCycles ?? 0)) / (remittanceObserved * 2)
      : null;
  push(
    "remittance_consistency",
    "Tax and pension remittance consistency",
    remittanceConsistency,
    "(Cycles with pension remitted on time + cycles with tax remitted on time) ÷ (cycles observed × 2).",
    /* Remittance discipline is the cheapest available proxy for how an employer
     * behaves when cash is tight: pension is the first thing to slip and the
     * last thing anyone volunteers. */
    remittanceObserved > 0
      ? `${remittanceObserved} payroll cycles with remittance evidence`
      : "No remittance evidence loaded",
    { unit: "percent" },
  );

  /* ---------------------------------------------------- Component score --- */

  /*
   * The four weighted-double metrics are the ones that answer "can the next
   * payroll be met, and is this month representative?". Everything else is
   * important context that should not be able to outvote them.
   */
  const EMPHASIS: Record<string, number> = {
    salary_coverage: 3,
    cash_reserve_months: 2,
    payroll_to_inflow: 2,
    cash_flow_volatility: 2,
    lowest_balance_to_payroll: 2,
  };

  const scored = metrics.filter((m) => m.scored && m.score !== null);
  let score: number;
  let dataInsufficient = false;

  if (scored.length === 0 || monthsAvailable === 0) {
    /*
     * No usable financial data. Scored at 30, not 0 and not 50.
     *
     * Zero would read as "we assessed this employer and their finances are
     * catastrophic", which is a false statement about a company that has simply
     * not uploaded a bank statement yet. Fifty would let an employer reach an
     * approvable total score by submitting nothing at all — the incentive is
     * exactly wrong. Thirty is low enough that no tier is reachable on absent
     * data and honest enough that the reason shows as a data gap rather than a
     * finding, with the insufficient-history knockout rule carrying the actual
     * consequence.
     */
    score = 30;
    dataInsufficient = true;
  } else {
    const weightSum = scored.reduce((sum, m) => sum + (EMPHASIS[m.metric] ?? 1), 0);
    const weighted = scored.reduce((sum, m) => sum + (m.score as number) * (EMPHASIS[m.metric] ?? 1), 0);
    score = Math.round(weighted / weightSum);

    /*
     * Thin history is not the same as bad history, but it must not be scored as
     * if it were solid. Below the policy minimum the score is pulled toward the
     * data-gap floor in proportion to how much is missing — so three months of
     * excellent numbers cannot present as six months of excellent numbers.
     */
    const minMonths = policy.portfolioCaps.minFinancialMonths;
    if (monthsAvailable < minMonths) {
      const completeness = monthsAvailable / Math.max(1, minMonths);
      score = Math.round(30 + (score - 30) * completeness);
      dataInsufficient = true;
    }
  }

  score = Math.max(0, Math.min(100, score));

  const classification: Classification = dataInsufficient
    ? "insufficient_data"
    : score >= 82
      ? "strong"
      : score >= 68
        ? "acceptable"
        : score >= 55
          ? "watch"
          : score >= 40
            ? "weak"
            : "critical";

  /* ------------------------------------------------------------ Factors --- */

  const factors: FinancialResult["factors"] = [];

  if (dataInsufficient) {
    factors.push({
      factor: "Limited financial history",
      effect: "negative",
      detail:
        monthsAvailable === 0
          ? "No bank statement or accounts data has been loaded. The component is at its data-gap floor."
          : `${monthsAvailable} month${monthsAvailable === 1 ? "" : "s"} available against a policy minimum of ${policy.portfolioCaps.minFinancialMonths}. The score is discounted for incompleteness.`,
    });
  }

  for (const metric of scored) {
    if (metric.classification === "strong") {
      factors.push({
        factor: metric.label,
        effect: "positive",
        detail: `${metric.displayValue} — above the strong benchmark.`,
      });
    } else if (metric.classification === "critical" || metric.classification === "weak") {
      factors.push({
        factor: metric.label,
        effect: "negative",
        detail: `${metric.displayValue} — ${metric.classification === "critical" ? "materially outside" : "outside"} the acceptable benchmark.`,
      });
    }
  }

  if (lowestBalance !== null && lowestBalance < 0) {
    factors.push({
      factor: "Account went overdrawn",
      effect: "negative",
      detail: `The lowest balance observed was ${formatNaira(lowestBalance)}. The employer was unable to fund obligations from its own balance at that point.`,
    });
  }

  if (totalReturned > 0) {
    factors.push({
      factor: "Returned payments present",
      effect: "negative",
      detail: `${totalReturned} returned or reversed payment${totalReturned === 1 ? "" : "s"} in the observed window.`,
    });
  }

  const explanation = buildExplanation({
    score,
    classification,
    monthsAvailable,
    salaryCoverage,
    cashReserveMonths,
    payrollToInflow,
    cashVolatility,
    dataInsufficient,
  });

  return { score, classification, metrics, monthsAvailable, dataInsufficient, factors, explanation };
}

/**
 * A short, plain-language summary for the credit paper.
 *
 * Deliberately written from the deterministic numbers, not by a model: this
 * sentence appears in a decision memorandum, and it must be reproducible from
 * the data rather than regenerated differently each time it is read.
 */
function buildExplanation(input: {
  score: number;
  classification: Classification;
  monthsAvailable: number;
  salaryCoverage: number | null;
  cashReserveMonths: number | null;
  payrollToInflow: number | null;
  cashVolatility: number | null;
  dataInsufficient: boolean;
}): string {
  if (input.monthsAvailable === 0) {
    return "No financial data has been loaded. Financial health cannot be assessed until bank statements or accounts are provided.";
  }

  const parts: string[] = [];

  if (input.salaryCoverage !== null) {
    parts.push(
      `Average monthly inflows cover payroll ${input.salaryCoverage.toFixed(1)} times`,
    );
  }
  if (input.cashReserveMonths !== null) {
    parts.push(`month-end balances hold ${input.cashReserveMonths.toFixed(1)} months of payroll`);
  }
  if (input.payrollToInflow !== null) {
    parts.push(`payroll absorbs ${(input.payrollToInflow * 100).toFixed(0)}% of banked inflows`);
  }
  if (input.cashVolatility !== null) {
    parts.push(
      `inflow volatility is ${(input.cashVolatility * 100).toFixed(0)}% of the monthly mean`,
    );
  }

  const body = parts.length > 0 ? `${parts.join(", ")}.` : "Insufficient detail for ratio analysis.";
  const caveat = input.dataInsufficient
    ? ` Assessed on ${input.monthsAvailable} month${input.monthsAvailable === 1 ? "" : "s"} of data, which is below policy minimum, so the score is discounted for incompleteness.`
    : ` Assessed on ${input.monthsAvailable} months of data.`;

  return `${body}${caveat}`;
}
