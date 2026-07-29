/**
 * BEHAVIOURAL TRUST MODULE — deterministic, no AI.
 *
 * Scores how the employer has BEHAVED towards PayBridge and towards its own
 * obligations, as distinct from whether it has the money. An employer with
 * strong finances that misses reporting deadlines, submits contradictory
 * numbers and goes quiet under enquiry is a worse credit than its balance sheet
 * suggests, and this is the only module that can see that.
 *
 * WHAT THIS IS NOT. It is not a judgement of character, and it deliberately
 * contains no free-text sentiment. Every input is a counted event with a record
 * behind it: a document resubmitted, a data request unanswered for N days, a
 * declared figure that disagreed with a bank statement by more than a
 * tolerance. That constraint is what makes the score defensible to the employer
 * when they ask why it moved.
 *
 * STARTING POSITION. A new employer starts at a neutral 60, not at 0 or 100.
 * There is no behavioural record yet: zero would price absence of history as
 * misconduct, and 100 would hand an unearned advantage to a file that has never
 * been tested. The score then moves on observed conduct.
 */

import type { Classification } from "./policy";

/* ------------------------------------------------------------------- INPUTS */

export interface BehaviouralInput {
  /** Months since the employer was onboarded. Length of the observation window. */
  relationshipMonths: number | null;

  /* Onboarding and reporting conduct. */
  documentsRequested: number;
  documentsProvided: number;
  documentsRejectedForQuality: number;
  documentsExpiredUnreplaced: number;
  /** Days the slowest outstanding information request has been open. */
  longestOpenRequestDays: number | null;
  /** Mean days to satisfy a completed information request. */
  averageResponseDays: number | null;
  informationRequestsOutstanding: number;

  /* Integrity of what they told us. */
  /** Declarations contradicted by evidence, e.g. stated payroll ≠ bank payroll. */
  declarationInconsistencies: number;
  /** Inconsistencies the employer has since explained and a reviewer accepted. */
  inconsistenciesResolved: number;
  /** Material facts found by PayBridge that the employer had not disclosed. */
  undisclosedFacts: number;

  /* Conduct on live facilities, where any. */
  facilityCycles: number;
  repaymentsOnTime: number;
  repaymentsLate: number;
  repaymentsMissed: number;
  /** Direct debits or mandates returned unpaid. */
  returnedPayments: number;
  /** Covenants breached over the relationship. */
  covenantBreaches: number;
  covenantBreachesCured: number;

