/**
 * LIMIT ENGINE — deterministic, no AI.
 *
 * Turns a tier into a set of RECOMMENDED limits. Recommended is the operative
 * word: this module never sets a live limit. It produces a recommendation with
 * its full derivation attached, and a human with the right authority either
 * approves it, reduces it, or does not. Nothing in this file writes to
 * CreditLimit, and nothing in this file can be invoked by the AI service.
 *
 * TWO SEPARATE LIMITS, NEVER MERGED. The specification requires an EWA programme
 * limit and a payroll-buffer limit to be calculated separately, and they are
 * genuinely different risks:
 *
 *   EWA is employee-level drawdown against wages already earned. The employer's
 *   role is to withhold and remit at the pay date. Exposure self-liquidates each
 *   cycle and the practical ceiling is a share of accrued payroll.
 *
 *   The payroll buffer is direct employer credit — PayBridge funds a shortfall.
 *   The exposure is the employer's, it does not self-liquidate from wages
 *   already worked for, and it is sized as a multiple of verified payroll.
 *
 * Summing them into one "credit limit" would hide the fact that one is a
 * collection mechanic and the other is a loan. They are reported as one total for
 * exposure and concentration purposes ONLY, and that total is labelled.
 *
 * NO HARD-CODED MONEY. Every figure below derives from verified monthly payroll
 * multiplied by a policy percentage or multiple. There is not a naira amount in
 * this file, which is what the specification requires and also what makes the
 * engine work unchanged in another currency.
 */

import {
  type CreditProduct,
  type CreditPolicy,
  type Tier,
  type TierLimitRule,
  formatNaira,
} from "./policy";

/* ------------------------------------------------------------------- INPUTS */

export interface LimitInput {
  tier: Tier;
  totalScore: number;

  /** Verified average monthly payroll value. The base of every calculation. */
  verifiedMonthlyPayroll: number | null;
  /** Verified employee count on the most recent cycle. */
  verifiedEmployeeCount: number | null;
  /** Cycles of verified payroll history. */
  verifiedPayrollMonths: number;
  /** Months of verified bank or financial data. */
  verifiedFinancialMonths: number;

  /** Products the employer actually asked for. */
  requestedProducts: CreditProduct[];
  /** Amount the employer requested, where they named one. */
  requestedAmount: number | null;

  /* Capacity signals from the financial module, used to cap rather than to score. */
  averageMonthlyNetSurplus: number | null;
  lowestClosingBalance: number | null;
  cashReserveMonths: number | null;

  /* Portfolio state, supplied by the decision service. */
  totalApprovedBook: number | null;
  existingExposureToEmployer: number;
  existingExposureToIndustry: number;

