/**
 * CONTINUOUS MONITORING AND EARLY WARNING — deterministic, no AI.
 *
 * The specification's core product principle is that an employer profile is
 * living, not a one-time score. This module is what makes that true: it runs a
 * fixed set of rules over the latest data on every cycle and produces alerts, an
 * overall green/amber/red state, and a recommended action for each.
 *
 * WHY THE RULES ARE DETERMINISTIC AND NOT AI. An early-warning system has to be
 * trusted enough that a red flag causes someone to pick up the phone. A rule that
 * says "payroll was 9 days late this cycle against a 12-month average of 0" is
 * actionable and arguable. A model output that says "elevated risk detected" is
 * neither. The AI analyst may add commentary on top of these alerts — that is
 * useful — but it cannot raise, clear or grade one.
 *
 * ALERTS DO NOT CHANGE LIMITS BY THEMSELVES. A red alert can suspend NEW drawdown
 * where the policy says so, because that is a protective action with an
 * immediately reversible effect. Reducing or withdrawing a limit is a credit
 * decision and goes through the decision service with a human approver, the same
 * as the original approval did.
 */

import { type CreditPolicy, formatNaira } from "./policy";
import { isLowSeason } from "./industry";

/* ------------------------------------------------------------------- LEVELS */

export const WARNING_LEVELS = ["green", "amber", "red"] as const;
export type WarningLevel = (typeof WARNING_LEVELS)[number];

export const WARNING_LABELS: Record<WarningLevel, string> = {
  green: "Performing",
  amber: "Watch",
  red: "Immediate attention",
};

export const ALERT_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/* ------------------------------------------------------------------- INPUTS */

export interface MonitoringInput {
  employerId: string;
  industry: string | null;

  /* Current standing. */
  currentTier: string | null;
  currentScore: number | null;
  previousScore: number | null;
  /** Days since the score was last recalculated. */
  scoreAgeDays: number | null;

  /* Latest payroll cycle. */
  latestCyclePaid: boolean | null;
  latestCycleDelayDays: number | null;
  latestCyclePartial: boolean;
  latestCycleAmount: number | null;
  /** Trailing average of the previous cycles, excluding the latest. */
  trailingAverageAmount: number | null;
  latestCycleEmployeeCount: number | null;
  trailingAverageEmployeeCount: number | null;
  /** Cycles with a bank/payroll mismatch in the monitoring window. */
  mismatchedCyclesInWindow: number;
  missedCyclesInWindow: number;
  /** Month of the latest cycle, 1–12, for seasonality. */
  latestCycleMonth: number | null;

  /* Bank behaviour. */
  latestClosingBalance: number | null;
  lowestBalanceInWindow: number | null;
  returnedPaymentsInWindow: number;
  /** New lender credits identified that were not declared. */
  newUndeclaredLenderCredits: number;

  /* Exposure and utilisation. */
  approvedExposure: number | null;
  currentUtilisation: number | null;
  /** Employees drawing this cycle, aggregate only. Never who. */
  participantCount: number | null;
  /** Total employees on the latest cycle, for a participation rate. */
  eligibleEmployeeCount: number | null;
  /** Settlements met late or missed on the facility itself. */
  facilityRepaymentsLate: number;
  facilityRepaymentsMissed: number;

  /* Compliance and documents. */
  documentsExpired: number;
  documentsExpiringWithin30Days: number;
  /** Screening age in days for the entity and related persons. */
  screeningAgeDays: number | null;
  consentExpired: boolean;
  licenceExpiringWithin60Days: boolean;

  /* Covenants. */
  covenantsBreached: number;
  covenantsBreachedUncured: number;

  /* External intelligence — validated only. */
  validatedAdverseFindingsSinceLastReview: number;
  unvalidatedFindingsPending: number;

