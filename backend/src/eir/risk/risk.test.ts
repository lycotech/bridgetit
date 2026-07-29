/**
 * RISK ENGINE TESTS.
 *
 * These cover the properties the specification makes non-negotiable, not just
 * "the function returns a number":
 *
 *   - weights must total 100 or the policy is rejected
 *   - a strong employer reaches tier A, a distressed one does not
 *   - a sanctions match blocks regardless of how good the score is
 *   - a non-overridable knockout cannot be overridden by anyone, at any level
 *   - no limit is produced while a blocking rule stands
 *   - every limit derives from verified payroll, never from a constant
 *   - unconfigured approval authority means ZERO authority, not unlimited
 *   - unverified negative news cannot move a score
 *   - the workflow refuses approval while a blocker stands
 *   - the monitoring level follows the worst alert, not the average
 */

import { describe, expect, test } from "vitest";

import { assessBehaviouralTrust, type BehaviouralInput } from "./behavioural";
import { assessCompliance, type ComplianceInput } from "./compliance";
import { type FinancialInput, type PeriodInput } from "./financial";
import { type CycleInput, type PayrollInput, assessPayrollReliability, deriveNormalPayDay } from "./payroll";
import { evaluateKnockouts, overridePermitted } from "./knockouts";
import { recommendLimits, resolveAuthority } from "./limits";
import { runMonitoring, type MonitoringInput } from "./monitoring";
import { DEFAULT_POLICY, creditPolicySchema, weightsSchema } from "./policy";
import { calculateScore, type ScoringInput } from "./score";
import { canTransition, type WorkflowContext } from "./workflow";
import { type IdentityInput } from "./identity";

/* ------------------------------------------------------------------ BUILDERS */

