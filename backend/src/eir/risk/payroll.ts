/**
 * PAYROLL RELIABILITY MODULE — deterministic, no AI.
 *
 * For a rail whose repayment source is the payroll run, this is the closest
 * thing to a direct observation of the risk. A balance sheet describes capacity;
 * a two-year record of paying on the 25th describes behaviour. When the two
 * disagree, behaviour has been the better predictor, which is why this component
 * carries the same weight as financial health in the default policy.
 *
 * WHAT "ON TIME" MEANS. The normal pay date is DERIVED from the employer's own
 * history rather than taken from what they typed on the form. An employer whose
 * stated pay date is the 25th but who has paid on the 2nd of the following month
 * for eighteen consecutive months is not chronically late — their real pay date
 * is the 2nd, and scoring them as late every month would be a measurement error
 * dressed up as a finding. What the score punishes is DEVIATION from an
 * established pattern, plus the absolute distance from the stated date, which is
 * what an employee actually experiences.
 */

import { type Classification, type CreditPolicy, benchmarkFor, classify, formatMetric } from "./policy";

/* ------------------------------------------------------------------- INPUTS */

/** One payroll cycle. Mirrors the PayrollCycle row. */
export interface CycleInput {
  periodStart: Date;
  expectedPayDate: Date;
  actualPayDate: Date | null;
  totalAmount: number | null;
  employeeCount: number | null;
  corrections: number;
  reversals: number;
  paidFraction: number | null;
  pensionRemittedAt: Date | null;
  taxRemittedAt: Date | null;
  bankEvidenceMismatch: boolean;
}

export interface PayrollInput {
  cycles: CycleInput[];
  /** Declared pay date as a day-of-month string, where given. */
  declaredPayDay: number | null;
  industry: string | null;
}

/* ------------------------------------------------------------------ OUTPUTS */

export const TIMELINESS_VALUES = [
  "early",
  "on_time",
  "slightly_delayed",
  "materially_delayed",
  "missed",
  "partially_paid",
  "unknown",
] as const;
export type Timeliness = (typeof TIMELINESS_VALUES)[number];

export const TIMELINESS_LABELS: Record<Timeliness, string> = {
  early: "Early",
  on_time: "On time",
  slightly_delayed: "Slightly delayed",
  materially_delayed: "Materially delayed",
  missed: "Missed",
  partially_paid: "Partially paid",
  unknown: "Not evidenced",
};

export const PAYROLL_CLASSIFICATIONS = [
  "highly_stable",
  "stable",
  "moderately_variable",
  "stressed",
  "materially_distressed",
] as const;
export type PayrollClassification = (typeof PAYROLL_CLASSIFICATIONS)[number];

export const PAYROLL_CLASSIFICATION_LABELS: Record<PayrollClassification, string> = {
  highly_stable: "Highly stable",
  stable: "Stable",
  moderately_variable: "Moderately variable",
  stressed: "Stressed",
  materially_distressed: "Materially distressed",
};

/** One cycle, assessed. Drives the payroll timeline on the employer profile. */
export interface CycleAssessment {
  periodStart: string;
  periodLabel: string;
  expectedPayDate: string;
  actualPayDate: string | null;
  timeliness: Timeliness;
  delayDays: number | null;
  totalAmount: number | null;
  employeeCount: number | null;
  paidFraction: number | null;
  /** One-line reason, shown on hover in the timeline. */
  note: string;
}

export interface PayrollMetric {
  metric: string;
  label: string;
  value: number | null;
  displayValue: string;
  formula: string;
  benchmark: string | null;
  classification: Classification;
  score: number | null;
  scored: boolean;
}

export interface PayrollResult {
  score: number;
  classification: Classification;
  payrollClassification: PayrollClassification;
  /** The pay date derived from behaviour, as a day of the month. */
  normalPayDay: number | null;
  monthsAvailable: number;
  dataInsufficient: boolean;
  metrics: PayrollMetric[];
  cycles: CycleAssessment[];
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
  explanation: string;
  /** Counts the knockout rules and monitoring need. */
  missedCycles: number;
  partialCycles: number;
  maxDelayDays: number;
  mismatchedCycles: number;
}

/* ------------------------------------------------------------------ HELPERS */

