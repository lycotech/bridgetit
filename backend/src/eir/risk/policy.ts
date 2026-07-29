/**
 * CREDIT POLICY — the configurable, versioned rulebook.
 *
 * Everything an authorised administrator is allowed to tune lives in one object
 * so that "what were the rules when this was approved?" is a single row lookup
 * rather than an archaeology exercise across a dozen files.
 *
 * WHY nothing here is a hard-coded constant used elsewhere: a weight, a
 * benchmark or a tier boundary compiled into the calculation would make the
 * published policy version a lie. Every function in this service takes the
 * policy as an argument. `DEFAULT_POLICY` is the seed for version 1 and the
 * fallback when the table is empty — it is not the source of truth at runtime.
 *
 * WHY monetary caps are expressed as MULTIPLES and PERCENTAGES rather than
 * naira amounts: the specification is explicit that permanent monetary amounts
 * must not be inserted into the code. A cap of "1.5 × verified monthly payroll"
 * stays correct as the currency moves and as the portfolio grows; a cap of
 * "₦50,000,000" is wrong the moment either changes. The only absolute figures
 * in the system are the authority thresholds, and those are configured by a
 * Super Admin through the admin screen, seeded here as nulls meaning
 * "unconfigured — refer upward".
 */

import { z } from "zod";

/* ------------------------------------------------------------------ WEIGHTS */

export const SCORE_COMPONENTS = [
  "identity",
  "financial",
  "payroll",
  "behavioural",
  "compliance",
  "industry",
] as const;

export type ScoreComponentKey = (typeof SCORE_COMPONENTS)[number];

export const COMPONENT_LABELS: Record<ScoreComponentKey, string> = {
  identity: "Identity Confidence",
  financial: "Financial Health",
  payroll: "Payroll Reliability",
  behavioural: "Behavioural Trust",
  compliance: "Compliance",
  industry: "Industry Context",
};

export const weightsSchema = z
  .object({
    identity: z.number().min(0).max(100),
    financial: z.number().min(0).max(100),
    payroll: z.number().min(0).max(100),
    behavioural: z.number().min(0).max(100),
    compliance: z.number().min(0).max(100),
    industry: z.number().min(0).max(100),
  })
  /*
   * The total is checked here, in the schema, rather than in the route that
   * saves it. A weight set that does not sum to 100 makes every score
   * incomparable with every other score, and the failure is silent — the
   * numbers still come out, they are just meaningless. So it is rejected at the
   * type boundary, where it cannot be forgotten.
   */
  .refine(
    (w) => Math.abs(Object.values(w).reduce((sum, n) => sum + n, 0) - 100) < 0.001,
    { message: "Component weights must total exactly 100%." },
  );

export type ScoreWeights = z.infer<typeof weightsSchema>;

/* -------------------------------------------------------------------- TIERS */

export const TIERS = ["A", "B", "C", "D", "E"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  D: "Tier D",
  E: "Decline or enhanced review",
};

export const tierBandSchema = z.object({
  tier: z.enum(TIERS),
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
});
export type TierBand = z.infer<typeof tierBandSchema>;

/* --------------------------------------------------------------- BENCHMARKS */

/**
 * A policy benchmark for one metric.
 *
 * `direction` says which way is good, which is what lets one comparison
 * function classify every metric instead of forty bespoke if-ladders — the
 * kind of duplication where a threshold eventually gets updated in nine places
 * out of ten.
 */
export const benchmarkSchema = z.object({
  /** higher_is_better | lower_is_better */
  direction: z.enum(["higher_is_better", "lower_is_better"]),
  /** Boundaries in the direction of improvement. */
  strong: z.number(),
  acceptable: z.number(),
  watch: z.number(),
  weak: z.number(),
  /** How to render the value: ratio | percent | months | days | currency | count */
  unit: z.enum(["ratio", "percent", "months", "days", "currency", "count"]),
});
export type Benchmark = z.infer<typeof benchmarkSchema>;

/* ---------------------------------------------------------- KNOCKOUT RULES */