/** A month offset from the current month, at UTC midnight on day 1. */
function monthStart(offset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

function payDate(offset: number, day: number): Date {
  const base = monthStart(offset);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
}

function goodPeriods(count = 12, payroll = 8_000_000): PeriodInput[] {
  return Array.from({ length: count }, (_, i) => {
    const start = monthStart(-count + i);
    return {
      periodStart: start,
      source: "bank_statement",
      inflows: 30_000_000,
      outflows: 24_000_000,
      openingBalance: 20_000_000,
      closingBalance: 26_000_000,
      lowestBalance: 18_000_000,
      revenue: 30_000_000,
      costOfSales: 12_000_000,
      operatingExpenses: 10_000_000,
      operatingProfit: 8_000_000,
      payrollCost: payroll,
      debtService: 500_000,
      taxRemitted: 900_000,
      pensionRemitted: 640_000,
      returnedPayments: 0,
    } satisfies PeriodInput;
  });
}

function stressedPeriods(count = 12, payroll = 8_000_000): PeriodInput[] {
  return Array.from({ length: count }, (_, i) => ({
    periodStart: monthStart(-count + i),
    source: "bank_statement",
    inflows: 9_500_000,
    outflows: 10_200_000,
    openingBalance: 1_200_000,
    closingBalance: 400_000,
    lowestBalance: 60_000,
    revenue: 9_500_000,
    costOfSales: 5_000_000,
    operatingExpenses: 4_800_000,
    operatingProfit: -300_000,
    payrollCost: payroll,
    debtService: 1_400_000,
    taxRemitted: 0,
    pensionRemitted: 0,
    returnedPayments: 2,
  }));
}

function goodCycles(count = 12, amount = 8_000_000): CycleInput[] {
  return Array.from({ length: count }, (_, i) => {
    const offset = -count + i;
    return {
      periodStart: monthStart(offset),
      expectedPayDate: payDate(offset, 25),
      actualPayDate: payDate(offset, 25),
      totalAmount: amount,
      employeeCount: 140,
      corrections: 0,
      reversals: 0,
      paidFraction: 1,
      pensionRemittedAt: payDate(offset, 28),
      taxRemittedAt: payDate(offset, 28),
      bankEvidenceMismatch: false,
    } satisfies CycleInput;
  });
}

const cleanIdentity: IdentityInput = {
  registrationVerified: true,
  registrationProvided: true,
  registrationContradiction: false,
  registrationStatus: "ACTIVE",
  taxIdProvided: true,
  taxIdVerified: true,
  incorporationDocumentVerified: true,
  incorporationDocumentUploaded: true,
  addressProvided: true,
  addressVerified: true,
  bankAccountProvided: true,
  bankAccountNameMatch: true,
  contactEmailVerified: true,
  contactPhoneVerified: true,
  directors: [
    { name: "A Director", identityVerified: true, identityProvided: true, isSignatory: true, pepDeclared: false },
    { name: "B Director", identityVerified: true, identityProvided: true, isSignatory: true, pepDeclared: false },
  ],
  beneficialOwnersDisclosed: 2,
  ownershipDeclaredComplete: true,
  ownershipPercentageDisclosed: 100,
  businessAgeMonths: 96,
  licenceRequired: false,
  licenceVerified: false,
};

const cleanCompliance: ComplianceInput = {
  screenings: [
    { subject: "Employer Ltd", kind: "entity", sanctions: "clear", pep: "clear", screenedAt: new Date() },
    { subject: "A Director", kind: "director", sanctions: "clear", pep: "clear", screenedAt: new Date() },
  ],
  taxFilingsCurrent: true,
  taxArrearsDeclared: false,
  pensionCompliant: true,
  annualReturnsCurrent: true,
  licenceRequired: false,
  licenceCurrent: null,
  licenceExpiryDate: null,
  materialLitigationCount: 0,
  enforcementActionCount: 0,
  insolvencyProceedings: false,
  consentCurrent: true,
  consentWordingVersion: "consent-v1",
  employeeDataConsentBasis: "Contractual necessity with employee notice",
  validatedFindings: [],
  unvalidatedFindings: 0,
  amlQuestionnaireComplete: true,
};

const cleanBehavioural: BehaviouralInput = {
  relationshipMonths: 18,
  documentsRequested: 8,
  documentsProvided: 8,
  documentsRejectedForQuality: 0,
  documentsExpiredUnreplaced: 0,
  longestOpenRequestDays: null,
  averageResponseDays: 2,
  informationRequestsOutstanding: 0,
  declarationInconsistencies: 0,
  inconsistenciesResolved: 0,
  undisclosedFacts: 0,
  facilityCycles: 12,
  repaymentsOnTime: 12,
  repaymentsLate: 0,
  repaymentsMissed: 0,
  returnedPayments: 0,
  covenantBreaches: 0,
  covenantBreachesCured: 0,
  monitoringSubmissionsLate: 0,
  monitoringSubmissionsDue: 6,
  recentPortalActivity: true,
  dataConnectionInterruptions: 0,
};

function financialInput(periods: PeriodInput[], payroll = 8_000_000): FinancialInput {
  return {
    periods,
    verifiedMonthlyPayroll: payroll,
    declaredMonthlyPayroll: payroll,
    customerConcentration: 0.2,
    receivablesConcentration: 0.25,
    existingLenderExposure: 5_000_000,
    currentLiabilities: 12_000_000,
    currentAssets: 30_000_000,
    industry: "professional_services",
    pensionOnTimeCycles: 12,
    taxOnTimeCycles: 12,
    remittanceCyclesObserved: 12,
  };
}

function scoringInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  const payrollInput: PayrollInput = {
    cycles: goodCycles(),
    declaredPayDay: 25,
    industry: "professional_services",
  };
  return {
    employerId: "emp_test",
    applicationId: "app_test",
    identity: cleanIdentity,
    financial: financialInput(goodPeriods()),
    payroll: payrollInput,
    behavioural: cleanBehavioural,
    compliance: cleanCompliance,
    industry: "professional_services",
    businessAgeMonths: 96,
    governmentRevenueShare: 0,
    falseDocumentationFound: false,
    openFraudFlag: false,
    undisclosedBorrowingFound: false,
    bureauSeriousDelinquency: false,
    bureauWrittenOffFacility: false,
    complianceCleared: true,
    requestedProducts: ["ewa", "payroll_buffer"],
    requestedAmount: 10_000_000,
    totalApprovedBook: 2_000_000_000,
    existingExposureToEmployer: 0,
    existingExposureToIndustry: 0,
    ...overrides,
  };
}

/* -------------------------------------------------------------------- POLICY */

describe("credit policy", () => {
  test("the default policy validates", () => {
    expect(() => creditPolicySchema.parse(DEFAULT_POLICY)).not.toThrow();
  });

  test("weights totalling anything other than 100 are rejected", () => {
    expect(() =>
      weightsSchema.parse({ identity: 20, financial: 25, payroll: 25, behavioural: 15, compliance: 10, industry: 10 }),
    ).toThrow();
  });

  test("the specification's default weights are in force", () => {
    expect(DEFAULT_POLICY.weights).toEqual({
      identity: 15,
      financial: 25,
      payroll: 25,
      behavioural: 15,
      compliance: 10,
      industry: 10,
    });
  });

  test("every tier band in the specification is present", () => {
    const bands = DEFAULT_POLICY.tiers.map((t) => [t.tier, Math.floor(t.min)]);
    expect(bands).toEqual([
      ["A", 85],
      ["B", 75],
      ["C", 65],
      ["D", 50],
      ["E", 0],
    ]);
  });

  test("tier A EWA availability is 50% and tier D offers no unsecured buffer", () => {
    expect(DEFAULT_POLICY.limitRules.A?.ewaAvailabilityPercent).toBe(50);
    expect(DEFAULT_POLICY.limitRules.B?.ewaAvailabilityPercent).toBe(40);
    expect(DEFAULT_POLICY.limitRules.D?.bufferPayrollMultiple).toBe(0);
    expect(DEFAULT_POLICY.limitRules.D?.requiresCommittee).toBe(true);
  });
});