  /* Findings that constrain the recommendation. */
  enhancedDueDiligenceRequired: boolean;
  committeeReferralRequired: boolean;
  blocked: boolean;
  declineMandated: boolean;
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface LimitStep {
  step: string;
  formula: string;
  value: number | null;
  displayValue: string;
  /** True where this step is the one that determined the final figure. */
  binding: boolean;
}

export interface ProductRecommendation {
  product: CreditProduct;
  offered: boolean;
  /** Null where the product is not offered at this tier. */
  recommendedLimit: number | null;
  displayLimit: string;
  /** EWA only: share of accrued earnings released. */
  availabilityPercent: number | null;
  /** EWA only: per-employee cap as a share of monthly net pay. */
  employeeCapPercentOfNet: number | null;
  /** EWA only: aggregate cap per payroll cycle. */
  cycleCap: number | null;
  maxTenorDays: number;
  steps: LimitStep[];
  reason: string;
  conditions: string[];
}

export interface LimitResult {
  tier: Tier;
  /** Null where no limit can be recommended at all. */
  totalRecommendedExposure: number | null;
  displayTotal: string;
  products: ProductRecommendation[];
  pricingTier: string;
  monitoringFrequency: string;
  securityRequired: string[];
  reserveRequired: string[];
  requiresCommittee: boolean;
  pilotOnly: boolean;
  /** Set where the engine recommends nothing. */
  noLimitReason: string | null;
  /** Portfolio caps that bound the figure. */
  portfolioConstraints: string[];
  conditions: string[];
  explanation: string;
}

/* ------------------------------------------------------------------ HELPERS */

function ruleFor(policy: CreditPolicy, tier: Tier): TierLimitRule | null {
  return policy.limitRules[tier] ?? null;
}

/** The smallest positive cap wins, and we record which one bound. */
function bindLowest(steps: LimitStep[]): number | null {
  const candidates = steps.filter((s) => s.value !== null) as (LimitStep & { value: number })[];
  if (candidates.length === 0) return null;
  const lowest = candidates.reduce((min, s) => (s.value < min.value ? s : min));
  for (const s of steps) s.binding = s === lowest;
  return Math.max(0, lowest.value);
}

/** Round down to a clean figure so limits do not read as spurious precision. */
function roundDown(value: number): number {
  if (value <= 0) return 0;
  /*
   * Granularity scales with size: a ₦180,000 limit rounded to the nearest
   * ₦100,000 would lose a third of itself, and a ₦48,375,912 limit expressed to
   * the naira implies a precision the inputs do not support.
   */
  const step = value >= 10_000_000 ? 500_000 : value >= 1_000_000 ? 100_000 : value >= 100_000 ? 10_000 : 1_000;
  return Math.floor(value / step) * step;
}

/* --------------------------------------------------------------- THE ENGINE */

export function recommendLimits(input: LimitInput, policy: CreditPolicy): LimitResult {
  const rule = ruleFor(policy, input.tier);
  const caps = policy.portfolioCaps;
  const conditions: string[] = [];
  const portfolioConstraints: string[] = [];

  const empty = (reason: string): LimitResult => ({
    tier: input.tier,
    totalRecommendedExposure: null,
    displayTotal: "—",
    products: [],
    pricingTier: rule?.pricingTier ?? "not_applicable",
    monitoringFrequency: rule?.monitoringFrequency ?? "monthly",
    securityRequired: rule?.securityRequired ?? [],
    reserveRequired: rule?.reserveRequired ?? [],
    requiresCommittee: rule?.requiresCommittee ?? true,
    pilotOnly: rule?.pilotOnly ?? false,
    noLimitReason: reason,
    portfolioConstraints,
    conditions,
    explanation: reason,
  });

  /* --- Gates that stop the calculation entirely. -------------------------- */

  if (input.blocked) {
    return empty(
      "A blocking knockout rule is in force. No limit may be calculated until it is resolved — this is not a pricing question.",
    );
  }
  if (input.declineMandated) {
    return empty("A knockout rule mandates decline. No limit is recommended.");
  }
  if (rule === null) {
    return empty(`No limit rule is configured for tier ${input.tier} in policy ${policy.version}.`);
  }
  if (input.tier === "E") {
    return empty(
      "Tier E is below PayBridge's minimum acceptable score. No credit product is offered; non-credit products (savings, wellness) may still be discussed.",
    );
  }

  const payroll = input.verifiedMonthlyPayroll;
  if (payroll === null || payroll <= 0) {
    return empty(
      "No verified monthly payroll value. Every limit in this engine derives from verified payroll, so no figure can be recommended until payroll data is loaded and reconciled.",
    );
  }

  if (input.verifiedPayrollMonths < caps.minPayrollMonths) {
    /*
     * Not an empty result — a knockout has already flagged this and a Head of
     * Risk may sanction a pilot. The engine still produces a figure, but it is
     * explicitly conditioned.
     */
    conditions.push(
      `Only ${input.verifiedPayrollMonths} of the required ${caps.minPayrollMonths} verified payroll cycles are available. Any approval is a pilot and must be reviewed after ${caps.minPayrollMonths} cycles.`,
    );
  }
  if (input.verifiedFinancialMonths < caps.minFinancialMonths) {
    conditions.push(
      `Only ${input.verifiedFinancialMonths} of the required ${caps.minFinancialMonths} months of bank or financial data are verified. Limits are constrained until the full period is supplied.`,
    );
  }

  /* --- Portfolio ceilings, applied to every product. --------------------- */

  const book = input.totalApprovedBook;
  const employerCeiling =
    book !== null && book > 0
      ? Math.max(0, (book * caps.singleEmployerPercentOfBook) / 100 - input.existingExposureToEmployer)
      : null;
  const industryCeiling =
    book !== null && book > 0
      ? Math.max(0, (book * caps.singleIndustryPercentOfBook) / 100 - input.existingExposureToIndustry)
      : null;

  const employerCapNote =
    employerCeiling === null
      ? ""
      : `Single-employer cap: ${caps.singleEmployerPercentOfBook}% of the approved book leaves ${formatNaira(employerCeiling)} of headroom for this employer.`;
  const industryCapNote =
    industryCeiling === null
      ? ""
      : `Single-industry cap: ${caps.singleIndustryPercentOfBook}% of the approved book leaves ${formatNaira(industryCeiling)} of headroom in this sector.`;

  if (employerCapNote) portfolioConstraints.push(employerCapNote);
  if (industryCapNote) portfolioConstraints.push(industryCapNote);

  const products: ProductRecommendation[] = [];
  const wants = (p: CreditProduct) => input.requestedProducts.includes(p);

  /* ------------------------------------------------------ EWA PROGRAMME --- */

  if (wants("ewa")) {
    const steps: LimitStep[] = [];
    const push = (step: string, formula: string, value: number | null) =>
      steps.push({ step, formula, value, displayValue: formatNaira(value), binding: false });

    /*
     * The programme limit is the maximum PayBridge is exposed to at any point in
     * a cycle, which is the share of accrued wages released — not annual payroll.
     */
    const availability = (payroll * rule.ewaAvailabilityPercent) / 100;
    push(
      `Tier ${input.tier} availability`,
      `Verified monthly payroll ${formatNaira(payroll)} × ${rule.ewaAvailabilityPercent}% availability`,
      availability,
    );

    const cycleCap = (payroll * rule.cycleCapPercentOfPayroll) / 100;
    push(
      "Per-cycle aggregate cap",
      `Verified monthly payroll ${formatNaira(payroll)} × ${rule.cycleCapPercentOfPayroll}% cycle cap`,
      cycleCap,
    );

    /*
     * The lowest observed closing balance matters for EWA because the employer
     * must be able to withhold and remit at the pay date. An employer whose
     * account routinely bottoms out below the amount they will owe us is a
     * settlement risk even if their averages look comfortable.
     */
    if (input.lowestClosingBalance !== null && input.lowestClosingBalance > 0) {
      push(
        "Settlement capacity at the trough",
        `Lowest observed closing balance ${formatNaira(input.lowestClosingBalance)} × 150% remittance headroom`,
        input.lowestClosingBalance * 1.5,
      );
    }

    if (employerCeiling !== null) push("Single-employer portfolio cap", employerCapNote, employerCeiling);
    if (industryCeiling !== null) push("Single-industry portfolio cap", industryCapNote, industryCeiling);

    const bound = bindLowest(steps);
    const limit = bound === null ? null : roundDown(bound);

    const productConditions: string[] = [
      `Employee drawdown capped at ${rule.employeeCapPercentOfNet}% of each employee's monthly net pay.`,
      `Aggregate drawdown capped at ${formatNaira(roundDown(cycleCap))} per payroll cycle.`,
      "Employer must operate a withhold-and-remit instruction against the verified settlement account.",
    ];
    if (rule.pilotOnly) {
      productConditions.push(
        "At this tier the programme is permitted on an employee-funded or pilot basis only, with no unsecured PayBridge exposure.",
      );
    }

    products.push({
      product: "ewa",
      offered: limit !== null && limit > 0,
      recommendedLimit: limit,
      displayLimit: formatNaira(limit),
      availabilityPercent: rule.ewaAvailabilityPercent,
      employeeCapPercentOfNet: rule.employeeCapPercentOfNet,
      cycleCap: roundDown(cycleCap),
      maxTenorDays: rule.maxTenorDays,
      steps,
      reason:
        limit !== null && limit > 0
          ? `Tier ${input.tier} releases up to ${rule.ewaAvailabilityPercent}% of accrued earnings. The binding constraint is "${steps.find((s) => s.binding)?.step}".`
          : "No earned-wage access limit can be recommended on the verified data available.",
      conditions: productConditions,
    });
  }

  /* ------------------------------------------------------ PAYROLL BUFFER -- */

  if (wants("payroll_buffer")) {
    const steps: LimitStep[] = [];
    const push = (step: string, formula: string, value: number | null) =>
      steps.push({ step, formula, value, displayValue: formatNaira(value), binding: false });

    if (rule.bufferPayrollMultiple <= 0) {
      products.push({
        product: "payroll_buffer",
        offered: false,
        recommendedLimit: null,
        displayLimit: "Not offered",
        availabilityPercent: null,
        employeeCapPercentOfNet: null,
        cycleCap: null,
        maxTenorDays: 0,
        steps,
        reason: `The payroll buffer is not offered at tier ${input.tier}. At this level of assessed risk the product is withdrawn rather than repriced — an employer who cannot reliably fund payroll should not be lent the payroll.`,
        conditions: [],
      });
    } else {
      const ceiling = payroll * rule.bufferPayrollMultiple;
      push(
        `Tier ${input.tier} buffer multiple`,
        `Verified monthly payroll ${formatNaira(payroll)} × ${rule.bufferPayrollMultiple} months`,
        ceiling,
      );

      /*
       * Unlike EWA, the buffer must be repaid from the employer's own surplus.
       * Sizing it above demonstrated surplus creates a facility that can only be
       * repaid by another facility, which is how a buffer becomes a term loan
       * nobody underwrote.
       */
      if (input.averageMonthlyNetSurplus !== null && input.averageMonthlyNetSurplus > 0) {
        push(
          "Demonstrated repayment surplus",
          `Average monthly net surplus ${formatNaira(input.averageMonthlyNetSurplus)} × 3 cycles`,
          input.averageMonthlyNetSurplus * 3,
        );
      } else if (input.averageMonthlyNetSurplus !== null) {
        push(
          "Demonstrated repayment surplus",
          "Average monthly net surplus is zero or negative — no repayment capacity is demonstrated",
          0,
        );
      }

      if (employerCeiling !== null) push("Single-employer portfolio cap", employerCapNote, employerCeiling);
      if (industryCeiling !== null) push("Single-industry portfolio cap", industryCapNote, industryCeiling);

      const bound = bindLowest(steps);
      const limit = bound === null ? null : roundDown(bound);

      const productConditions: string[] = [
        `Maximum tenor ${rule.maxTenorDays} days, repayable from the next payroll cycle.`,
      ];
      if (rule.securityRequired.length > 0) {
        productConditions.push(`Security required: ${rule.securityRequired.join("; ")}.`);
      }
      if (rule.reserveRequired.length > 0) {
        productConditions.push(`Reserve required: ${rule.reserveRequired.join("; ")}.`);
      }

      products.push({
        product: "payroll_buffer",
        offered: limit !== null && limit > 0,
        recommendedLimit: limit,
        displayLimit: formatNaira(limit),
        availabilityPercent: null,
        employeeCapPercentOfNet: null,
        cycleCap: null,
        maxTenorDays: rule.maxTenorDays,
        steps,
        reason:
          limit !== null && limit > 0
            ? `Tier ${input.tier} permits up to ${rule.bufferPayrollMultiple}× verified monthly payroll. The binding constraint is "${steps.find((s) => s.binding)?.step}".`
            : "No payroll buffer is recommended: the calculation binds at zero, most likely because no repayment surplus is demonstrated.",
        conditions: productConditions,
      });
    }
  }

  /* -------------------------------------------------- PAYROLL FINANCING --- */

  if (wants("payroll_financing")) {
    const steps: LimitStep[] = [];
    const push = (step: string, formula: string, value: number | null) =>
      steps.push({ step, formula, value, displayValue: formatNaira(value), binding: false });

    if (rule.financingPayrollMultiple <= 0) {
      products.push({
        product: "payroll_financing",
        offered: false,
        recommendedLimit: null,
        displayLimit: "Not offered",
        availabilityPercent: null,
        employeeCapPercentOfNet: null,
        cycleCap: null,
        maxTenorDays: 0,
        steps,
        reason: `Payroll financing is not offered at tier ${input.tier}.`,
        conditions: [],
      });
    } else {
      const ceiling = payroll * rule.financingPayrollMultiple;
      push(
        `Tier ${input.tier} financing multiple`,
        `Verified monthly payroll ${formatNaira(payroll)} × ${rule.financingPayrollMultiple} months`,
        ceiling,
      );

      if (input.averageMonthlyNetSurplus !== null) {
        push(
          "Demonstrated repayment surplus",
          `Average monthly net surplus ${formatNaira(input.averageMonthlyNetSurplus)} × 4 cycles`,
          Math.max(0, input.averageMonthlyNetSurplus * 4),
        );
      }
      if (input.cashReserveMonths !== null && input.cashReserveMonths < 1) {
        /*
         * Financing is the longest-dated of the three products. An employer
         * holding under a month of reserves has no capacity to absorb a shock
         * during the tenor, so the facility is halved rather than declined
         * outright — the reduction is the recommendation, and the reason travels
         * with it.
         */
        push(
          "Thin reserve adjustment",
          `Cash reserves of ${input.cashReserveMonths.toFixed(2)} months are below one month, so the tier ceiling is halved`,
          ceiling / 2,
        );
      }
      if (employerCeiling !== null) push("Single-employer portfolio cap", employerCapNote, employerCeiling);
      if (industryCeiling !== null) push("Single-industry portfolio cap", industryCapNote, industryCeiling);

      const bound = bindLowest(steps);
      const limit = bound === null ? null : roundDown(bound);

      products.push({
        product: "payroll_financing",
        offered: limit !== null && limit > 0,
        recommendedLimit: limit,
        displayLimit: formatNaira(limit),
        availabilityPercent: null,
        employeeCapPercentOfNet: null,
        cycleCap: null,
        maxTenorDays: rule.maxTenorDays,
        steps,
        reason:
          limit !== null && limit > 0
            ? `Tier ${input.tier} permits up to ${rule.financingPayrollMultiple}× verified monthly payroll. The binding constraint is "${steps.find((s) => s.binding)?.step}".`
            : "No payroll financing is recommended on the verified data available.",
        conditions: [],
      });
    }
  }

  /* ------------------------------------------------------------ Assembly --- */

  const offered = products.filter((p) => p.offered && p.recommendedLimit !== null);
  /*
   * Total exposure sums EWA and the employer facilities because that is the
   * figure the authority matrix and the concentration caps are measured against.
   * It is presented as "total exposure", never as a single credit limit.
   */
  const totalRecommendedExposure =
    offered.length > 0 ? offered.reduce((sum, p) => sum + (p.recommendedLimit as number), 0) : null;

  if (input.enhancedDueDiligenceRequired) {
    conditions.push("Enhanced due diligence must be completed and documented before any limit becomes available.");
  }
  if (input.committeeReferralRequired || rule.requiresCommittee) {
    conditions.push("Credit Committee approval is required irrespective of the recommended amount.");
  }
  if (rule.pilotOnly) {
    conditions.push(
      `Tier ${input.tier} is restricted to a pilot or employee-funded structure. No unsecured payroll buffer is permitted.`,
    );
  }
  if (
    input.requestedAmount !== null &&
    totalRecommendedExposure !== null &&
    input.requestedAmount > totalRecommendedExposure
  ) {
    conditions.push(
      `The employer requested ${formatNaira(input.requestedAmount)}; the engine supports ${formatNaira(totalRecommendedExposure)}. The shortfall must be discussed with the employer before approval.`,
    );
  }

  const explanation =
    totalRecommendedExposure === null
      ? "No limit is recommended on the verified data and policy settings in force."
      : `Tier ${input.tier} under policy ${policy.version}, calculated from verified monthly payroll of ${formatNaira(payroll)}${input.verifiedEmployeeCount ? ` across ${input.verifiedEmployeeCount} employees` : ""}. Total recommended exposure ${formatNaira(totalRecommendedExposure)} across ${offered.length} product${offered.length === 1 ? "" : "s"}, pricing ${rule.pricingTier}, monitoring ${rule.monitoringFrequency}.`;

  return {
    tier: input.tier,
    totalRecommendedExposure,
    displayTotal: formatNaira(totalRecommendedExposure),
    products,
    pricingTier: rule.pricingTier,
    monitoringFrequency: rule.monitoringFrequency,
    securityRequired: rule.securityRequired,
    reserveRequired: rule.reserveRequired,
    requiresCommittee: rule.requiresCommittee || input.committeeReferralRequired,
    pilotOnly: rule.pilotOnly,
    noLimitReason: null,
    portfolioConstraints,
    conditions,
    explanation,
  };
}

/* ------------------------------------------------------- AUTHORITY MATRIX */

export interface AuthorityDecision {
  /** The lowest level that may approve this exposure. */
  requiredLevel: string | null;
  requiredLevelLabel: string;
  dualApprovalRequired: boolean;
  dualApprovalReasons: string[];
  quorum: number;
  requiredMajority: number;
  /** True where no configured level can approve the amount. */
  exceedsAllAuthorities: boolean;
  explanation: string;
}

export interface AuthorityContext {
  exposure: number;
  isPolicyException: boolean;
  hasKnockoutOverride: boolean;
  isConnectedParty: boolean;
  hasAdverseComplianceFinding: boolean;
  /** Percentage increase over the employer's existing limit, where applicable. */
  limitIncreasePercent: number | null;
  committeeReferralRequired: boolean;
}

/**
 * Which authority level must sign, and whether a second authoriser is needed.
 *
 * Levels with `maxExposure: null` are skipped, not treated as unlimited. A fresh
 * deployment with nothing configured therefore refers everything to the highest
 * configured level — or reports that nothing can approve it — instead of silently
 * letting a Credit Administrator approve any amount.
 */
export function resolveAuthority(ctx: AuthorityContext, policy: CreditPolicy): AuthorityDecision {
  const triggers = policy.dualApprovalTriggers;
  const dualApprovalReasons: string[] = [];

  if (ctx.isPolicyException && triggers.policyException) dualApprovalReasons.push("Policy exception");
  if (ctx.hasKnockoutOverride && triggers.knockoutOverride) dualApprovalReasons.push("Knockout rule override");
  if (ctx.isConnectedParty && triggers.connectedParty) dualApprovalReasons.push("Connected party");
  if (ctx.hasAdverseComplianceFinding && triggers.adverseComplianceFinding) {
    dualApprovalReasons.push("Adverse compliance finding");
  }
  if (
    ctx.limitIncreasePercent !== null &&
    ctx.limitIncreasePercent > triggers.limitIncreaseAbovePercent
  ) {
    dualApprovalReasons.push(
      `Limit increase of ${Math.round(ctx.limitIncreasePercent)}% exceeds the ${triggers.limitIncreaseAbovePercent}% threshold`,
    );
  }

  const configured = policy.authorityMatrix
    .filter((a) => a.maxExposure !== null)
    .sort((a, b) => (a.maxExposure as number) - (b.maxExposure as number));

  const committee = policy.authorityMatrix.find((a) => a.level === "credit_committee");

  if (ctx.committeeReferralRequired && committee) {
    return {
      requiredLevel: "credit_committee",
      requiredLevelLabel: "Credit Committee",
      dualApprovalRequired: true,
      dualApprovalReasons: dualApprovalReasons.length > 0 ? dualApprovalReasons : ["Mandatory committee referral"],
      quorum: committee.quorum,
      requiredMajority: committee.requiredMajority,
      exceedsAllAuthorities: false,
      explanation:
        "A knockout rule or tier setting requires Credit Committee referral. The exposure amount does not reduce that requirement.",
    };
  }

  const match = configured.find((a) => ctx.exposure <= (a.maxExposure as number));

  if (!match) {
    const highest = configured.at(-1);
    return {
      requiredLevel: highest?.level ?? null,
      requiredLevelLabel: highest ? highest.level : "None configured",
      dualApprovalRequired: true,
      dualApprovalReasons:
        dualApprovalReasons.length > 0 ? dualApprovalReasons : ["Exposure exceeds every configured approval authority"],
      quorum: highest?.quorum ?? 0,
      requiredMajority: highest?.requiredMajority ?? 0,
      exceedsAllAuthorities: true,
      explanation:
        configured.length === 0
          ? "No approval authorities have been configured. A Super Administrator must set thresholds on the Credit Authority screen before any approval can be recorded."
          : `Exposure of ${formatNaira(ctx.exposure)} exceeds every configured authority. Board sanction or a policy change is required.`,
    };
  }

  const dualApprovalRequired = match.dualApproval || dualApprovalReasons.length > 0;
  if (match.dualApproval && dualApprovalReasons.length === 0) {
    dualApprovalReasons.push(`All approvals at ${match.level} require a second authoriser`);
  }

  return {
    requiredLevel: match.level,
    requiredLevelLabel: match.level,
    dualApprovalRequired,
    dualApprovalReasons,
    quorum: match.quorum,
    requiredMajority: match.requiredMajority,
    exceedsAllAuthorities: false,
    explanation: `Exposure of ${formatNaira(ctx.exposure)} falls within the ${formatNaira(match.maxExposure)} authority of ${match.level}${dualApprovalRequired ? ", with a second authoriser required" : ""}.`,
  };
}
