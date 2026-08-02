import { prisma } from "../db";
import { DEFAULT_POLICY, creditPolicySchema, type CreditPolicy } from "./risk/policy";

/**
 * Loads (and, on first use, seeds) the active credit policy from
 * `ScoringPolicyVersion`.
 *
 * WHY seed rather than require a setup step: the scoring engine
 * (eir/risk/*) has existed, tested, since before this file — refusing to run
 * it until someone visits a policy-editor screen that also does not exist
 * yet would mean it stays unreachable for another release. `DEFAULT_POLICY`
 * (eir/risk/policy.ts) is exactly the seed the module's own author intended
 * for this ("the seed for version 1 and the fallback when the table is
 * empty").
 *
 * WHAT IS NOT PERSISTED YET: `ScoringPolicyVersion` has no column for
 * `portfolioCaps` or `dualApprovalTriggers` — every other field of
 * `CreditPolicy` does. Those two are not employer-specific and rarely
 * change, so for now they come straight from `DEFAULT_POLICY` rather than
 * forcing a schema change to store two objects nobody has a screen to edit
 * yet. If a policy-editor screen is ever built for them, add the columns
 * then.
 *
 * WHY the seeded authority matrix has every `maxExposure: null`: that is
 * `DEFAULT_POLICY`'s own value, and its own comment explains why — an
 * unconfigured threshold must mean ZERO authority, not unlimited. This
 * module does not invent risk-appetite numbers; only a Super Admin, through
 * a policy screen not yet built, should ever set real naira thresholds. See
 * AGENTS.md for what that means for the decision route today.
 */
export async function loadActivePolicy(): Promise<{ policy: CreditPolicy; policyVersionId: string }> {
  const row =
    (await prisma.scoringPolicyVersion.findFirst({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
    })) ?? (await seedDefaultPolicy());

  const policy = creditPolicySchema.parse({
    version: row.version,
    weights: JSON.parse(row.weights),
    tiers: JSON.parse(row.tiers),
    benchmarks: JSON.parse(row.benchmarks),
    knockoutRules: JSON.parse(row.knockoutRules),
    limitRules: JSON.parse(row.limitRules),
    authorityMatrix: JSON.parse(row.authorityMatrix),
    industryOverrides: row.industryOverrides ? JSON.parse(row.industryOverrides) : undefined,
    portfolioCaps: DEFAULT_POLICY.portfolioCaps,
    dualApprovalTriggers: DEFAULT_POLICY.dualApprovalTriggers,
  });

  return { policy, policyVersionId: row.id };
}

async function seedDefaultPolicy() {
  return prisma.scoringPolicyVersion.create({
    data: {
      version: DEFAULT_POLICY.version,
      name: "Default seed policy",
      status: "published",
      weights: JSON.stringify(DEFAULT_POLICY.weights),
      tiers: JSON.stringify(DEFAULT_POLICY.tiers),
      benchmarks: JSON.stringify(DEFAULT_POLICY.benchmarks),
      knockoutRules: JSON.stringify(DEFAULT_POLICY.knockoutRules),
      limitRules: JSON.stringify(DEFAULT_POLICY.limitRules),
      authorityMatrix: JSON.stringify(DEFAULT_POLICY.authorityMatrix),
      changeReason: "Initial seed from eir/risk/policy.ts DEFAULT_POLICY — no policy screen exists yet to author one.",
      createdBy: "system",
      createdByLabel: "System (seed)",
      publishedAt: new Date(),
    },
  });
}