export const KNOCKOUT_CONSEQUENCES = [
  "blocked",
  "enhanced_due_diligence",
  "committee_referral",
  "decline",
] as const;
export type KnockoutConsequence = (typeof KNOCKOUT_CONSEQUENCES)[number];

export const knockoutRuleSchema = z.object({
  key: z.string(),
  label: z.string(),
  consequence: z.enum(KNOCKOUT_CONSEQUENCES),
  /**
   * Whether ANY human may set this aside.
   *
   * The non-overridable ones are not a matter of seniority: a sanctions match
   * or a forged document is not a risk appetite question, and a system that
   * lets a sufficiently senior person click through one has no sanctions
   * control at all. These are labelled in the UI as non-overridable so nobody
   * wastes time looking for the button.
   */
  overridable: z.boolean(),
  /** Which role may override, where overridable. */
  overrideRole: z.string().nullable().optional(),
  /** Whether an override needs a second authoriser. */
  overrideDualApproval: z.boolean().default(false),
  enabled: z.boolean().default(true),
  /** Plain-language explanation shown wherever the rule fires. */
  description: z.string(),
});
export type KnockoutRule = z.infer<typeof knockoutRuleSchema>;

/* -------------------------------------------------------------- LIMIT RULES */

export const EIR_PRODUCTS = [
  "ewa",
  "payroll_buffer",
  "payroll_financing",
  "savings_investments",
  "wellness_programme",
] as const;
export type EirProduct = (typeof EIR_PRODUCTS)[number];

export const PRODUCT_LABELS: Record<EirProduct, string> = {
  ewa: "Employee earned-wage access",
  payroll_buffer: "Payroll buffer",
  payroll_financing: "Employer payroll financing",
  savings_investments: "Savings and investment benefits",
  wellness_programme: "Workplace financial-wellness programme",
};

/** Products the limit engine sizes. The other two carry no credit exposure. */
export const CREDIT_PRODUCTS = ["ewa", "payroll_buffer", "payroll_financing"] as const;
export type CreditProduct = (typeof CREDIT_PRODUCTS)[number];

export const tierLimitRuleSchema = z.object({
  /** EWA: share of accrued earnings made available, percent. */
  ewaAvailabilityPercent: z.number().min(0).max(100),
  /**
   * Payroll buffer ceiling as a multiple of verified monthly payroll.
   * 0 means the product is not offered at this tier.
   */
  bufferPayrollMultiple: z.number().min(0),
  /** Payroll financing ceiling, also a multiple of verified monthly payroll. */
  financingPayrollMultiple: z.number().min(0),
  /** Per-employee EWA cap as a share of that employee's monthly net pay. */
  employeeCapPercentOfNet: z.number().min(0).max(100),
  /** Per-cycle aggregate cap as a share of the cycle's payroll value. */
  cycleCapPercentOfPayroll: z.number().min(0).max(100),
  maxTenorDays: z.number().int().min(0),
  pricingTier: z.string(),
  /** monthly | per_cycle | weekly — how often monitoring runs at this tier. */
  monitoringFrequency: z.string(),
  securityRequired: z.array(z.string()),
  reserveRequired: z.array(z.string()),
  /** True where any approval at this tier must go to the Credit Committee. */
  requiresCommittee: z.boolean().default(false),
  /** True where only a pilot or employee-funded model is permitted. */
  pilotOnly: z.boolean().default(false),
});
export type TierLimitRule = z.infer<typeof tierLimitRuleSchema>;

/**
 * Portfolio-level guardrails applied AFTER the tier calculation.
 *
 * These are the caps that stop a single well-scoring employer becoming a
 * concentration problem. They bind regardless of tier, which is why they sit
 * outside the per-tier block.
 */