/* ------------------------------------------------------------------- PAYROLL */

describe("payroll reliability", () => {
  test("the normal pay day is derived from behaviour, not from the declaration", () => {
    /* Paid on the 2nd of the following month every cycle, declared as the 25th. */
    const cycles = goodCycles(6).map((c, i) => ({
      ...c,
      actualPayDate: payDate(-6 + i + 1, 2),
    }));
    expect(deriveNormalPayDay(cycles)).toBe(2);
  });

  test("a clean twelve-cycle history scores highly and reads as highly stable", () => {
    const result = assessPayrollReliability(
      { cycles: goodCycles(), declaredPayDay: 25, industry: "professional_services" },
      DEFAULT_POLICY,
    );
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.payrollClassification).toBe("highly_stable");
    expect(result.missedCycles).toBe(0);
  });

  test("two missed cycles read as materially distressed", () => {
    const cycles = goodCycles();
    cycles[3] = { ...(cycles[3] as CycleInput), actualPayDate: null };
    cycles[7] = { ...(cycles[7] as CycleInput), actualPayDate: null };
    const result = assessPayrollReliability(
      { cycles, declaredPayDay: 25, industry: "professional_services" },
      DEFAULT_POLICY,
    );
    expect(result.missedCycles).toBe(2);
    expect(result.payrollClassification).toBe("materially_distressed");
    expect(result.score).toBeLessThan(70);
  });

  test("no payroll history sits at the data-gap floor, not at zero", () => {
    const result = assessPayrollReliability(
      { cycles: [], declaredPayDay: null, industry: null },
      DEFAULT_POLICY,
    );
    expect(result.score).toBe(30);
    expect(result.dataInsufficient).toBe(true);
    expect(result.classification).toBe("insufficient_data");
  });

  test("a cycle whose pay date has not yet arrived is not counted as missed", () => {
    const future: CycleInput = {
      ...(goodCycles(1)[0] as CycleInput),
      periodStart: monthStart(1),
      expectedPayDate: payDate(1, 25),
      actualPayDate: null,
    };
    const result = assessPayrollReliability(
      { cycles: [future], declaredPayDay: 25, industry: null },
      DEFAULT_POLICY,
    );
    expect(result.missedCycles).toBe(0);
    expect(result.cycles[0]?.timeliness).toBe("unknown");
  });
});

/* ---------------------------------------------------------------- COMPLIANCE */

