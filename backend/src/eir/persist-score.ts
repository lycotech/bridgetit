import { prisma } from "../db";
import type { ScoreResult } from "./risk/score";

/**
 * Writes one `ScoreResult` snapshot to `EmployerScore` + its child tables,
 * and updates the `Employer` row's denormalised current-score columns.
 *
 * WHERE THE SCHEMA AND THE ENGINE DON'T LINE UP 1:1 (documented once here
 * rather than at each field): `LimitRecommendation.employeeCap`/`cycleCap`
 * are typed as absolute Decimal amounts, but the engine's per-product
 * `employeeCapPercentOfNet` is a PERCENTAGE (it needs an individual
 * employee's net pay to become a naira figure, which this snapshot does not
 * have) — left null, with the percentage preserved in `inputs` JSON instead
 * of being silently dropped. `payroll`/`behavioural`/`compliance` detail
 * (the `checks`/`signals` arrays) have no dedicated table — see the
 * `factors` JSON on `ScoreComponent` for the condensed, queryable version.
 */
export async function persistScore(input: {
  employerId: string;
  policyVersionId: string;
  result: ScoreResult;
  actorId: string;
  actorLabel: string;
  trigger?: string;
}): Promise<string> {
  const { employerId, policyVersionId, result, actorId, actorLabel, trigger } = input;

  const earlyWarningLevel =
    result.knockouts.blocked || result.knockouts.declineMandated
      ? "red"
      : result.tier === "D" || result.tier === "E" || result.knockouts.enhancedDueDiligenceRequired
        ? "amber"
        : "green";

  const componentByKey = Object.fromEntries(result.components.map((c) => [c.component, c]));

  const score = await prisma.employerScore.create({
    data: {
      employerId,
      policyVersionId,
      totalScore: Math.round(result.totalScore),
      tier: result.tier,
      identityConfidence: roundOrNull(componentByKey.identity?.rawScore),
      financialHealth: roundOrNull(componentByKey.financial?.rawScore),
      payrollReliability: roundOrNull(componentByKey.payroll?.rawScore),
      behaviouralTrust: roundOrNull(componentByKey.behavioural?.rawScore),
      compliance: roundOrNull(componentByKey.compliance?.rawScore),
      industryContext: roundOrNull(componentByKey.industry?.rawScore),
      payrollClassification: result.detail.payroll.payrollClassification,
      earlyWarningLevel,
      knockoutOutcome: result.knockouts.worstConsequence ?? "clear",
      payrollMonthsAvailable: result.dataCompleteness.payrollMonths,
      financialMonthsAvailable: result.dataCompleteness.financialMonths,
      hasDataGaps: result.components.some((c) => c.dataInsufficient),
      trigger: trigger ?? "manual",
      calculatedBy: actorId,
      calculatedByLabel: actorLabel,
      calculatedAt: new Date(result.calculatedAt),
      components: {
        create: result.components.map((c) => ({
          component: c.component,
          label: c.label,
          rawScore: Math.round(c.rawScore),
          weight: c.weight,
          weightedScore: c.weightedScore,
          classification: c.classification,
          factors: JSON.stringify(c.factors),
          explanation: c.explanation,
          dataInsufficient: c.dataInsufficient,
        })),
      },
      knockouts: {
        create: result.knockouts.evaluations.map((e) => ({
          rule: e.ruleKey,
          label: e.label,
          result: e.triggered ? "triggered" : "pass",
          consequence: e.consequence,
          overridable: e.overridable,
          detail: e.description,
          evidence: e.evidence,
        })),
      },
      limitRecommendations: {
        create: result.limits.products
          .filter((p) => p.offered)
          .map((p) => ({
            product: p.product,
            availabilityPercent: p.availabilityPercent,
            aggregateLimit: p.recommendedLimit,
            cycleCap: p.cycleCap,
            maxTenorDays: p.maxTenorDays,
            pricingTier: result.limits.pricingTier,
            securityRequired: JSON.stringify(result.limits.securityRequired),
            reserveRequired: JSON.stringify(result.limits.reserveRequired),
            inputs: JSON.stringify({ employeeCapPercentOfNet: p.employeeCapPercentOfNet, steps: p.steps }),
            formula: p.steps.map((s) => `${s.step}: ${s.formula} = ${s.displayValue}`).join(" | "),
            bindingConstraint: p.steps.find((s) => s.binding)?.step ?? null,
          })),
      },
    },
    select: { id: true },
  });

  await prisma.employer.update({
    where: { id: employerId },
    data: {
      currentScore: Math.round(result.totalScore),
      currentTier: result.tier,
      earlyWarningLevel,
    },
  });

  return score.id;
}

function roundOrNull(v: number | undefined): number | null {
  return v === undefined ? null : Math.round(v);
}