export const portfolioCapsSchema = z.object({
  /** Ceiling on exposure to one employer, as a share of total approved book. */
  singleEmployerPercentOfBook: z.number().min(0).max(100),
  /** Ceiling on exposure to one industry, same basis. */
  singleIndustryPercentOfBook: z.number().min(0).max(100),
  /** Minimum verified payroll months before any credit product is offered. */
  minPayrollMonths: z.number().int().min(0),
  /** Minimum verified bank/financial months. */
  minFinancialMonths: z.number().int().min(0),
  /** Minimum months on the platform before a limit increase is considered. */
  minTenureMonthsForIncrease: z.number().int().min(0),
  /** A limit increase above this percentage needs dual approval. */
  increaseDualApprovalPercent: z.number().min(0),
});
export type PortfolioCaps = z.infer<typeof portfolioCapsSchema>;

/* -------------------------------------------------------- AUTHORITY MATRIX */

export const AUTHORITY_LEVELS = [
  "credit_administrator",
  "head_of_risk",
  "managing_director",
  "credit_committee",
  "board",
] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  credit_administrator: "Credit Administrator",
  head_of_risk: "Head of Risk",
  managing_director: "Managing Director",
  credit_committee: "Credit Committee",
  board: "Board",
};

export const authorityRuleSchema = z.object({
  level: z.enum(AUTHORITY_LEVELS),
  /**
   * Maximum single-employer exposure this level may approve.
   *
   * NULL means "not configured". Unconfigured is treated as ZERO authority, not
   * unlimited — the deny-by-default reading. A fresh deployment therefore
   * refers everything upward until a Super Admin sets real thresholds on the
   * Credit Authority screen, which is the correct failure mode.
   */
  maxExposure: z.number().min(0).nullable(),
  /** Whether every approval at this level needs a second authoriser. */
  dualApproval: z.boolean().default(false),
  /** Committee levels need a quorum and a majority. */
  quorum: z.number().int().min(0).default(0),
  requiredMajority: z.number().int().min(0).default(0),
});
export type AuthorityRule = z.infer<typeof authorityRuleSchema>;

/**
 * Situations that always need two authorisers, whatever the amount.
 *
 * Amount-based dual approval is not enough on its own: a policy exception or an
 * adverse compliance finding is a judgement that wants a second pair of eyes at
 * any size, and the small ones are exactly where a single reviewer's error is
 * least likely to be noticed.
 */
export const dualApprovalTriggersSchema = z.object({
  policyException: z.boolean().default(true),
  knockoutOverride: z.boolean().default(true),
  connectedParty: z.boolean().default(true),
  adverseComplianceFinding: z.boolean().default(true),
  limitIncreaseAbovePercent: z.number().min(0).default(25),
});
export type DualApprovalTriggers = z.infer<typeof dualApprovalTriggersSchema>;

/* ------------------------------------------------------------ WHOLE POLICY */

export const creditPolicySchema = z.object({
  /**
   * The version label this rulebook was published under.
   *
   * Carried INSIDE the policy, not only on the ScoringPolicyVersion row, so that
   * a snapshot stored against a historical decision is self-describing. A score
   * that says "calculated under v3" while the JSON beside it is actually v2 is
   * worse than no version at all, and keeping the label in the same object makes
   * that divergence impossible.
   */
  version: z.string(),
  weights: weightsSchema,
  tiers: z.array(tierBandSchema).min(1),
  benchmarks: z.record(z.string(), benchmarkSchema),
  knockoutRules: z.array(knockoutRuleSchema),
  limitRules: z.record(z.string(), tierLimitRuleSchema),
  portfolioCaps: portfolioCapsSchema,
  authorityMatrix: z.array(authorityRuleSchema),
  dualApprovalTriggers: dualApprovalTriggersSchema,
  /** Per-industry weight nudges and extra diligence questions. */
  industryOverrides: z
    .record(
      z.string(),
      z.object({
        weightAdjustments: z.record(z.string(), z.number()).optional(),
        benchmarkOverrides: z.record(z.string(), benchmarkSchema).optional(),
      }),
    )
    .optional(),
});
export type CreditPolicy = z.infer<typeof creditPolicySchema>;

/* ------------------------------------------------------------------ DEFAULT */