  /* Engagement. */
  /** Monitoring reviews where the employer failed to submit updated data on time. */
  monitoringSubmissionsLate: number;
  monitoringSubmissionsDue: number;
  /** Employer-side admin logins in the last 90 days: a liveness signal only. */
  recentPortalActivity: boolean;
  /** Consent withdrawn then re-granted, or data connection disconnected. */
  dataConnectionInterruptions: number;
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface BehaviouralSignal {
  key: string;
  label: string;
  /** Points applied to the neutral base. Signed. */
  points: number;
  detail: string;
  category: "responsiveness" | "integrity" | "repayment" | "engagement";
}

export interface BehaviouralResult {
  score: number;
  classification: Classification;
  /** True while there is too little relationship history to read the score as conduct. */
  limitedHistory: boolean;
  baseScore: number;
  signals: BehaviouralSignal[];
  /** Feeds the knockout rules. */
  unresolvedInconsistencies: number;
  materialNonDisclosure: boolean;
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
  explanation: string;
}

/* --------------------------------------------------------------- THE ENGINE */

const NEUTRAL_BASE = 60;

export function assessBehaviouralTrust(input: BehaviouralInput): BehaviouralResult {
  const signals: BehaviouralSignal[] = [];

  const signal = (
    key: string,
    label: string,
    points: number,
    detail: string,
    category: BehaviouralSignal["category"],
  ) => {
    if (points === 0) return;
    signals.push({ key, label, points: Math.round(points), detail, category });
  };

  /* ----------------------------------------------- Responsiveness --------- */

  if (input.documentsRequested > 0) {
    const completion = Math.min(1, input.documentsProvided / input.documentsRequested);
    /*
     * Up to +10 for a complete pack, scaled by how much of it arrived. A file
     * that is 40% complete earns +4, not nothing: partial cooperation is
     * genuinely better than none, and a cliff at 100% would make the score jump
     * on the last upload rather than track the behaviour.
     */
    signal(
      "document_completion",
      "Document pack completion",
      completion * 10 - 2,
      `${input.documentsProvided} of ${input.documentsRequested} requested documents supplied.`,
      "responsiveness",
    );
  }

  signal(
    "document_quality",
    "Document quality",
    -3 * input.documentsRejectedForQuality,
    `${input.documentsRejectedForQuality} document${input.documentsRejectedForQuality === 1 ? "" : "s"} rejected as illegible, incomplete or wrong.`,
    "responsiveness",
  );

  signal(
    "expired_documents",
    "Expired documents not replaced",
    -4 * input.documentsExpiredUnreplaced,
    `${input.documentsExpiredUnreplaced} document${input.documentsExpiredUnreplaced === 1 ? " has" : "s have"} expired without replacement.`,
    "responsiveness",
  );

  const avg = input.averageResponseDays;
  if (avg !== null) {
    /* Under three days is fast and earns credit; beyond ten days is a drag on
     * every downstream process and is penalised progressively. */
    const points = avg <= 3 ? 8 : avg <= 7 ? 4 : avg <= 14 ? -2 : avg <= 30 ? -8 : -14;
    signal(
      "response_speed",
      "Response speed",
      points,
      `Information requests satisfied in an average of ${Math.round(avg)} day${Math.round(avg) === 1 ? "" : "s"}.`,
      "responsiveness",
    );
  }

  const open = input.longestOpenRequestDays;
  if (open !== null && open > 14) {
    signal(
      "stale_request",
      "Long-outstanding request",
      open > 60 ? -14 : open > 30 ? -9 : -5,
      `An information request has been open for ${open} days.`,
      "responsiveness",
    );
  }

  if (input.informationRequestsOutstanding > 2) {
    signal(
      "request_backlog",
      "Outstanding request backlog",
      -2 * (input.informationRequestsOutstanding - 2),
      `${input.informationRequestsOutstanding} information requests are open simultaneously.`,
      "responsiveness",
    );
  }

  /* ---------------------------------------------------- Integrity --------- */

  const unresolved = Math.max(0, input.declarationInconsistencies - input.inconsistenciesResolved);

  signal(
    "unresolved_inconsistencies",
    "Unexplained inconsistencies",
    -8 * unresolved,
    `${unresolved} inconsistenc${unresolved === 1 ? "y" : "ies"} between declared information and supporting evidence remain unexplained.`,
    "integrity",
  );

  if (input.inconsistenciesResolved > 0) {
    /*
     * Resolving a query earns a small positive. Deliberately small: it restores
     * most of the deduction rather than making an inconsistency profitable.
     */
    signal(
      "inconsistencies_resolved",
      "Queries resolved",
      Math.min(6, 2 * input.inconsistenciesResolved),
      `${input.inconsistenciesResolved} quer${input.inconsistenciesResolved === 1 ? "y has" : "ies have"} been explained and accepted by a reviewer.`,
      "integrity",
    );
  }

  signal(
    "undisclosed_facts",
    "Non-disclosure",
    -15 * input.undisclosedFacts,
    `${input.undisclosedFacts} material fact${input.undisclosedFacts === 1 ? "" : "s"} found by PayBridge that the employer did not disclose.`,
    "integrity",
  );

  /* ---------------------------------------------------- Repayment --------- */

  if (input.facilityCycles > 0) {
    const settled = input.repaymentsOnTime + input.repaymentsLate + input.repaymentsMissed;
    if (settled > 0) {
      const onTimeRate = input.repaymentsOnTime / settled;
      /*
       * Live repayment conduct is the strongest behavioural evidence available,
       * so it carries the widest swing: up to +20 for a clean record, and a
       * heavy deduction where it is not clean. It only applies once there is a
       * record — for a new employer this whole block is silent rather than
       * scored as an unknown.
       */
      signal(
        "repayment_conduct",
        "Repayment conduct",
        onTimeRate >= 0.99 ? 20 : onTimeRate >= 0.95 ? 12 : onTimeRate >= 0.85 ? 2 : -10,
        `${input.repaymentsOnTime} of ${settled} settlements met on time.`,
        "repayment",
      );
    }
    signal(
      "missed_repayments",
      "Missed settlements",
      -12 * input.repaymentsMissed,
      `${input.repaymentsMissed} settlement${input.repaymentsMissed === 1 ? "" : "s"} not met.`,
      "repayment",
    );
    signal(
      "returned_payments",
      "Returned payments",
      -5 * input.returnedPayments,
      `${input.returnedPayments} payment instruction${input.returnedPayments === 1 ? "" : "s"} returned unpaid.`,
      "repayment",
    );
  }

  const uncured = Math.max(0, input.covenantBreaches - input.covenantBreachesCured);
  signal(
    "covenant_breaches",
    "Uncured covenant breaches",
    -10 * uncured,
    `${uncured} covenant breach${uncured === 1 ? "" : "es"} outstanding.`,
    "repayment",
  );
  if (input.covenantBreachesCured > 0) {
    signal(
      "covenants_cured",
      "Covenant breaches cured",
      Math.min(4, 2 * input.covenantBreachesCured),
      `${input.covenantBreachesCured} breach${input.covenantBreachesCured === 1 ? "" : "es"} cured within the agreed period.`,
      "repayment",
    );
  }

  /* --------------------------------------------------- Engagement --------- */

  if (input.monitoringSubmissionsDue > 0) {
    const lateRate = input.monitoringSubmissionsLate / input.monitoringSubmissionsDue;
    signal(
      "monitoring_submissions",
      "Monitoring submissions",
      lateRate === 0 ? 6 : lateRate <= 0.2 ? 0 : lateRate <= 0.5 ? -6 : -12,
      `${input.monitoringSubmissionsLate} of ${input.monitoringSubmissionsDue} monitoring submissions were late.`,
      "engagement",
    );
  }

  signal(
    "data_interruptions",
    "Data connection interruptions",
    -6 * input.dataConnectionInterruptions,
    `The data connection or consent has been interrupted ${input.dataConnectionInterruptions} time${input.dataConnectionInterruptions === 1 ? "" : "s"}.`,
    "engagement",
  );

  if (!input.recentPortalActivity && (input.relationshipMonths ?? 0) >= 3) {
    signal(
      "dormant_portal",
      "No recent employer activity",
      -4,
      "No employer administrator has signed in during the last 90 days.",
      "engagement",
    );
  }

  /* ------------------------------------------------------------- Scoring --- */

  const delta = signals.reduce((sum, s) => sum + s.points, 0);
  let score = Math.max(0, Math.min(100, NEUTRAL_BASE + delta));

  /*
   * With a very short relationship the signals are real but thin, so the score
   * is pulled back towards neutral rather than allowed to reach either extreme.
   * Three months of tidy document uploads is not evidence of a trustworthy
   * counterparty, and one late response in week two is not evidence of a bad
   * one. The dampening decays as history accumulates and is gone by month six.
   */
  const months = input.relationshipMonths ?? 0;
  const limitedHistory = months < 6 && input.facilityCycles === 0;
  if (limitedHistory) {
    const confidence = Math.max(0.35, Math.min(1, months / 6));
    score = Math.round(NEUTRAL_BASE + (score - NEUTRAL_BASE) * confidence);
  }

  const materialNonDisclosure = input.undisclosedFacts > 0;

  const classification: Classification = limitedHistory
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

  /* ------------------------------------------------------------ Factors --- */

  const factors: BehaviouralResult["factors"] = [];

  if (limitedHistory) {
    factors.push({
      factor: "Limited behavioural history",
      effect: "neutral",
      detail: `${months} month${months === 1 ? "" : "s"} of relationship history and no facility conduct yet. The score is held close to neutral until a record exists.`,
    });
  }

  const positives = signals.filter((s) => s.points > 0).sort((a, b) => b.points - a.points);
  const negatives = signals.filter((s) => s.points < 0).sort((a, b) => a.points - b.points);

  for (const s of positives.slice(0, 3)) {
    factors.push({ factor: s.label, effect: "positive", detail: s.detail });
  }
  for (const s of negatives.slice(0, 4)) {
    factors.push({ factor: s.label, effect: "negative", detail: s.detail });
  }

  if (materialNonDisclosure) {
    factors.push({
      factor: "Material non-disclosure",
      effect: "negative",
      detail:
        "PayBridge identified material information the employer did not disclose. This routes the file to enhanced due diligence regardless of the total score.",
    });
  }
  if (unresolved > 0) {
    factors.push({
      factor: "Open data inconsistencies",
      effect: "negative",
      detail: `${unresolved} inconsistenc${unresolved === 1 ? "y" : "ies"} must be explained before a decision is taken.`,
    });
  }

  const explanation = `Starts from a neutral ${NEUTRAL_BASE} and moves on observed conduct: ${signals.length} recorded signal${signals.length === 1 ? "" : "s"} totalling ${delta >= 0 ? "+" : ""}${delta} point${Math.abs(delta) === 1 ? "" : "s"}${limitedHistory ? ", then dampened towards neutral for limited history" : ""}.`;

  return {
    score,
    classification,
    limitedHistory,
    baseScore: NEUTRAL_BASE,
    signals,
    unresolvedInconsistencies: unresolved,
    materialNonDisclosure,
    factors,
    explanation,
  };
}