  /* Review cadence. */
  daysSinceLastReview: number | null;
  /** Days until the scheduled review; negative where overdue. */
  daysUntilNextReview: number | null;
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface MonitoringAlert {
  key: string;
  category:
    | "payroll"
    | "liquidity"
    | "utilisation"
    | "compliance"
    | "documentation"
    | "covenant"
    | "external"
    | "governance";
  severity: AlertSeverity;
  title: string;
  /** The observation, with the numbers in it. */
  detail: string;
  /** What the reviewer should do, specifically. */
  recommendedAction: string;
  /** True where policy allows new drawdown to be paused pending review. */
  suggestsDrawdownPause: boolean;
  /** True where a full re-score should be triggered now rather than at cadence. */
  triggersRescore: boolean;
}

export interface MonitoringResult {
  employerId: string;
  level: WarningLevel;
  levelReason: string;
  alerts: MonitoringAlert[];
  /** Highest severity present. */
  peakSeverity: AlertSeverity | null;
  /** Aggregate participation, for the employer dashboard. Never per-employee. */
  participationRate: number | null;
  utilisationRate: number | null
  suggestDrawdownPause: boolean;
  triggerRescore: boolean;
  /** Next review date the cadence implies, as an ISO date string. */
  recommendedNextReviewDays: number;
  summary: string;
  assessedAt: string;
}

/* --------------------------------------------------------------- THE ENGINE */

export function runMonitoring(input: MonitoringInput, policy: CreditPolicy): MonitoringResult {
  const alerts: MonitoringAlert[] = [];

  const alert = (a: MonitoringAlert) => alerts.push(a);

  /* ------------------------------------------------------------ Payroll --- */

  if (input.latestCyclePaid === false) {
    alert({
      key: "payroll_missed",
      category: "payroll",
      severity: "critical",
      title: "Latest payroll cycle not paid",
      detail: "No payment has been evidenced for the most recent payroll cycle.",
      recommendedAction:
        "Contact the employer today. Suspend new drawdown, confirm the cause and whether a date is committed, and escalate to the Head of Risk.",
      suggestsDrawdownPause: true,
      triggersRescore: true,
    });
  } else if (input.latestCycleDelayDays !== null && input.latestCycleDelayDays > 5) {
    alert({
      key: "payroll_materially_delayed",
      category: "payroll",
      severity: input.latestCycleDelayDays > 14 ? "critical" : "high",
      title: "Payroll materially delayed",
      detail: `The latest cycle was paid ${input.latestCycleDelayDays} days after the expected date.`,
      recommendedAction:
        "Obtain the reason for the delay in writing and confirm the funding source for the next cycle before further drawdown.",
      suggestsDrawdownPause: input.latestCycleDelayDays > 14,
      triggersRescore: true,
    });
  } else if (input.latestCycleDelayDays !== null && input.latestCycleDelayDays > 1) {
    alert({
      key: "payroll_slightly_delayed",
      category: "payroll",
      severity: "low",
      title: "Payroll slightly delayed",
      detail: `The latest cycle was paid ${input.latestCycleDelayDays} days late.`,
      recommendedAction: "Note on the file. Escalate only if a second consecutive cycle is late.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  if (input.latestCyclePartial) {
    alert({
      key: "payroll_partial",
      category: "payroll",
      severity: "high",
      title: "Payroll only partly paid",
      detail: "The latest cycle shows a payroll value materially below the amount due.",
      recommendedAction:
        "Establish which employees were not paid in full and why. Partial payment is a liquidity event, not an administrative one.",
      suggestsDrawdownPause: true,
      triggersRescore: true,
    });
  }

  if (input.missedCyclesInWindow >= 2) {
    alert({
      key: "payroll_repeated_non_payment",
      category: "payroll",
      severity: "critical",
      title: "Repeated payroll non-payment",
      detail: `${input.missedCyclesInWindow} cycles in the monitoring window have no evidenced payment.`,
      recommendedAction:
        "This trips a knockout rule on any new application and requires an immediate exposure review by the Credit Committee.",
      suggestsDrawdownPause: true,
      triggersRescore: true,
    });
  }

  /*
   * Payroll value drops. The seasonality check matters here: a school's payroll
   * falling in August is expected and flagging it every year would train
   * reviewers to ignore the alert, which is worse than not having it.
   */
  if (
    input.latestCycleAmount !== null &&
    input.trailingAverageAmount !== null &&
    input.trailingAverageAmount > 0
  ) {
    const drop = (input.trailingAverageAmount - input.latestCycleAmount) / input.trailingAverageAmount;
    const seasonal = input.latestCycleMonth !== null && isLowSeason(input.industry, input.latestCycleMonth);
    if (drop >= 0.2) {
      alert({
        key: "payroll_value_drop",
        category: "payroll",
        severity: seasonal ? "low" : drop >= 0.35 ? "high" : "medium",
        title: seasonal ? "Payroll value down in a known low season" : "Payroll value down materially",
        detail: `Latest cycle of ${formatNaira(input.latestCycleAmount)} is ${Math.round(drop * 100)}% below the trailing average of ${formatNaira(input.trailingAverageAmount)}.${seasonal ? " This month is a known low season for this sector." : ""}`,
        recommendedAction: seasonal
          ? "Confirm the reduction matches the expected seasonal pattern and that the facility is sized for the trough."
          : "Establish whether this reflects staff reductions, unpaid components or a payroll split across accounts. A drop in payroll reduces the collateral behind an earned-wage programme.",
        suggestsDrawdownPause: false,
        triggersRescore: !seasonal,
      });
    }
  }

  if (
    input.latestCycleEmployeeCount !== null &&
    input.trailingAverageEmployeeCount !== null &&
    input.trailingAverageEmployeeCount > 0
  ) {
    const drop =
      (input.trailingAverageEmployeeCount - input.latestCycleEmployeeCount) /
      input.trailingAverageEmployeeCount;
    if (drop >= 0.15) {
      alert({
        key: "headcount_drop",
        category: "payroll",
        severity: drop >= 0.3 ? "high" : "medium",
        title: "Employee count down materially",
        detail: `Headcount fell from an average of ${Math.round(input.trailingAverageEmployeeCount)} to ${input.latestCycleEmployeeCount}, a reduction of ${Math.round(drop * 100)}%.`,
        recommendedAction:
          "Confirm whether this is restructuring, seasonal contract expiry or attrition. Resize the programme limit if the reduction is permanent.",
        suggestsDrawdownPause: false,
        triggersRescore: true,
      });
    }
  }

  if (input.mismatchedCyclesInWindow > 0) {
    alert({
      key: "payroll_bank_mismatch",
      category: "payroll",
      severity: "high",
      title: "Payroll not corroborated by bank evidence",
      detail: `${input.mismatchedCyclesInWindow} cycle${input.mismatchedCyclesInWindow === 1 ? "" : "s"} in the window claim payments the bank statements do not show.`,
      recommendedAction:
        "Reconcile before the next drawdown. Either a second payroll account exists and must be added, or the payroll file is inaccurate.",
      suggestsDrawdownPause: true,
      triggersRescore: true,
    });
  }

  /* ---------------------------------------------------------- Liquidity --- */

  if (
    input.lowestBalanceInWindow !== null &&
    input.trailingAverageAmount !== null &&
    input.trailingAverageAmount > 0
  ) {
    const ratio = input.lowestBalanceInWindow / input.trailingAverageAmount;
    if (ratio < 0.25) {
      alert({
        key: "balance_below_payroll",
        category: "liquidity",
        severity: ratio < 0.1 ? "high" : "medium",
        title: "Account balance falling well below payroll",
        detail: `The lowest balance in the window was ${formatNaira(input.lowestBalanceInWindow)}, only ${Math.round(ratio * 100)}% of one payroll cycle.`,
        recommendedAction:
          "Confirm how the next payroll will be funded. An employer running below a quarter of payroll has no buffer for a receipt delay.",
        suggestsDrawdownPause: false,
        triggersRescore: false,
      });
    }
  }

  if (input.returnedPaymentsInWindow > 0) {
    alert({
      key: "returned_payments",
      category: "liquidity",
      severity: input.returnedPaymentsInWindow >= 3 ? "high" : "medium",
      title: "Returned payments observed",
      detail: `${input.returnedPaymentsInWindow} payment instruction${input.returnedPaymentsInWindow === 1 ? "" : "s"} returned unpaid in the monitoring window.`,
      recommendedAction:
        "Returned instructions are the earliest reliable sign of a liquidity squeeze. Review the cash position before the next cycle.",
      suggestsDrawdownPause: false,
      triggersRescore: true,
    });
  }

  if (input.newUndeclaredLenderCredits > 0) {
    alert({
      key: "undeclared_borrowing",
      category: "liquidity",
      severity: "high",
      title: "Possible undeclared borrowing",
      detail: `${input.newUndeclaredLenderCredits} credit${input.newUndeclaredLenderCredits === 1 ? "" : "s"} from apparent lenders appear in the statements and are not on the declared list.`,
      recommendedAction:
        "Ask the employer to confirm and document any new facilities. Undisclosed borrowing is a candour issue and is referred to the Credit Committee if confirmed.",
      suggestsDrawdownPause: false,
      triggersRescore: true,
    });
  }

  /* -------------------------------------------------------- Utilisation --- */

  const utilisationRate =
    input.approvedExposure !== null && input.approvedExposure > 0 && input.currentUtilisation !== null
      ? input.currentUtilisation / input.approvedExposure
      : null;

  if (utilisationRate !== null && utilisationRate >= 0.9) {
    alert({
      key: "utilisation_high",
      category: "utilisation",
      severity: utilisationRate >= 1 ? "high" : "medium",
      title: utilisationRate >= 1 ? "Limit fully utilised" : "Limit close to fully utilised",
      detail: `Utilisation is at ${Math.round(utilisationRate * 100)}% of the approved ${formatNaira(input.approvedExposure)}.`,
      recommendedAction:
        "Sustained full utilisation usually signals either genuine demand or a limit being used as working capital. Review with the relationship manager before considering an increase.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  if (input.facilityRepaymentsMissed > 0) {
    alert({
      key: "facility_repayment_missed",
      category: "utilisation",
      severity: "critical",
      title: "Facility settlement missed",
      detail: `${input.facilityRepaymentsMissed} settlement${input.facilityRepaymentsMissed === 1 ? "" : "s"} on the PayBridge facility have not been met.`,
      recommendedAction: "Suspend drawdown immediately and begin the arrears process. Escalate to the Head of Risk today.",
      suggestsDrawdownPause: true,
      triggersRescore: true,
    });
  } else if (input.facilityRepaymentsLate > 0) {
    alert({
      key: "facility_repayment_late",
      category: "utilisation",
      severity: input.facilityRepaymentsLate >= 2 ? "high" : "medium",
      title: "Facility settlements late",
      detail: `${input.facilityRepaymentsLate} settlement${input.facilityRepaymentsLate === 1 ? " has" : "s have"} been met late.`,
      recommendedAction: "Confirm the withhold-and-remit instruction is operating correctly against the settlement account.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  /* --------------------------------------------------------- Compliance --- */

  if (input.consentExpired) {
    alert({
      key: "consent_expired",
      category: "compliance",
      severity: "critical",
      title: "Consent no longer current",
      detail: "The employer's consent to data processing, monitoring or credit checks has lapsed or been withdrawn.",
      recommendedAction:
        "Stop all automated data collection and screening for this employer immediately and obtain fresh consent. Processing without it is unlawful.",
      suggestsDrawdownPause: true,
      triggersRescore: false,
    });
  }

  if (input.screeningAgeDays !== null && input.screeningAgeDays > 90) {
    alert({
      key: "screening_stale",
      category: "compliance",
      severity: input.screeningAgeDays > 180 ? "high" : "medium",
      title: "Sanctions screening out of date",
      detail: `The last screening was ${input.screeningAgeDays} days ago. Screening is treated as valid for 90 days.`,
      recommendedAction: "Re-screen the entity, directors and beneficial owners.",
      suggestsDrawdownPause: false,
      triggersRescore: true,
    });
  }

  if (input.licenceExpiringWithin60Days) {
    alert({
      key: "licence_expiring",
      category: "compliance",
      severity: "medium",
      title: "Sector licence expiring",
      detail: "A licence required to operate expires within 60 days.",
      recommendedAction: "Obtain the renewal before expiry. A lapsed licence trips a knockout rule on any new application.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  /* ------------------------------------------------------ Documentation --- */

  if (input.documentsExpired > 0) {
    alert({
      key: "documents_expired",
      category: "documentation",
      severity: "medium",
      title: "Expired documents on file",
      detail: `${input.documentsExpired} document${input.documentsExpired === 1 ? " has" : "s have"} expired without replacement.`,
      recommendedAction: "Request replacements. The file cannot support a limit increase while mandatory documents are stale.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }
  if (input.documentsExpiringWithin30Days > 0) {
    alert({
      key: "documents_expiring",
      category: "documentation",
      severity: "info",
      title: "Documents expiring soon",
      detail: `${input.documentsExpiringWithin30Days} document${input.documentsExpiringWithin30Days === 1 ? "" : "s"} expire within 30 days.`,
      recommendedAction: "Request replacements now to avoid a gap.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  /* ------------------------------------------------------------ Covenant --- */

  if (input.covenantsBreachedUncured > 0) {
    alert({
      key: "covenant_breach",
      category: "covenant",
      severity: "high",
      title: "Uncured covenant breach",
      detail: `${input.covenantsBreachedUncured} covenant breach${input.covenantsBreachedUncured === 1 ? "" : "es"} remain uncured.`,
      recommendedAction:
        "Either agree a documented cure plan or exercise the rights the breach gives PayBridge. An unactioned breach weakens every other covenant.",
      suggestsDrawdownPause: true,
      triggersRescore: true,
    });
  }

  /* ------------------------------------------------------------ External --- */

  if (input.validatedAdverseFindingsSinceLastReview > 0) {
    alert({
      key: "validated_adverse_finding",
      category: "external",
      severity: "high",
      title: "Verified adverse finding",
      detail: `${input.validatedAdverseFindingsSinceLastReview} adverse finding${input.validatedAdverseFindingsSinceLastReview === 1 ? "" : "s"} verified by a risk analyst since the last review.`,
      recommendedAction: "Assess the effect on repayment capacity and record whether the exposure should be reduced.",
      suggestsDrawdownPause: false,
      triggersRescore: true,
    });
  }
  if (input.unvalidatedFindingsPending > 0) {
    /*
     * Info severity, deliberately. Unverified external items are surfaced as work
     * to do and never as a finding — the specification is explicit that negative
     * news must not be treated as fact.
     */
    alert({
      key: "unvalidated_intelligence",
      category: "external",
      severity: "info",
      title: "External items awaiting verification",
      detail: `${input.unvalidatedFindingsPending} external intelligence item${input.unvalidatedFindingsPending === 1 ? "" : "s"} await analyst verification. They do not affect the score or the level until verified.`,
      recommendedAction: "A risk analyst should verify each item and record whether it is material.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  /* ---------------------------------------------------------- Governance --- */

  if (input.daysUntilNextReview !== null && input.daysUntilNextReview < 0) {
    alert({
      key: "review_overdue",
      category: "governance",
      severity: input.daysUntilNextReview < -60 ? "high" : "medium",
      title: "Periodic review overdue",
      detail: `The scheduled review is ${Math.abs(input.daysUntilNextReview)} days overdue.`,
      recommendedAction: "Complete the review. An overdue review on a live exposure is a control failure in its own right.",
      suggestsDrawdownPause: false,
      triggersRescore: true,
    });
  }

  if (input.scoreAgeDays !== null && input.scoreAgeDays > 120) {
    alert({
      key: "score_stale",
      category: "governance",
      severity: "medium",
      title: "Score out of date",
      detail: `The composite score was last calculated ${input.scoreAgeDays} days ago.`,
      recommendedAction: "Recalculate against the current data and the active policy version.",
      suggestsDrawdownPause: false,
      triggersRescore: true,
    });
  }

  if (
    input.currentScore !== null &&
    input.previousScore !== null &&
    input.previousScore - input.currentScore >= 10
  ) {
    alert({
      key: "score_deterioration",
      category: "governance",
      severity: input.previousScore - input.currentScore >= 20 ? "high" : "medium",
      title: "Score deteriorating",
      detail: `The composite score fell from ${input.previousScore.toFixed(1)} to ${input.currentScore.toFixed(1)}.`,
      recommendedAction:
        "Review which components moved and whether the approved limit remains appropriate. A reduction is a credit decision and needs the usual authority.",
      suggestsDrawdownPause: false,
      triggersRescore: false,
    });
  }

  /* --------------------------------------------------------------- Level --- */

  const peakSeverity =
    alerts.length === 0
      ? null
      : alerts
          .map((a) => a.severity)
          .reduce((worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst));

  /*
   * The level is driven by the WORST alert, not by a count or an average.
   * Averaging would let a file with one critical payroll failure and eight
   * informational items read as amber, which is exactly backwards: one employer
   * failing to pay salaries is the whole point of the system.
   */
  const level: WarningLevel =
    peakSeverity === null
      ? "green"
      : SEVERITY_RANK[peakSeverity] >= SEVERITY_RANK.high
        ? "red"
        : SEVERITY_RANK[peakSeverity] >= SEVERITY_RANK.medium
          ? "amber"
          : SEVERITY_RANK[peakSeverity] >= SEVERITY_RANK.low
            ? "amber"
            : "green";

  const levelReason =
    peakSeverity === null
      ? "No monitoring rule has triggered on the latest data."
      : `Driven by the most severe open alert: ${alerts.find((a) => a.severity === peakSeverity)?.title}.`;

  const participationRate =
    input.participantCount !== null &&
    input.eligibleEmployeeCount !== null &&
    input.eligibleEmployeeCount > 0
      ? input.participantCount / input.eligibleEmployeeCount
      : null;

  /*
   * Review cadence tightens with the level rather than staying on the tier's
   * schedule. An employer that has just missed payroll should not wait for its
   * quarterly review.
   */
  const recommendedNextReviewDays = level === "red" ? 7 : level === "amber" ? 30 : 90;

  const summary =
    alerts.length === 0
      ? "Performing. All monitoring rules passed on the latest payroll, bank, compliance and documentation data."
      : `${WARNING_LABELS[level]}. ${alerts.length} alert${alerts.length === 1 ? "" : "s"} open across ${new Set(alerts.map((a) => a.category)).size} categor${new Set(alerts.map((a) => a.category)).size === 1 ? "y" : "ies"}. Next review recommended within ${recommendedNextReviewDays} days.`;

  return {
    employerId: input.employerId,
    level,
    levelReason,
    alerts: alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]),
    peakSeverity,
    participationRate,
    utilisationRate,
    suggestDrawdownPause: alerts.some((a) => a.suggestsDrawdownPause),
    triggerRescore: alerts.some((a) => a.triggersRescore),
    recommendedNextReviewDays,
    summary,
    assessedAt: new Date().toISOString(),
  };
}

/**
 * Monitoring cadence for a tier, from the policy rather than from a constant.
 *
 * Used to schedule the background job. The monitoring result can shorten the
 * interval but never lengthen it beyond what the tier requires.
 */
export function cadenceDaysForTier(tier: string | null, policy: CreditPolicy): number {
  const rule = tier ? policy.limitRules[tier] : undefined;
  switch (rule?.monitoringFrequency) {
    case "weekly":
      return 7;
    case "per_cycle":
      return 30;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    default:
      return 30;
  }
}