/**
 * Seed policy — version 1.
 *
 * The weights are the specification's: identity 15, financial 25, payroll 25,
 * behavioural 15, compliance 10, industry 10. Payroll carries equal weight to
 * financial health on purpose. For a rail whose repayment source IS the payroll
 * run, an employer who pays late every month is a worse risk than one with a
 * thinner balance sheet who has never missed a salary date.
 */
export const DEFAULT_POLICY: CreditPolicy = {
  version: "v1",
  weights: {
    identity: 15,
    financial: 25,
    payroll: 25,
    behavioural: 15,
    compliance: 10,
    industry: 10,
  },

  tiers: [
    { tier: "A", min: 85, max: 100 },
    { tier: "B", min: 75, max: 84.999 },
    { tier: "C", min: 65, max: 74.999 },
    { tier: "D", min: 50, max: 64.999 },
    { tier: "E", min: 0, max: 49.999 },
  ],

  /*
   * Benchmarks are Nigerian-market starting points, deliberately conservative
   * for a first policy version. They are the numbers a Head of Risk should
   * argue with — which they can, on the Scoring Policy screen, with a reason
   * recorded and a new version created.
   */
  benchmarks: {
    payroll_to_revenue: {
      direction: "lower_is_better",
      strong: 0.2,
      acceptable: 0.35,
      watch: 0.5,
      weak: 0.65,
      unit: "ratio",
    },
    payroll_to_inflow: {
      direction: "lower_is_better",
      strong: 0.2,
      acceptable: 0.35,
      watch: 0.5,
      weak: 0.7,
      unit: "ratio",
    },
    salary_coverage: {
      direction: "higher_is_better",
      strong: 3,
      acceptable: 2,
      watch: 1.3,
      weak: 1,
      unit: "ratio",
    },
    cash_reserve_months: {
      direction: "higher_is_better",
      strong: 3,
      acceptable: 1.5,
      watch: 0.75,
      weak: 0.25,
      unit: "months",
    },
    liquidity_coverage: {
      direction: "higher_is_better",
      strong: 2,
      acceptable: 1.25,
      watch: 1,
      weak: 0.8,
      unit: "ratio",
    },
    cash_flow_volatility: {
      direction: "lower_is_better",
      strong: 0.15,
      acceptable: 0.3,
      watch: 0.45,
      weak: 0.6,
      unit: "ratio",
    },
    debt_service_burden: {
      direction: "lower_is_better",
      strong: 0.1,
      acceptable: 0.2,
      watch: 0.35,
      weak: 0.5,
      unit: "ratio",
    },
    operating_margin: {
      direction: "higher_is_better",
      strong: 0.2,
      acceptable: 0.1,
      watch: 0.05,
      weak: 0,
      unit: "ratio",
    },
    revenue_trend: {
      direction: "higher_is_better",
      strong: 0.1,
      acceptable: 0,
      watch: -0.1,
      weak: -0.25,
      unit: "ratio",
    },
    customer_concentration: {
      direction: "lower_is_better",
      strong: 0.25,
      acceptable: 0.4,
      watch: 0.55,
      weak: 0.7,
      unit: "ratio",
    },
    receivables_concentration: {
      direction: "lower_is_better",
      strong: 0.25,
      acceptable: 0.4,
      watch: 0.6,
      weak: 0.75,
      unit: "ratio",
    },
    lender_exposure: {
      direction: "lower_is_better",
      strong: 0.5,
      acceptable: 1,
      watch: 2,
      weak: 3,
      unit: "ratio",
    },
    returned_payment_rate: {
      direction: "lower_is_better",
      strong: 0,
      acceptable: 0.01,
      watch: 0.03,
      weak: 0.06,
      unit: "ratio",
    },
    remittance_consistency: {
      direction: "higher_is_better",
      strong: 0.95,
      acceptable: 0.85,
      watch: 0.7,
      weak: 0.5,
      unit: "percent",
    },
    lowest_balance_to_payroll: {
      direction: "higher_is_better",
      strong: 1,
      acceptable: 0.5,
      watch: 0.25,
      weak: 0.1,
      unit: "ratio",
    },

    /* ---- Payroll behaviour ---- */
    on_time_payroll_rate: {
      direction: "higher_is_better",
      strong: 0.98,
      acceptable: 0.9,
      watch: 0.75,
      weak: 0.6,
      unit: "percent",
    },
    average_delay_days: {
      direction: "lower_is_better",
      strong: 0,
      acceptable: 2,
      watch: 5,
      weak: 10,
      unit: "days",
    },
    max_delay_days: {
      direction: "lower_is_better",
      strong: 1,
      acceptable: 5,
      watch: 12,
      weak: 21,
      unit: "days",
    },
    missed_cycles: {
      direction: "lower_is_better",
      strong: 0,
      acceptable: 0,
      watch: 1,
      weak: 2,
      unit: "count",
    },
    payroll_value_volatility: {
      direction: "lower_is_better",
      strong: 0.05,
      acceptable: 0.12,
      watch: 0.25,
      weak: 0.4,
      unit: "ratio",
    },
    headcount_volatility: {
      direction: "lower_is_better",
      strong: 0.03,
      acceptable: 0.08,
      watch: 0.15,
      weak: 0.25,
      unit: "ratio",
    },
  },

  /*
   * Knockout rules. Five of these are NON-OVERRIDABLE, and the choice of which
   * five is the substance of the control: sanctions, unverifiable identity,
   * false documentation, missing consent and active insolvency. Each is either a
   * legal bar or a foundation the rest of the assessment stands on — an
   * assessment of an employer whose identity cannot be verified is an assessment
   * of nobody, and no amount of seniority changes that.
   */
  knockoutRules: [
    {
      key: "sanctions_failed",
      label: "Failed sanctions screening",
      consequence: "blocked",
      overridable: false,
      overrideDualApproval: false,
      enabled: true,
      description:
        "A confirmed sanctions match against the company, a director or a beneficial owner. A legal bar, not a risk-appetite decision.",
    },
    {
      key: "identity_unverifiable",
      label: "Corporate identity could not be verified",
      consequence: "blocked",
      overridable: false,
      overrideDualApproval: false,
      enabled: true,
      description:
        "CAC registration could not be confirmed, or the registered entity does not match the applicant.",
    },
    {
      key: "false_documentation",
      label: "False or altered documentation",
      consequence: "decline",
      overridable: false,
      overrideDualApproval: false,
      enabled: true,
      description: "A document was found to be forged, altered or belonging to another entity.",
    },
    {
      key: "missing_consent",
      label: "Required authorisation missing",
      consequence: "blocked",
      overridable: false,
      overrideDualApproval: false,
      enabled: true,
      description:
        "A mandatory consent — verification, credit check, monitoring, employee-data lawfulness — has not been granted. Processing without it is unlawful.",
    },
    {
      key: "insolvency_proceedings",
      label: "Active insolvency or winding-up proceedings",
      consequence: "decline",
      overridable: false,
      overrideDualApproval: false,
      enabled: true,
      description: "The company is in liquidation, receivership or subject to a winding-up petition.",
    },
    {
      key: "unresolved_fraud_flag",
      label: "Unresolved fraud flag",
      consequence: "blocked",
      overridable: true,
      overrideRole: "super_admin",
      overrideDualApproval: true,
      enabled: true,
      description:
        "An open fraud investigation or flag. Overridable only once resolved and documented, by a Super Admin with a second authoriser.",
    },
    {
      key: "undisclosed_borrowing",
      label: "Material undisclosed borrowing",
      consequence: "committee_referral",
      overridable: true,
      overrideRole: "credit_committee",
      overrideDualApproval: true,
      enabled: true,
      description:
        "Bureau or bank evidence shows obligations the employer did not declare. Goes to the Credit Committee because the issue is candour, not arithmetic.",
    },
    {
      key: "repeated_salary_non_payment",
      label: "Repeated salary non-payment",
      consequence: "decline",
      overridable: true,
      overrideRole: "credit_committee",
      overrideDualApproval: true,
      enabled: true,
      description: "Two or more missed payroll cycles in the observed history.",
    },
    {
      key: "payroll_bank_inconsistent",
      label: "Payroll data inconsistent with bank evidence",
      consequence: "enhanced_due_diligence",
      overridable: true,
      overrideRole: "head_of_risk",
      overrideDualApproval: false,
      enabled: true,
      description:
        "A payroll file claims payments the bank statement does not show. Requires reconciliation before any limit is set.",
    },
    {
      key: "prohibited_industry",
      label: "Prohibited industry",
      consequence: "blocked",
      overridable: true,
      overrideRole: "super_admin",
      overrideDualApproval: true,
      enabled: true,
      description: "The employer operates in a sector PayBridge policy excludes.",
    },
    {
      key: "regulatory_status_unacceptable",
      label: "Unacceptable regulatory status",
      consequence: "enhanced_due_diligence",
      overridable: true,
      overrideRole: "head_of_risk",
      overrideDualApproval: false,
      enabled: true,
      description: "A licence required to operate is expired, suspended or unverifiable.",
    },
    {
      key: "materially_adverse_bureau",
      label: "Materially adverse credit bureau record",
      consequence: "committee_referral",
      overridable: true,
      overrideRole: "credit_committee",
      overrideDualApproval: true,
      enabled: true,
      description: "Bureau data shows serious delinquency or a written-off facility.",
    },
    {
      key: "insufficient_payroll_history",
      label: "Insufficient payroll history",
      consequence: "enhanced_due_diligence",
      overridable: true,
      overrideRole: "head_of_risk",
      overrideDualApproval: false,
      enabled: true,
      description:
        "Fewer verified payroll cycles than policy requires. Overridable for a pilot at a reduced limit.",
    },
    {
      key: "compliance_clearance_missing",
      label: "Compliance clearance not granted",
      consequence: "blocked",
      overridable: false,
      overrideDualApproval: false,
      enabled: true,
      description:
        "A Compliance Officer has not cleared the employer. Credit staff cannot clear compliance for themselves.",
    },
  ],

  limitRules: {
    A: {
      ewaAvailabilityPercent: 50,
      bufferPayrollMultiple: 1,
      financingPayrollMultiple: 1.5,
      employeeCapPercentOfNet: 50,
      cycleCapPercentOfPayroll: 50,
      maxTenorDays: 60,
      pricingTier: "preferred",
      monitoringFrequency: "monthly",
      securityRequired: [],
      reserveRequired: ["Direct debit mandate on the payroll account"],
      requiresCommittee: false,
      pilotOnly: false,
    },
    B: {
      ewaAvailabilityPercent: 40,
      bufferPayrollMultiple: 0.75,
      financingPayrollMultiple: 1,
      employeeCapPercentOfNet: 40,
      cycleCapPercentOfPayroll: 40,
      maxTenorDays: 45,
      pricingTier: "standard",
      monitoringFrequency: "monthly",
      securityRequired: [],
      reserveRequired: ["Direct debit mandate on the payroll account"],
      requiresCommittee: false,
      pilotOnly: false,
    },
    C: {
      ewaAvailabilityPercent: 28,
      bufferPayrollMultiple: 0.4,
      financingPayrollMultiple: 0.5,
      employeeCapPercentOfNet: 30,
      cycleCapPercentOfPayroll: 30,
      maxTenorDays: 30,
      pricingTier: "enhanced",
      monitoringFrequency: "per_cycle",
      securityRequired: ["Corporate guarantee", "Director personal guarantee"],
      reserveRequired: [
        "Direct debit mandate on the payroll account",
        "Cash reserve equal to one month of programme utilisation",
      ],
      requiresCommittee: false,
      pilotOnly: false,
    },
    D: {
      ewaAvailabilityPercent: 15,
      /* No unsecured payroll buffer at Tier D — the product is withdrawn, not
       * priced higher. A multiple of 0 is how the engine expresses that. */
      bufferPayrollMultiple: 0,
      financingPayrollMultiple: 0,
      employeeCapPercentOfNet: 20,
      cycleCapPercentOfPayroll: 20,
      maxTenorDays: 21,
      pricingTier: "pilot",
      monitoringFrequency: "per_cycle",
      securityRequired: ["Corporate guarantee", "Director personal guarantee"],
      reserveRequired: ["Employer-funded or employee-funded model only"],
      requiresCommittee: true,
      pilotOnly: true,
    },
    E: {
      ewaAvailabilityPercent: 0,
      bufferPayrollMultiple: 0,
      financingPayrollMultiple: 0,
      employeeCapPercentOfNet: 0,
      cycleCapPercentOfPayroll: 0,
      maxTenorDays: 0,
      pricingTier: "not_offered",
      monitoringFrequency: "per_cycle",
      securityRequired: [],
      reserveRequired: [],
      requiresCommittee: true,
      pilotOnly: true,
    },
  },

  portfolioCaps: {
    singleEmployerPercentOfBook: 10,
    singleIndustryPercentOfBook: 30,
    minPayrollMonths: 6,
    minFinancialMonths: 6,
    minTenureMonthsForIncrease: 3,
    increaseDualApprovalPercent: 25,
  },

  /*
   * Thresholds start NULL — unconfigured, meaning zero authority. See the
   * comment on authorityRuleSchema.maxExposure: this is the deny-by-default
   * position, and it is why a fresh deployment refers every approval to the
   * Credit Committee until a Super Admin configures real figures.
   */
  authorityMatrix: [
    { level: "credit_administrator", maxExposure: null, dualApproval: false, quorum: 0, requiredMajority: 0 },
    { level: "head_of_risk", maxExposure: null, dualApproval: false, quorum: 0, requiredMajority: 0 },
    { level: "managing_director", maxExposure: null, dualApproval: true, quorum: 0, requiredMajority: 0 },
    { level: "credit_committee", maxExposure: null, dualApproval: true, quorum: 3, requiredMajority: 2 },
    { level: "board", maxExposure: null, dualApproval: true, quorum: 5, requiredMajority: 3 },
  ],

  dualApprovalTriggers: {
    policyException: true,
    knockoutOverride: true,
    connectedParty: true,
    adverseComplianceFinding: true,
    limitIncreaseAbovePercent: 25,
  },
};