describe("compliance", () => {
  test("a clean file scores 100", () => {
    const result = assessCompliance(cleanCompliance);
    expect(result.score).toBe(100);
    expect(result.sanctionsConfirmed).toBe(false);
  });

  test("unverified negative news cannot move the score", () => {
    const withNews = assessCompliance({ ...cleanCompliance, unvalidatedFindings: 5 });
    expect(withNews.score).toBe(100);
    expect(withNews.unvalidatedFindingCount).toBe(5);
    expect(withNews.outstandingForAnalyst.some((s) => s.includes("Verify"))).toBe(true);
  });

  test("an analyst-validated adverse finding does move the score", () => {
    const validated = assessCompliance({
      ...cleanCompliance,
      validatedFindings: [
        { category: "regulatory", severity: "high", summary: "Confirmed regulatory penalty", validatedAt: new Date() },
      ],
    });
    expect(validated.score).toBeLessThan(100);
  });

  test("a stale screening is treated as no screening", () => {
    const old = new Date(Date.now() - 400 * 86_400_000);
    const result = assessCompliance({
      ...cleanCompliance,
      screenings: [{ subject: "Employer Ltd", kind: "entity", sanctions: "clear", pep: "clear", screenedAt: old }],
    });
    expect(result.sanctionsNotScreened).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  test("a PEP is flagged for enhanced diligence, not treated as adverse", () => {
    const result = assessCompliance({
      ...cleanCompliance,
      screenings: [
        { subject: "A Director", kind: "director", sanctions: "clear", pep: "confirmed_match", screenedAt: new Date() },
      ],
    });
    expect(result.pepPresent).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});

/* -------------------------------------------------------------- BEHAVIOURAL */

describe("behavioural trust", () => {
  test("a new employer with no record sits near neutral, not at either extreme", () => {
    const result = assessBehaviouralTrust({
      ...cleanBehavioural,
      relationshipMonths: 1,
      facilityCycles: 0,
      repaymentsOnTime: 0,
      monitoringSubmissionsDue: 0,
      documentsRequested: 0,
      documentsProvided: 0,
      averageResponseDays: null,
    });
    expect(result.score).toBeGreaterThan(45);
    expect(result.score).toBeLessThan(75);
    expect(result.limitedHistory).toBe(true);
  });

  test("non-disclosure is penalised heavily and surfaces as a factor", () => {
    const result = assessBehaviouralTrust({ ...cleanBehavioural, undisclosedFacts: 2 });
    expect(result.materialNonDisclosure).toBe(true);
    expect(result.score).toBeLessThan(60);
  });
});

/* ---------------------------------------------------------------- KNOCKOUTS */

const cleanKnockoutContext = {
  sanctionsConfirmed: false,
  sanctionsPotential: false,
  sanctionsNotScreened: false,
  consentMissing: false,
  insolvencyProceedings: false,
  licenceRequired: false,
  licenceLapsed: false,
  complianceCleared: true,
  identityUnverifiable: false,
  falseDocumentationFound: false,
  openFraudFlag: false,
  missedPayrollCycles: 0,
  payrollBankMismatchCycles: 0,
  verifiedPayrollMonths: 12,
  undisclosedBorrowingFound: false,
  bureauSeriousDelinquency: false,
  bureauWrittenOffFacility: false,
  industry: "professional_services",
  industryProhibited: false,
};

describe("knockout rules", () => {
  test("every rule is recorded, including the ones that pass", () => {
    const result = evaluateKnockouts(cleanKnockoutContext, DEFAULT_POLICY);
    expect(result.evaluations.length).toBe(DEFAULT_POLICY.knockoutRules.length);
    expect(result.triggeredCount).toBe(0);
    expect(result.blocked).toBe(false);
    for (const e of result.evaluations) expect(e.evidence.length).toBeGreaterThan(0);
  });

  test("a confirmed sanctions match blocks", () => {
    const result = evaluateKnockouts({ ...cleanKnockoutContext, sanctionsConfirmed: true }, DEFAULT_POLICY);
    expect(result.blocked).toBe(true);
    expect(result.worstConsequence).toBe("blocked");
  });

  test("a sanctions match cannot be overridden by anyone", () => {
    const rule = DEFAULT_POLICY.knockoutRules.find((r) => r.key === "sanctions_failed");
    expect(rule?.overridable).toBe(false);

    const superAdminAttempt = overridePermitted(rule!, "super_admin", true);
    expect(superAdminAttempt.permitted).toBe(false);

    /* And a forged override row stored directly in the database is not honoured. */
    const result = evaluateKnockouts({ ...cleanKnockoutContext, sanctionsConfirmed: true }, DEFAULT_POLICY, [
      {
        ruleKey: "sanctions_failed",
        approvedBy: "admin_1",
        approvedByRole: "super_admin",
        approvedAt: new Date(),
        reason: "commercial relationship",
        secondApproverId: "admin_2",
      },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.overriddenCount).toBe(0);
    expect(result.evaluations.find((e) => e.ruleKey === "sanctions_failed")?.overrideRejectedReason).toContain(
      "non-overridable",
    );
  });

  test("an overridable rule with a valid dual-approved override is neutralised", () => {
    const result = evaluateKnockouts({ ...cleanKnockoutContext, missedPayrollCycles: 2 }, DEFAULT_POLICY, [
      {
        ruleKey: "repeated_salary_non_payment",
        approvedBy: "admin_1",
        approvedByRole: "credit_committee",
        approvedAt: new Date(),
        reason: "Documented one-off bank outage; both cycles paid within 48 hours from a second account.",
        secondApproverId: "admin_2",
      },
    ]);
    expect(result.overriddenCount).toBe(1);
    expect(result.declineMandated).toBe(false);
  });

  test("an override missing its second authoriser is rejected", () => {
    const result = evaluateKnockouts({ ...cleanKnockoutContext, missedPayrollCycles: 2 }, DEFAULT_POLICY, [
      {
        ruleKey: "repeated_salary_non_payment",
        approvedBy: "admin_1",
        approvedByRole: "credit_committee",
        approvedAt: new Date(),
        reason: "Reviewed",
        secondApproverId: null,
      },
    ]);
    expect(result.overriddenCount).toBe(0);
    expect(result.declineMandated).toBe(true);
  });

  test("missing compliance clearance blocks and cannot be self-cleared by credit", () => {
    const result = evaluateKnockouts({ ...cleanKnockoutContext, complianceCleared: false }, DEFAULT_POLICY);
    expect(result.blocked).toBe(true);
    const rule = DEFAULT_POLICY.knockoutRules.find((r) => r.key === "compliance_clearance_missing");
    expect(rule?.overridable).toBe(false);
  });
});

/* ------------------------------------------------------------------- LIMITS */

describe("limit engine", () => {
  const base = {
    tier: "A" as const,
    totalScore: 90,
    verifiedMonthlyPayroll: 10_000_000,
    verifiedEmployeeCount: 140,
    verifiedPayrollMonths: 12,
    verifiedFinancialMonths: 12,
    requestedProducts: ["ewa", "payroll_buffer"] as ("ewa" | "payroll_buffer")[],
    requestedAmount: 10_000_000,
    averageMonthlyNetSurplus: 6_000_000,
    lowestClosingBalance: 18_000_000,
    cashReserveMonths: 2.5,
    totalApprovedBook: 2_000_000_000,
    existingExposureToEmployer: 0,
    existingExposureToIndustry: 0,
    enhancedDueDiligenceRequired: false,
    committeeReferralRequired: false,
    blocked: false,
    declineMandated: false,
  };

  test("tier A EWA is 50% of verified monthly payroll", () => {
    const result = recommendLimits(base, DEFAULT_POLICY);
    const ewa = result.products.find((p) => p.product === "ewa");
    expect(ewa?.recommendedLimit).toBe(5_000_000);
    expect(ewa?.availabilityPercent).toBe(50);
  });

  test("no limit is produced while a blocking rule stands", () => {
    const result = recommendLimits({ ...base, blocked: true }, DEFAULT_POLICY);
    expect(result.totalRecommendedExposure).toBeNull();
    expect(result.products.length).toBe(0);
    expect(result.noLimitReason).toContain("blocking");
  });

  test("no verified payroll means no limit at all", () => {
    const result = recommendLimits({ ...base, verifiedMonthlyPayroll: null }, DEFAULT_POLICY);
    expect(result.totalRecommendedExposure).toBeNull();
    expect(result.noLimitReason).toContain("verified payroll");
  });

  test("the payroll buffer is withdrawn at tier D rather than repriced", () => {
    const result = recommendLimits({ ...base, tier: "D", totalScore: 55 }, DEFAULT_POLICY);
    const buffer = result.products.find((p) => p.product === "payroll_buffer");
    expect(buffer?.offered).toBe(false);
    expect(result.requiresCommittee).toBe(true);
    expect(result.pilotOnly).toBe(true);
  });

  test("tier E produces nothing", () => {
    const result = recommendLimits({ ...base, tier: "E", totalScore: 30 }, DEFAULT_POLICY);
    expect(result.totalRecommendedExposure).toBeNull();
  });

  test("no repayment surplus binds the buffer to zero", () => {
    const result = recommendLimits({ ...base, averageMonthlyNetSurplus: -500_000 }, DEFAULT_POLICY);
    const buffer = result.products.find((p) => p.product === "payroll_buffer");
    expect(buffer?.offered).toBe(false);
  });

  test("the single-employer portfolio cap binds and says so", () => {
    const result = recommendLimits({ ...base, totalApprovedBook: 20_000_000 }, DEFAULT_POLICY);
    const ewa = result.products.find((p) => p.product === "ewa");
    const binding = ewa?.steps.find((s) => s.binding);
    expect(binding?.step).toContain("portfolio cap");
  });

  test("every step carries the formula that produced it", () => {
    const result = recommendLimits(base, DEFAULT_POLICY);
    for (const product of result.products) {
      for (const step of product.steps) {
        expect(step.formula.length).toBeGreaterThan(0);
      }
    }
  });
});

/* -------------------------------------------------------- AUTHORITY MATRIX */

describe("authority matrix", () => {
  const ctx = {
    exposure: 5_000_000,
    isPolicyException: false,
    hasKnockoutOverride: false,
    isConnectedParty: false,
    hasAdverseComplianceFinding: false,
    limitIncreasePercent: null,
    committeeReferralRequired: false,
  };

  test("an unconfigured matrix grants nobody authority", () => {
    const policy = {
      ...DEFAULT_POLICY,
      authorityMatrix: DEFAULT_POLICY.authorityMatrix.map((a) => ({ ...a, maxExposure: null })),
    };
    const result = resolveAuthority(ctx, policy);
    expect(result.exceedsAllAuthorities).toBe(true);
    expect(result.explanation).toContain("No approval authorities have been configured");
  });

  test("a knockout override always requires dual approval", () => {
    const result = resolveAuthority({ ...ctx, hasKnockoutOverride: true }, DEFAULT_POLICY);
    expect(result.dualApprovalRequired).toBe(true);
    expect(result.dualApprovalReasons).toContain("Knockout rule override");
  });

  test("a mandatory committee referral is not reduced by a small amount", () => {
    const result = resolveAuthority({ ...ctx, exposure: 1, committeeReferralRequired: true }, DEFAULT_POLICY);
    expect(result.requiredLevel).toBe("credit_committee");
    expect(result.dualApprovalRequired).toBe(true);
  });

  test("a limit increase above the policy percentage triggers dual approval", () => {
    const result = resolveAuthority({ ...ctx, limitIncreasePercent: 60 }, DEFAULT_POLICY);
    expect(result.dualApprovalRequired).toBe(true);
  });
});

/* ------------------------------------------------------------ COMPOSITE SCORE */

describe("composite score", () => {
  test("a strong employer reaches tier A with no knockouts", () => {
    const result = calculateScore(scoringInput(), DEFAULT_POLICY);
    expect(result.totalScore).toBeGreaterThanOrEqual(85);
    expect(result.tier).toBe("A");
    expect(result.knockouts.active.length).toBe(0);
    expect(result.decisionPermitted).toBe(true);
    expect(result.recommendedRoute).toBe("proceed_to_review");
    expect(result.limits.totalRecommendedExposure).toBeGreaterThan(0);
  });

  test("the components reconcile to the total", () => {
    const result = calculateScore(scoringInput(), DEFAULT_POLICY);
    const sum = result.components.reduce((s, c) => s + c.weightedScore, 0);
    expect(Math.abs(sum - result.totalScore)).toBeLessThan
      (0.02);
  });

  test("the weights applied always total 100", () => {
    const result = calculateScore(scoringInput(), DEFAULT_POLICY);
    const total = result.components.reduce((s, c) => s + c.weight, 0);
    expect(Math.abs(total - 100)).toBeLessThan(0.001);
  });

  test("a distressed employer does not reach an approvable tier", () => {
    const cycles = goodCycles();
    cycles[2] = { ...(cycles[2] as CycleInput), actualPayDate: null };
    cycles[5] = { ...(cycles[5] as CycleInput), actualPayDate: null };
    cycles[8] = { ...(cycles[8] as CycleInput), actualPayDate: payDate(-4, 9), paidFraction: 0.6 };

    const result = calculateScore(
      scoringInput({
        financial: financialInput(stressedPeriods()),
        payroll: { cycles, declaredPayDay: 25, industry: "construction" },
        industry: "construction",
        behavioural: { ...cleanBehavioural, repaymentsLate: 4, repaymentsOnTime: 8, returnedPayments: 3 },
        compliance: { ...cleanCompliance, pensionCompliant: false, taxFilingsCurrent: false },
      }),
      DEFAULT_POLICY,
    );

    expect(result.totalScore).toBeLessThan(75);
    expect(result.knockouts.active.length).toBeGreaterThan(0);
    expect(result.keyConcerns.length).toBeGreaterThan(0);
  });

  test("a sanctions match blocks even with an otherwise perfect file", () => {
    const result = calculateScore(
      scoringInput({
        compliance: {
          ...cleanCompliance,
          screenings: [
            {
              subject: "Employer Ltd",
              kind: "entity",
              sanctions: "confirmed_match",
              pep: "clear",
              screenedAt: new Date(),
            },
          ],
        },
      }),
      DEFAULT_POLICY,
    );
    expect(result.knockouts.blocked).toBe(true);
    expect(result.decisionPermitted).toBe(false);
    expect(result.recommendedRoute).toBe("blocked");
    expect(result.limits.totalRecommendedExposure).toBeNull();
  });

  test("an employer with no data at all cannot reach an approvable score", () => {
    const result = calculateScore(
      scoringInput({
        identity: {
          ...cleanIdentity,
          registrationVerified: false,
          registrationProvided: false,
          incorporationDocumentVerified: false,
          incorporationDocumentUploaded: false,
          taxIdProvided: false,
          taxIdVerified: false,
          addressProvided: false,
          addressVerified: false,
          bankAccountProvided: false,
          bankAccountNameMatch: null,
          contactEmailVerified: false,
          contactPhoneVerified: false,
          directors: [],
          beneficialOwnersDisclosed: 0,
          ownershipDeclaredComplete: false,
          ownershipPercentageDisclosed: null,
          businessAgeMonths: null,
        },
        financial: financialInput([], 0),
        payroll: { cycles: [], declaredPayDay: null, industry: null },
        compliance: { ...cleanCompliance, screenings: [], consentCurrent: false },
        complianceCleared: false,
      }),
      DEFAULT_POLICY,
    );
    expect(result.totalScore).toBeLessThan(50);
    expect(result.knockouts.blocked).toBe(true);
    expect(result.dataCompleteness.sufficientForDecision).toBe(false);
  });

  test("every component carries an explanation and its weight", () => {
    const result = calculateScore(scoringInput(), DEFAULT_POLICY);
    expect(result.components.length).toBe(6);
    for (const c of result.components) {
      expect(c.explanation.length).toBeGreaterThan(0);
      expect(c.weight).toBeGreaterThan(0);
      expect(c.rawScore).toBeGreaterThanOrEqual(0);
      expect(c.rawScore).toBeLessThanOrEqual(100);
    }
  });

  test("the policy version is recorded on the snapshot", () => {
    const result = calculateScore(scoringInput(), DEFAULT_POLICY);
    expect(result.policyVersion).toBe(DEFAULT_POLICY.version);
  });
});

/* ----------------------------------------------------------------- WORKFLOW */

const workflowCtx: WorkflowContext = {
  profileComplete: true,
  ownershipComplete: true,
  productRequestComplete: true,
  mandatoryDocumentsUploaded: true,
  mandatoryDocumentsVerified: true,
  payrollDataLoaded: true,
  bankDataLoaded: true,
  consentsGranted: true,
  identityVerificationComplete: true,
  complianceCleared: true,
  complianceReviewedBy: "admin_compliance",
  financialAnalysisComplete: true,
  payrollAnalysisComplete: true,
  scoreCalculated: true,
  scorePolicyVersion: "v1",
  limitsProposed: true,
  analystRecommendationRecorded: true,
  blocked: false,
  declineMandated: false,
  enhancedDueDiligenceRequired: false,
  enhancedDueDiligenceComplete: false,
  committeeReferralRequired: false,
  decisionRecorded: true,
  decisionOutcome: "approved",
  requiredApprovals: 1,
  approvalsRecorded: 1,
  committeeQuorumMet: true,
  offerAccepted: true,
  documentationComplete: true,
  limitsActivated: true,
};

describe("workflow state machine", () => {
  test("a complete application can be submitted", () => {
    expect(canTransition("draft", "submitted", workflowCtx, "employer_admin").allowed).toBe(true);
  });

  test("an application without consent cannot be submitted", () => {
    const result = canTransition("draft", "submitted", { ...workflowCtx, consentsGranted: false }, "employer_admin");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.blockers.join(" ")).toContain("consents");
  });

  test("only a compliance officer can clear compliance", () => {
    expect(canTransition("compliance_review", "financial_analysis", workflowCtx, "credit_administrator").allowed).toBe(
      false,
    );
    expect(canTransition("compliance_review", "financial_analysis", workflowCtx, "compliance_officer").allowed).toBe(
      true,
    );
  });

  test("approval cannot be sought while a blocking rule stands", () => {
    const result = canTransition(
      "analyst_recommendation",
      "approval",
      { ...workflowCtx, blocked: true },
      "risk_analyst",
    );
    expect(result.allowed).toBe(false);
  });

  test("enhanced due diligence must be complete before approval is sought", () => {
    const result = canTransition(
      "analyst_recommendation",
      "approval",
      { ...workflowCtx, enhancedDueDiligenceRequired: true, enhancedDueDiligenceComplete: false },
      "risk_analyst",
    );
    expect(result.allowed).toBe(false);
  });

  test("an offer cannot be issued without the required number of approvals", () => {
    const result = canTransition(
      "approval",
      "offer_issued",
      { ...workflowCtx, requiredApprovals: 2, approvalsRecorded: 1 },
      "credit_administrator",
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.blockers.join(" ")).toContain("2 approval");
  });

  test("stages cannot be skipped", () => {
    const result = canTransition("submitted", "approval", workflowCtx, "super_admin");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("TRANSITION_NOT_DEFINED");
  });

  test("the AI assessment stage can be skipped entirely", () => {
    expect(canTransition("payroll_analysis", "scoring", workflowCtx, "risk_analyst").allowed).toBe(true);
  });

  test("a declined application cannot be moved", () => {
    const result = canTransition("declined", "approval", workflowCtx, "super_admin");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("STAGE_TERMINAL");
  });
});

/* --------------------------------------------------------------- MONITORING */

const cleanMonitoring: MonitoringInput = {
  employerId: "emp_test",
  industry: "professional_services",
  currentTier: "A",
  currentScore: 90,
  previousScore: 90,
  scoreAgeDays: 10,
  latestCyclePaid: true,
  latestCycleDelayDays: 0,
  latestCyclePartial: false,
  latestCycleAmount: 8_000_000,
  trailingAverageAmount: 8_000_000,
  latestCycleEmployeeCount: 140,
  trailingAverageEmployeeCount: 140,
  mismatchedCyclesInWindow: 0,
  missedCyclesInWindow: 0,
  latestCycleMonth: 6,
  latestClosingBalance: 26_000_000,
  lowestBalanceInWindow: 18_000_000,
  returnedPaymentsInWindow: 0,
  newUndeclaredLenderCredits: 0,
  approvedExposure: 5_000_000,
  currentUtilisation: 2_000_000,
  participantCount: 40,
  eligibleEmployeeCount: 140,
  facilityRepaymentsLate: 0,
  facilityRepaymentsMissed: 0,
  documentsExpired: 0,
  documentsExpiringWithin30Days: 0,
  screeningAgeDays: 20,
  consentExpired: false,
  licenceExpiringWithin60Days: false,
  covenantsBreached: 0,
  covenantsBreachedUncured: 0,
  validatedAdverseFindingsSinceLastReview: 0,
  unvalidatedFindingsPending: 0,
  daysSinceLastReview: 20,
  daysUntilNextReview: 70,
};

describe("monitoring and early warning", () => {
  test("a performing employer is green with no alerts", () => {
    const result = runMonitoring(cleanMonitoring, DEFAULT_POLICY);
    expect(result.level).toBe("green");
    expect(result.alerts.length).toBe(0);
    expect(result.suggestDrawdownPause).toBe(false);
  });

  test("a missed payroll cycle is red and pauses drawdown", () => {
    const result = runMonitoring({ ...cleanMonitoring, latestCyclePaid: false }, DEFAULT_POLICY);
    expect(result.level).toBe("red");
    expect(result.suggestDrawdownPause).toBe(true);
    expect(result.triggerRescore).toBe(true);
    expect(result.recommendedNextReviewDays).toBe(7);
  });

  test("the level follows the worst alert, not the average", () => {
    const result = runMonitoring(
      {
        ...cleanMonitoring,
        latestCyclePaid: false,
        documentsExpiringWithin30Days: 4,
        unvalidatedFindingsPending: 6,
      },
      DEFAULT_POLICY,
    );
    expect(result.level).toBe("red");
    expect(result.peakSeverity).toBe("critical");
    expect(result.alerts[0]?.severity).toBe("critical");
  });

  test("a seasonal payroll drop is graded lower than an unexplained one", () => {
    /* Education: July is a known low season in the industry template. */
    const seasonal = runMonitoring(
      {
        ...cleanMonitoring,
        industry: "education",
        latestCycleMonth: 7,
        latestCycleAmount: 5_000_000,
        trailingAverageAmount: 8_000_000,
      },
      DEFAULT_POLICY,
    );
    const unexplained = runMonitoring(
      {
        ...cleanMonitoring,
        industry: "professional_services",
        latestCycleMonth: 7,
        latestCycleAmount: 5_000_000,
        trailingAverageAmount: 8_000_000,
      },
      DEFAULT_POLICY,
    );
    expect(seasonal.level).toBe("amber");
    expect(unexplained.level).toBe("red");
  });

  test("unverified external items are informational only", () => {
    const result = runMonitoring({ ...cleanMonitoring, unvalidatedFindingsPending: 3 }, DEFAULT_POLICY);
    expect(result.alerts[0]?.severity).toBe("info");
    expect(result.level).toBe("green");
  });

  test("expired consent stops processing immediately", () => {
    const result = runMonitoring({ ...cleanMonitoring, consentExpired: true }, DEFAULT_POLICY);
    expect(result.level).toBe("red");
    expect(result.suggestDrawdownPause).toBe(true);
  });

  test("participation is reported as an aggregate rate only", () => {
    const result = runMonitoring(cleanMonitoring, DEFAULT_POLICY);
    expect(result.participationRate).toBeCloseTo(40 / 140, 5);
    /* No field on the result exposes which employees drew. */
    expect(Object.keys(result)).not.toContain("participants");
  });
});
