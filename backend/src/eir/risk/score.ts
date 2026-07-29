/**
 * COMPOSITE SCORING ORCHESTRATOR — deterministic, no AI.
 *
 * Runs the six modules, applies the policy weights, derives the tier, evaluates
 * the knockout rules and calls the limit engine. This is the only function the
 * rest of the application should use to produce a score, and it is a pure
 * function: assembled evidence in, snapshot out. It performs no database access
 * and no network calls, which is what makes a score reproducible from a stored
 * input set months later during a dispute or an audit.
 *
 * THE ORDER MATTERS. Weights are applied first, THEN knockouts. It would be
 * cheaper to short-circuit on a sanctions hit and skip the arithmetic, but the
 * file must show what the employer scored AND that a rule stopped it. A record
 * saying only "blocked" cannot answer the reviewer's next question, which is
 * always "and how did they look otherwise?".
 *
 * NOTHING HERE DECIDES ANYTHING. The result carries `decisionPermitted` and a
 * recommended tier and limits. It never carries an approval. Writing a decision
 * is the decision service's job, requires a human actor id, and re-checks the
 * knockout state at the point of writing rather than trusting this snapshot.
 */

import {
  type BehaviouralInput,
  type BehaviouralResult,
  assessBehaviouralTrust,
} from "./behavioural";
import {
  type ComplianceInput,
  type ComplianceResult,
  assessCompliance,
} from "./compliance";
import { type FinancialInput, type FinancialResult, assessFinancialHealth } from "./financial";
import { type IndustryContextResult, industryTemplate, scoreIndustryContext } from "./industry";
import { type IdentityInput, type IdentityResult, assessIdentityConfidence } from "./identity";
import {
  type KnockoutOverrideInput,
  type KnockoutSummary,
  evaluateKnockouts,
} from "./knockouts";
import { type LimitResult, recommendLimits } from "./limits";
import { type PayrollInput, type PayrollResult, assessPayrollReliability } from "./payroll";
import {
  COMPONENT_LABELS,
  type Classification,
  type CreditPolicy,
  type CreditProduct,
  type ScoreComponentKey,
  type ScoreWeights,
  type Tier,
  TIER_LABELS,
  tierFor,
  weightsForIndustry,
} from "./policy";

/* ------------------------------------------------------------------- INPUTS */

export interface ScoringInput {
  employerId: string;
  applicationId: string | null;

  identity: IdentityInput;
  financial: FinancialInput;
  payroll: PayrollInput;
  behavioural: BehaviouralInput;
  compliance: ComplianceInput;

  industry: string | null;
  businessAgeMonths: number | null;
  governmentRevenueShare: number | null;

  /* Facts the knockout engine needs that no module owns. */
  falseDocumentationFound: boolean;
  openFraudFlag: boolean;
  undisclosedBorrowingFound: boolean;
  bureauSeriousDelinquency: boolean;
  bureauWrittenOffFacility: boolean;
  complianceCleared: boolean;

  /* Limit engine context. */
  requestedProducts: CreditProduct[];
  requestedAmount: number | null;
  totalApprovedBook: number | null;
  existingExposureToEmployer: number;
  existingExposureToIndustry: number;

  /** Overrides already recorded against the application. */
  knockoutOverrides?: KnockoutOverrideInput[];
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface ComponentScore {
  component: ScoreComponentKey;
  label: string;
  /** The module's raw 0–100 output. */
  rawScore: number;
  /** The weight applied, after any industry adjustment. */
  weight: number;
  /** rawScore × weight ÷ 100 — the contribution to the total. */
  weightedScore: number;
  classification: Classification;
  /** True where the module flagged the underlying data as too thin. */
  dataInsufficient: boolean;
  explanation: string;
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
}

export interface ScoreResult {
  employerId: string;
  applicationId: string | null;
  policyVersion: string;

  totalScore: number;
  tier: Tier;
  tierLabel: string;
  classification: Classification;

  weights: ScoreWeights;
  /** True where the industry override changed the weights from the base set. */
  weightsAdjustedForIndustry: boolean;

  components: ComponentScore[];

  /** Full module outputs, for the profile page and the memorandum. */
  detail: {
    identity: IdentityResult;
    financial: FinancialResult;
    payroll: PayrollResult;
    behavioural: BehaviouralResult;
    compliance: ComplianceResult;
    industry: IndustryContextResult;
  };

  knockouts: KnockoutSummary;
  limits: LimitResult;

  /** False while any blocking or decline knockout stands. */
  decisionPermitted: boolean;
  /** The workflow route this score implies. Not a decision. */
  recommendedRoute:
    | "proceed_to_review"
    | "enhanced_due_diligence"
    | "committee_referral"
    | "decline"
    | "blocked";