/* ------------------------------------------------------------------ HELPERS */

export type Classification =
  | "strong"
  | "acceptable"
  | "watch"
  | "weak"
  | "critical"
  | "insufficient_data";

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  strong: "Strong",
  acceptable: "Acceptable",
  watch: "Watch",
  weak: "Weak",
  critical: "Critical",
  insufficient_data: "Insufficient data",
};

/**
 * Classify one value against one benchmark, and score it 0–100.
 *
 * ONE function for every metric in the system. The alternative — a bespoke
 * comparison per metric — is where thresholds drift out of step with the
 * published policy, because nine of the ten places get updated.
 *
 * The score interpolates WITHIN the band rather than returning a band midpoint,
 * so an employer who improves from the bottom of "acceptable" to the top of it
 * sees the score move. A step function would tell them their improvement was
 * worth nothing, which is both wrong and a disincentive.
 */
export function classify(
  value: number | null | undefined,
  benchmark: Benchmark | undefined,
): { classification: Classification; score: number | null } {
  if (value === null || value === undefined || !Number.isFinite(value) || !benchmark) {
    return { classification: "insufficient_data", score: null };
  }

  const { direction, strong, acceptable, watch, weak } = benchmark;
  const higher = direction === "higher_is_better";

  /** Is `v` at least as good as `bound`? */
  const meets = (v: number, bound: number) => (higher ? v >= bound : v <= bound);

  /**
   * Where does `value` sit between two bounds, 0–1? Guarded against a zero
   * span, which happens whenever a policy sets two adjacent bounds equal (the
   * `returned_payment_rate` strong/acceptable pair, for instance).
   */
  const within = (from: number, to: number) => {
    const span = to - from;
    if (Math.abs(span) < Number.EPSILON) return 1;
    const t = (value - from) / span;
    return Math.min(1, Math.max(0, t));
  };

  if (meets(value, strong)) return { classification: "strong", score: 100 };
  if (meets(value, acceptable)) {
    return { classification: "acceptable", score: Math.round(78 + within(acceptable, strong) * 22) };
  }
  if (meets(value, watch)) {
    return { classification: "watch", score: Math.round(60 + within(watch, acceptable) * 18) };
  }
  if (meets(value, weak)) {
    return { classification: "weak", score: Math.round(35 + within(weak, watch) * 25) };
  }
  /*
   * Past the weak bound. Scored on how far past, floored at 0 rather than
   * clamped to a single value, so "slightly worse than weak" and "catastrophic"
   * are distinguishable in the component score.
   */
  const overshoot = higher ? (weak === 0 ? 1 : Math.max(0, value / weak)) : weak === 0 ? 0 : weak / value;
  return { classification: "critical", score: Math.round(Math.min(34, Math.max(0, overshoot * 34))) };
}