const MS_PER_DAY = 86_400_000;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function label(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 3) return null;
  const avg = mean(values);
  if (avg === null || Math.abs(avg) < Number.EPSILON) return null;
  const variance = values.reduce((sum, n) => sum + (n - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(avg);
}

/**
 * The employer's real pay day, as the MEDIAN day-of-month of actual payments.
 *
 * Median rather than mean because one catastrophic month — a salary paid on the
 * 20th of the following month — would drag a mean far enough to make every
 * other month look early, inverting the whole analysis. The median is unmoved by
 * the outlier, which is exactly the property wanted: the outlier should be
 * visible AS an outlier, not absorbed into the baseline.
 */
export function deriveNormalPayDay(cycles: CycleInput[]): number | null {
  const days = cycles
    .filter((c) => c.actualPayDate !== null)
    .map((c) => {
      const paid = c.actualPayDate as Date;
      /*
       * A payment landing in the month AFTER the cycle is expressed as a day
       * beyond the month end (e.g. the 2nd of next month becomes day 33) so the
       * median sorts correctly. Treating it as day 2 would make a late payment
       * look like the earliest of the series.
       */
      const sameMonth =
        paid.getUTCFullYear() === c.expectedPayDate.getUTCFullYear() &&
        paid.getUTCMonth() === c.expectedPayDate.getUTCMonth();
      if (sameMonth) return paid.getUTCDate();
      const monthEnd = new Date(
        Date.UTC(c.expectedPayDate.getUTCFullYear(), c.expectedPayDate.getUTCMonth() + 1, 0),
      ).getUTCDate();
      return monthEnd + paid.getUTCDate();
    })
    .sort((a, b) => a - b);

  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  const upper = days[mid] as number;
  const lower = days[mid - 1] ?? upper;
  const median = days.length % 2 === 1 ? upper : Math.round((lower + upper) / 2);
  /* Fold a beyond-month-end median back into a real day of the month. */
  return median > 31 ? median - 31 : median;
}

/**
 * Classify one cycle.
 *
 * Thresholds: within a day either side of expected is on time (a weekend or a
 * bank cut-off routinely moves a payment by one day and no employee calls that
 * late); two to five days is slight; beyond five days is material, because that
 * is where an employee's own obligations start failing; nothing paid at all is
 * missed.
 */
export function classifyCycle(cycle: CycleInput): { timeliness: Timeliness; delayDays: number | null; note: string } {
  if (cycle.actualPayDate === null) {
    /*
     * No payment recorded. A cycle whose pay date has not yet arrived is not a
     * missed cycle — it has not happened. Only a cycle whose expected date is in
     * the past counts against the employer.
     */
    const overdue = daysBetween(cycle.expectedPayDate, new Date());
    if (overdue <= 0) {
      return { timeliness: "unknown", delayDays: null, note: "Cycle not yet due." };
    }
    if (overdue <= 3) {
      return {
        timeliness: "unknown",
        delayDays: overdue,
        note: `Payment not yet evidenced, ${overdue} day${overdue === 1 ? "" : "s"} after the expected date. Awaiting payroll or bank confirmation.`,
      };
    }
    return {
      timeliness: "missed",
      delayDays: overdue,
      note: `No payment evidenced ${overdue} days after the expected date.`,
    };
  }

  const delay = daysBetween(cycle.expectedPayDate, cycle.actualPayDate);
  const partial = cycle.paidFraction !== null && cycle.paidFraction < 0.98;

  if (partial) {
    return {
      timeliness: "partially_paid",
      delayDays: delay,
      note: `Only ${Math.round((cycle.paidFraction as number) * 100)}% of the payroll value was paid${delay > 1 ? `, ${delay} days late` : ""}.`,
    };
  }

  if (delay < -1) {
    return { timeliness: "early", delayDays: delay, note: `Paid ${Math.abs(delay)} days early.` };
  }
  if (delay <= 1) {
    return { timeliness: "on_time", delayDays: delay, note: "Paid on the expected date." };
  }
  if (delay <= 5) {
    return { timeliness: "slightly_delayed", delayDays: delay, note: `Paid ${delay} days late.` };
  }
  return { timeliness: "materially_delayed", delayDays: delay, note: `Paid ${delay} days late.` };
}

/* --------------------------------------------------------------- THE ENGINE */

export function assessPayrollReliability(input: PayrollInput, policy: CreditPolicy): PayrollResult {
  const cycles = [...input.cycles].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());
  const bench = (metric: string) => benchmarkFor(policy, metric, input.industry);

  const normalPayDay = deriveNormalPayDay(cycles);

  const assessed: CycleAssessment[] = cycles.map((cycle) => {
    const { timeliness, delayDays, note } = classifyCycle(cycle);
    return {
      periodStart: cycle.periodStart.toISOString(),
      periodLabel: label(cycle.periodStart),
      expectedPayDate: cycle.expectedPayDate.toISOString(),
      actualPayDate: cycle.actualPayDate?.toISOString() ?? null,
      timeliness,
      delayDays,
      totalAmount: cycle.totalAmount,
      employeeCount: cycle.employeeCount,
      paidFraction: cycle.paidFraction,
      note,
    };
  });

  /* Only cycles that have actually come due can be judged. */
  const due = assessed.filter((c) => c.timeliness !== "unknown");
  const monthsAvailable = due.length;

  const onTimeCount = due.filter((c) => c.timeliness === "on_time" || c.timeliness === "early").length;
  const missedCycles = due.filter((c) => c.timeliness === "missed").length;
  const partialCycles = due.filter((c) => c.timeliness === "partially_paid").length;
  const delays = due.map((c) => c.delayDays).filter((d): d is number => d !== null && d > 0);
  const maxDelayDays = delays.length > 0 ? Math.max(...delays) : 0;
  const mismatchedCycles = cycles.filter((c) => c.bankEvidenceMismatch).length;

  const onTimeRate = monthsAvailable > 0 ? onTimeCount / monthsAvailable : null;
  const averageDelay = mean(delays) ?? (monthsAvailable > 0 ? 0 : null);

  const valueVolatility = coefficientOfVariation(
    cycles.map((c) => c.totalAmount).filter((v): v is number => v !== null && v > 0),
  );
  const headcountVolatility = coefficientOfVariation(
    cycles.map((c) => c.employeeCount).filter((v): v is number => v !== null && v > 0),
  );

  const totalCorrections = cycles.reduce((sum, c) => sum + (c.corrections ?? 0), 0);
  const totalReversals = cycles.reduce((sum, c) => sum + (c.reversals ?? 0), 0);

  /* Salary growth: first third against last third of the payroll value series. */
  const amounts = cycles.map((c) => c.totalAmount).filter((v): v is number => v !== null && v > 0);
  let salaryGrowth: number | null = null;
  if (amounts.length >= 6) {
    const third = Math.floor(amounts.length / 3);
    const earliest = mean(amounts.slice(0, third));
    const latest = mean(amounts.slice(-third));
    if (earliest !== null && latest !== null && earliest > 0) salaryGrowth = (latest - earliest) / earliest;
  }

  const pensionOnTime = cycles.filter(
    (c) => c.pensionRemittedAt !== null && daysBetween(c.expectedPayDate, c.pensionRemittedAt) <= 21,
  ).length;
  const taxOnTime = cycles.filter(
    (c) => c.taxRemittedAt !== null && daysBetween(c.expectedPayDate, c.taxRemittedAt) <= 21,
  ).length;

  /* --------------------------------------------------------- Metric rows --- */

  const metrics: PayrollMetric[] = [];

  const push = (
    metric: string,
    metricLabel: string,
    value: number | null,
    formula: string,
    options: { scored?: boolean; unit?: "percent" | "days" | "count" | "ratio" | "currency" } = {},
  ) => {
    const benchmark = bench(metric);
    const scored = options.scored ?? true;
    const { classification, score } = scored
      ? classify(value, benchmark)
      : { classification: (value === null ? "insufficient_data" : "acceptable") as Classification, score: null };
    metrics.push({
      metric,
      label: metricLabel,
      value,
      displayValue: formatMetric(value, benchmark?.unit ?? options.unit ?? "count"),
      formula,
      benchmark: benchmark
        ? `Acceptable: ${benchmark.direction === "higher_is_better" ? "at least" : "no more than"} ${formatMetric(benchmark.acceptable, benchmark.unit)}`
        : null,
      classification,
      score: scored ? score : null,
      scored,
    });
  };

  push(
    "on_time_payroll_rate",
    "Salaries paid on time",
    onTimeRate,
    "Cycles paid on or before the expected date (±1 day tolerance) ÷ cycles that have fallen due.",
    { unit: "percent" },
  );
  push("average_delay_days", "Average delay", averageDelay, "Sum of delay days on late cycles ÷ number of late cycles.", {
    unit: "days",
  });
  push("max_delay_days", "Longest delay", maxDelayDays, "Maximum delay in days across all cycles.", { unit: "days" });
  push("missed_cycles", "Missed cycles", missedCycles, "Count of due cycles with no evidenced payment.", {
    unit: "count",
  });
  push(
    "payroll_value_volatility",
    "Payroll value volatility",
    valueVolatility,
    "Standard deviation of cycle payroll value ÷ mean cycle payroll value.",
  );
  push(
    "headcount_volatility",
    "Employee count volatility",
    headcountVolatility,
    "Standard deviation of employee count per cycle ÷ mean employee count.",
  );
  push(
    "partial_cycles",
    "Partially paid cycles",
    partialCycles,
    "Count of cycles where less than 98% of the payroll value was paid.",
    { scored: false, unit: "count" },
  );
  push(
    "payroll_corrections",
    "Corrections and reversals",
    totalCorrections + totalReversals,
    "Sum of recorded payroll corrections and payment reversals.",
    { scored: false, unit: "count" },
  );
  push("salary_growth", "Salary growth", salaryGrowth, "(Mean of the last third of cycles − mean of the first third) ÷ mean of the first third.", {
    scored: false,
    unit: "percent",
  });
  push(
    "pension_remittance_timeliness",
    "Pension remitted within 21 days",
    monthsAvailable > 0 ? pensionOnTime / monthsAvailable : null,
    "Cycles with pension remitted within 21 days of the pay date ÷ cycles due.",
    { scored: false, unit: "percent" },
  );
  push(
    "tax_remittance_timeliness",
    "PAYE remitted within 21 days",
    monthsAvailable > 0 ? taxOnTime / monthsAvailable : null,
    "Cycles with PAYE remitted within 21 days of the pay date ÷ cycles due.",
    { scored: false, unit: "percent" },
  );

  /* ---------------------------------------------------- Component score --- */

  let score: number;
  let dataInsufficient = false;

  if (monthsAvailable === 0) {
    /* Same reasoning as the financial floor: absent evidence is a gap, not a
     * finding, but it must not be scoreable as strength. */
    score = 30;
    dataInsufficient = true;
  } else {
    /*
     * Timeliness dominates. On-time rate is weighted triple because it is the
     * single fact this product depends on, and missed cycles are weighted
     * heavily on top: an employer who paid on time eleven times and missed once
     * is a materially different risk from one who was two days late twelve
     * times, and a flat average would score them the same.
     */
    const EMPHASIS: Record<string, number> = {
      on_time_payroll_rate: 3,
      missed_cycles: 3,
      max_delay_days: 2,
      average_delay_days: 2,
      payroll_value_volatility: 1,
      headcount_volatility: 1,
    };
    const scored = metrics.filter((m) => m.scored && m.score !== null);
    const weightSum = scored.reduce((sum, m) => sum + (EMPHASIS[m.metric] ?? 1), 0);
    const weighted = scored.reduce((sum, m) => sum + (m.score as number) * (EMPHASIS[m.metric] ?? 1), 0);
    score = weightSum > 0 ? Math.round(weighted / weightSum) : 30;

    /* A partial payment is a distinct failure mode from lateness — staff were
     * paid some of their salary — so it carries its own deduction. */
    score -= partialCycles * 6;
    /* Payroll claimed but not visible in the bank is the most serious data
     * integrity problem this module can find. It also trips a knockout rule;
     * the deduction here stops the score presenting as clean in the meantime. */
    score -= mismatchedCycles * 10;

    const minMonths = policy.portfolioCaps.minPayrollMonths;
    if (monthsAvailable < minMonths) {
      const completeness = monthsAvailable / Math.max(1, minMonths);
      score = Math.round(30 + (score - 30) * completeness);
      dataInsufficient = true;
    }
  }

  score = Math.max(0, Math.min(100, score));

  const classification: Classification = dataInsufficient
    ? "insufficient_data"
    : score >= 85
      ? "strong"
      : score >= 70
        ? "acceptable"
        : score >= 55
          ? "watch"
          : score >= 40
            ? "weak"
            : "critical";

  /*
   * The five-way behavioural classification the specification asks for. Driven
   * by observed failures rather than by the score, so it stays legible: an
   * employer with two missed cycles is materially distressed regardless of how
   * the arithmetic of the other metrics landed.
   */
  const payrollClassification: PayrollClassification =
    missedCycles >= 2
      ? "materially_distressed"
      : missedCycles === 1 || partialCycles >= 2 || maxDelayDays > 14
        ? "stressed"
        : (onTimeRate ?? 0) < 0.8 || maxDelayDays > 7 || partialCycles === 1
          ? "moderately_variable"
          : (onTimeRate ?? 0) < 0.97 || maxDelayDays > 2
            ? "stable"
            : "highly_stable";

  /* ------------------------------------------------------------ Factors --- */

  const factors: PayrollResult["factors"] = [];

  if (monthsAvailable === 0) {
    factors.push({
      factor: "No payroll history",
      effect: "negative",
      detail: "No payroll cycles have been evidenced. This component is at its data-gap floor.",
    });
  } else {
    factors.push({
      factor: "Observed payroll history",
      effect: "neutral",
      detail: `${monthsAvailable} cycle${monthsAvailable === 1 ? "" : "s"} assessed${normalPayDay ? `, with a derived normal pay date of day ${normalPayDay} of the month` : ""}.`,
    });
  }

  if (onTimeRate !== null && onTimeRate >= 0.98 && monthsAvailable >= 6) {
    factors.push({
      factor: "Consistently on-time payroll",
      effect: "positive",
      detail: `${onTimeCount} of ${monthsAvailable} cycles paid on or before the expected date.`,
    });
  }
  if (missedCycles > 0) {
    factors.push({
      factor: "Missed payroll cycles",
      effect: "negative",
      detail: `${missedCycles} cycle${missedCycles === 1 ? "" : "s"} with no evidenced payment. This is the strongest negative signal available to the assessment.`,
    });
  }
  if (partialCycles > 0) {
    factors.push({
      factor: "Partial payroll payments",
      effect: "negative",
      detail: `${partialCycles} cycle${partialCycles === 1 ? "" : "s"} where staff were paid less than the full payroll value.`,
    });
  }
  if (maxDelayDays > 5) {
    factors.push({
      factor: "Material payroll delay",
      effect: "negative",
      detail: `Longest observed delay was ${maxDelayDays} days beyond the expected pay date.`,
    });
  }
  if (mismatchedCycles > 0) {
    factors.push({
      factor: "Payroll not corroborated by bank evidence",
      effect: "negative",
      detail: `${mismatchedCycles} cycle${mismatchedCycles === 1 ? "" : "s"} claim payments the bank statement does not show. Requires reconciliation before any limit is set.`,
    });
  }
  if (
    input.declaredPayDay !== null &&
    normalPayDay !== null &&
    Math.abs(input.declaredPayDay - normalPayDay) > 3
  ) {
    factors.push({
      factor: "Stated pay date differs from actual",
      effect: "neutral",
      detail: `The employer states day ${input.declaredPayDay} but the observed pattern is day ${normalPayDay}. Scoring uses the observed pattern; the settlement date should be set against it.`,
    });
  }
  if (salaryGrowth !== null && salaryGrowth < -0.15) {
    factors.push({
      factor: "Falling payroll value",
      effect: "negative",
      detail: `Payroll value is ${Math.abs(Math.round(salaryGrowth * 100))}% below its earlier level, which may indicate staff reductions or unpaid components.`,
    });
  }

  const explanation =
    monthsAvailable === 0
      ? "No payroll cycles have been evidenced. Payroll reliability cannot be assessed until payroll files or bank-derived salary payments are loaded."
      : `${onTimeCount} of ${monthsAvailable} cycles paid on time${maxDelayDays > 0 ? `, longest delay ${maxDelayDays} days` : ""}${missedCycles > 0 ? `, ${missedCycles} missed` : ""}${partialCycles > 0 ? `, ${partialCycles} partially paid` : ""}. Behaviour classified as ${PAYROLL_CLASSIFICATION_LABELS[payrollClassification].toLowerCase()}.`;

  return {
    score,
    classification,
    payrollClassification,
    normalPayDay,
    monthsAvailable,
    dataInsufficient,
    metrics,
    cycles: assessed,
    factors,
    explanation,
    missedCycles,
    partialCycles,
    maxDelayDays,
    mismatchedCycles,
  };
}