  /** Verified data completeness, so a thin file is never mistaken for a good one. */
  dataCompleteness: {
    payrollMonths: number;
    financialMonths: number;
    documentsVerified: number;
    documentsOutstanding: number;
    percent: number;
    sufficientForDecision: boolean;
  };

  /** Consolidated, ranked reasons for the score. Plain language, no AI. */
  keyStrengths: string[];
  keyConcerns: string[];
  outstandingItems: string[];

  explanation: string;
  calculatedAt: string;
}

/* ------------------------------------------------------------------ HELPERS */

/** Pull a metric value out of the financial result without re-deriving it. */
function metricValue(financial: FinancialResult, key: string): number | null {
  return financial.metrics.find((m) => m.metric === key)?.value ?? null;
}

/* --------------------------------------------------------------- THE ENGINE */

export function calculateScore(input: ScoringInput, policy: CreditPolicy): ScoreResult {
  /* ------------------------------------------------- 1. Run the modules --- */

  const identity = assessIdentityConfidence(input.identity);
  const financial = assessFinancialHealth(input.financial, policy);
  const payroll = assessPayrollReliability(input.payroll, policy);
  const behavioural = assessBehaviouralTrust(input.behavioural);
  const compliance = assessCompliance(input.compliance);
  const industry = scoreIndustryContext({
    industry: input.industry,
    observedConcentration:
      input.financial.receivablesConcentration ?? input.financial.customerConcentration ?? null,
    businessAgeMonths: input.businessAgeMonths,
    governmentRevenueShare: input.governmentRevenueShare,
  });

  /* ------------------------------------------------- 2. Apply the weights - */

  const weights = weightsForIndustry(policy, input.industry);
  const baseWeights = policy.weights;
  const weightsAdjustedForIndustry = (Object.keys(weights) as ScoreComponentKey[]).some(
    (k) => Math.abs(weights[k] - baseWeights[k]) > 0.001,
  );

  const raw: Record<ScoreComponentKey, { score: number; classification: Classification; thin: boolean; explanation: string; factors: ComponentScore["factors"] }> = {
    identity: {
      score: identity.score,
      classification: identity.classification,
      thin: identity.absentCount > 0,
      explanation: identity.explanation,
      factors: identity.factors,
    },
    financial: {
      score: financial.score,
      classification: financial.classification,
      thin: financial.dataInsufficient,
      explanation: financial.explanation,
      factors: financial.factors,
    },
    payroll: {
      score: payroll.score,
      classification: payroll.classification,
      thin: payroll.dataInsufficient,
      explanation: payroll.explanation,
      factors: payroll.factors,
    },
    behavioural: {
      score: behavioural.score,
      classification: behavioural.classification,
      thin: behavioural.limitedHistory,
      explanation: behavioural.explanation,
      factors: behavioural.factors,
    },
    compliance: {
      score: compliance.score,
      classification: compliance.classification,
      thin: compliance.sanctionsNotScreened,
      explanation: compliance.explanation,
      factors: compliance.factors,
    },
    industry: {
      score: industry.score,
      classification: industry.classification,
      thin: industry.classification === "insufficient_data",
      explanation: industry.summary,
      factors: industry.factors,
    },
  };

  const components: ComponentScore[] = (Object.keys(weights) as ScoreComponentKey[]).map((key) => {
    const r = raw[key];
    return {
      component: key,
      label: COMPONENT_LABELS[key],
      rawScore: r.score,
      weight: weights[key],
      /* Rounded to two places: the total must reconcile to the sum shown on
       * screen, and a hidden fifth decimal that makes the column not add up is
       * the fastest way to lose a reviewer's trust in the whole engine. */
      weightedScore: Math.round(((r.score * weights[key]) / 100) * 100) / 100,
      classification: r.classification,
      dataInsufficient: r.thin,
      explanation: r.explanation,
      factors: r.factors,
    };
  });

  const totalScore =
    Math.round(components.reduce((sum, c) => sum + c.weightedScore, 0) * 100) / 100;

  const tier = tierFor(totalScore, policy) ?? "E";

  /* ------------------------------------------------- 3. Knockout rules ---- */

  const knockouts = evaluateKnockouts(
    {
      sanctionsConfirmed: compliance.sanctionsConfirmed,
      sanctionsPotential: compliance.sanctionsPotential,
      sanctionsNotScreened: compliance.sanctionsNotScreened,
      consentMissing: compliance.consentMissing,
      insolvencyProceedings: compliance.insolvencyProceedings,
      licenceRequired: input.compliance.licenceRequired,
      licenceLapsed: compliance.licenceLapsed,
      complianceCleared: input.complianceCleared,
      identityUnverifiable: identity.identityUnverifiable,
      falseDocumentationFound: input.falseDocumentationFound,
      openFraudFlag: input.openFraudFlag,
      missedPayrollCycles: payroll.missedCycles,
      payrollBankMismatchCycles: payroll.mismatchedCycles,
      verifiedPayrollMonths: payroll.monthsAvailable,
      undisclosedBorrowingFound: input.undisclosedBorrowingFound,
      bureauSeriousDelinquency: input.bureauSeriousDelinquency,
      bureauWrittenOffFacility: input.bureauWrittenOffFacility,
      industry: input.industry,
      industryProhibited: industryTemplate(input.industry)?.prohibited ?? false,
    },
    policy,
    input.knockoutOverrides ?? [],
  );

  /* ------------------------------------------------- 4. Limit engine ------ */

  const inflows = metricValue(financial, "average_monthly_inflows");
  const outflows = metricValue(financial, "average_monthly_outflows");

  const limits = recommendLimits(
    {
      tier,
      totalScore,
      verifiedMonthlyPayroll:
        input.financial.verifiedMonthlyPayroll ?? input.financial.declaredMonthlyPayroll ?? null,
      verifiedEmployeeCount:
        input.payroll.cycles.at(-1)?.employeeCount ?? null,
      verifiedPayrollMonths: payroll.monthsAvailable,
      verifiedFinancialMonths: financial.monthsAvailable,
      requestedProducts: input.requestedProducts,
      requestedAmount: input.requestedAmount,
      averageMonthlyNetSurplus: inflows !== null && outflows !== null ? inflows - outflows : null,
      lowestClosingBalance: metricValue(financial, "lowest_closing_balance"),
      cashReserveMonths: metricValue(financial, "cash_reserve_months"),
      totalApprovedBook: input.totalApprovedBook,
      existingExposureToEmployer: input.existingExposureToEmployer,
      existingExposureToIndustry: input.existingExposureToIndustry,
      enhancedDueDiligenceRequired: knockouts.enhancedDueDiligenceRequired,
      committeeReferralRequired: knockouts.committeeReferralRequired,
      blocked: knockouts.blocked,
      declineMandated: knockouts.declineMandated,
    },
    policy,
  );

  /* ------------------------------------------------- 5. Route and summary - */

  const recommendedRoute: ScoreResult["recommendedRoute"] = knockouts.blocked
    ? "blocked"
    : knockouts.declineMandated
      ? "decline"
      : knockouts.committeeReferralRequired || limits.requiresCommittee
        ? "committee_referral"
        : knockouts.enhancedDueDiligenceRequired
          ? "enhanced_due_diligence"
          : "proceed_to_review";

  const documentsVerified = input.identity.incorporationDocumentVerified ? 1 : 0;
  const payrollCompleteness = Math.min(
    1,
    payroll.monthsAvailable / Math.max(1, policy.portfolioCaps.minPayrollMonths),
  );
  const financialCompleteness = Math.min(
    1,
    financial.monthsAvailable / Math.max(1, policy.portfolioCaps.minFinancialMonths),
  );
  const identityCompleteness =
    identity.checks.filter((c) => c.state !== "not_applicable" && c.weight > 0).length > 0
      ? identity.verifiedCount /
        identity.checks.filter((c) => c.state !== "not_applicable" && c.weight > 0).length
      : 0;

  const completenessPercent = Math.round(
    ((payrollCompleteness + financialCompleteness + identityCompleteness) / 3) * 100,
  );

  const classification: Classification =
    knockouts.blocked || knockouts.declineMandated
      ? "critical"
      : totalScore >= 85
        ? "strong"
        : totalScore >= 75
          ? "acceptable"
          : totalScore >= 65
            ? "watch"
            : totalScore >= 50
              ? "weak"
              : "critical";

  /*
   * Strengths and concerns are assembled from the modules' own factor lists, not
   * generated. Every line here traces to a calculation that can be pointed at,
   * which is the whole point of the explainability requirement.
   */
  const allFactors = components.flatMap((c) =>
    c.factors.map((f) => ({ ...f, component: c.label, componentScore: c.rawScore })),
  );

  const keyStrengths = allFactors
    .filter((f) => f.effect === "positive")
    .sort((a, b) => b.componentScore - a.componentScore)
    .slice(0, 6)
    .map((f) => `${f.component}: ${f.factor} — ${f.detail}`);

  const keyConcerns = [
    ...knockouts.active.map((k) => `${k.label} — ${k.evidence}`),
    ...allFactors
      .filter((f) => f.effect === "negative")
      .sort((a, b) => a.componentScore - b.componentScore)
      .map((f) => `${f.component}: ${f.factor} — ${f.detail}`),
  ].slice(0, 10);

  const outstandingItems = [
    ...compliance.outstandingForAnalyst,
    ...identity.checks
      .filter((c) => c.state === "absent" && c.blocking)
      .map((c) => `Obtain and verify: ${c.label}.`),
    ...(payroll.monthsAvailable < policy.portfolioCaps.minPayrollMonths
      ? [
          `Load ${policy.portfolioCaps.minPayrollMonths - payroll.monthsAvailable} further payroll cycle(s) to meet the policy minimum.`,
        ]
      : []),
    ...(financial.monthsAvailable < policy.portfolioCaps.minFinancialMonths
      ? [
          `Load ${policy.portfolioCaps.minFinancialMonths - financial.monthsAvailable} further month(s) of bank or financial data.`,
        ]
      : []),
  ];

  const explanation = `Total score ${totalScore.toFixed(2)} of 100 places this employer in tier ${tier} (${TIER_LABELS[tier]}) under policy ${policy.version}. Composed of ${components
    .map((c) => `${c.label} ${c.rawScore} × ${c.weight}% = ${c.weightedScore.toFixed(2)}`)
    .join("; ")}. ${knockouts.active.length === 0 ? `All ${knockouts.evaluations.length} knockout rules passed.` : `${knockouts.active.length} of ${knockouts.evaluations.length} knockout rules are in force.`} Verified data completeness ${completenessPercent}%.`;

  return {
    employerId: input.employerId,
    applicationId: input.applicationId,
    policyVersion: policy.version,
    totalScore,
    tier,
    tierLabel: TIER_LABELS[tier],
    classification,
    weights,
    weightsAdjustedForIndustry,
    components,
    detail: { identity, financial, payroll, behavioural, compliance, industry },
    knockouts,
    limits,
    decisionPermitted: !knockouts.blocked,
    recommendedRoute,
    dataCompleteness: {
      payrollMonths: payroll.monthsAvailable,
      financialMonths: financial.monthsAvailable,
      documentsVerified,
      documentsOutstanding: identity.absentCount,
      percent: completenessPercent,
      sufficientForDecision:
        payroll.monthsAvailable >= policy.portfolioCaps.minPayrollMonths &&
        financial.monthsAvailable >= policy.portfolioCaps.minFinancialMonths,
    },
    keyStrengths,
    keyConcerns,
    outstandingItems,
    explanation,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Why a score moved between two snapshots.
 *
 * The specification requires a "reason for change" on every score. Recomputing a
 * diff from the two stored snapshots is more honest than writing a reason at
 * calculation time, because it cannot drift from the numbers it describes.
 */
export function explainScoreChange(
  previous: Pick<ScoreResult, "totalScore" | "tier" | "components" | "policyVersion">,
  current: Pick<ScoreResult, "totalScore" | "tier" | "components" | "policyVersion">,
): { direction: "up" | "down" | "unchanged"; delta: number; tierChanged: boolean; drivers: string[]; summary: string } {
  const delta = Math.round((current.totalScore - previous.totalScore) * 100) / 100;
  const direction = delta > 0.005 ? "up" : delta < -0.005 ? "down" : "unchanged";

  const drivers: string[] = [];

  if (current.policyVersion !== previous.policyVersion) {
    drivers.push(
      `Policy version changed from ${previous.policyVersion} to ${current.policyVersion}. Part of the movement is a change in the rules, not in the employer.`,
    );
  }

  for (const c of current.components) {
    const p = previous.components.find((x) => x.component === c.component);
    if (!p) continue;
    const rawDelta = c.rawScore - p.rawScore;
    const weightDelta = c.weight - p.weight;
    if (Math.abs(rawDelta) >= 1) {
      drivers.push(
        `${c.label} moved ${rawDelta > 0 ? "up" : "down"} ${Math.abs(rawDelta)} point${Math.abs(rawDelta) === 1 ? "" : "s"} (${p.rawScore} → ${c.rawScore}).`,
      );
    }
    if (Math.abs(weightDelta) > 0.001) {
      drivers.push(`${c.label} weight changed from ${p.weight}% to ${c.weight}%.`);
    }
  }

  const tierChanged = current.tier !== previous.tier;

  const summary =
    direction === "unchanged" && !tierChanged
      ? "No material change in the composite score."
      : `Score ${direction === "up" ? "rose" : "fell"} ${Math.abs(delta).toFixed(2)} points to ${current.totalScore.toFixed(2)}${tierChanged ? `, moving from tier ${previous.tier} to tier ${current.tier}` : ` (tier ${current.tier} unchanged)`}.`;

  return { direction, delta, tierChanged, drivers, summary };
}