/** Format a value for display according to the benchmark's unit. */
export function formatMetric(value: number | null | undefined, unit: Benchmark["unit"]): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "ratio":
      /* Ratios below 1 read better as percentages: "payroll is 38% of revenue"
       * is immediately meaningful where "0.38x" needs translating. Above 1 the
       * multiple is the natural reading — "2.4x salary coverage". */
      return value < 1 && value > -1 ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(2)}x`;
    case "months":
      return `${value.toFixed(1)} months`;
    case "days":
      return `${value.toFixed(1)} days`;
    case "count":
      return `${Math.round(value)}`;
    case "currency":
      return formatNaira(value);
  }
}

/** Naira, in the compact form a credit paper actually uses. */
export function formatNaira(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `₦${(value / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `₦${(value / 1_000).toFixed(1)}k`;
  return `₦${value.toFixed(0)}`;
}

/** Which tier a total score falls in, per the policy's bands. */
export function tierFor(total: number | null, policy: CreditPolicy): Tier | null {
  if (total === null || !Number.isFinite(total)) return null;
  const band = policy.tiers.find((t) => total >= t.min && total <= t.max);
  /*
   * No matching band means the policy's bands do not cover 0–100 — a
   * misconfiguration. Fall to the worst tier rather than returning null: an
   * unclassifiable employer must not read as "no risk concern".
   */
  return band?.tier ?? "E";
}

/** Effective weights for an industry, after any configured adjustment. */
export function weightsForIndustry(policy: CreditPolicy, industry: string | null): ScoreWeights {
  const adjustments = industry ? policy.industryOverrides?.[industry]?.weightAdjustments : undefined;
  if (!adjustments) return policy.weights;

  const adjusted = { ...policy.weights } as Record<ScoreComponentKey, number>;
  for (const key of SCORE_COMPONENTS) {
    adjusted[key] = Math.max(0, (adjusted[key] ?? 0) + (adjustments[key] ?? 0));
  }

  /*
   * Renormalise to 100. An industry adjustment that broke the total would make
   * that industry's scores incomparable with the rest of the portfolio — the
   * exact failure the weight schema exists to prevent, arriving by a side door.
   */
  const total = Object.values(adjusted).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return policy.weights;
  for (const key of SCORE_COMPONENTS) {
    adjusted[key] = (adjusted[key] / total) * 100;
  }
  return adjusted as ScoreWeights;
}

/** Benchmark for a metric, honouring an industry override. */
export function benchmarkFor(
  policy: CreditPolicy,
  metric: string,
  industry: string | null,
): Benchmark | undefined {
  const override = industry ? policy.industryOverrides?.[industry]?.benchmarkOverrides?.[metric] : undefined;
  return override ?? policy.benchmarks[metric];
}
