import { Hono } from "hono";
import type { Context } from "hono";
import { prisma } from "../db";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { record } from "../security/audit-store";
import { validate } from "../security/validate";
import { buildScoringInput } from "../eir/scoring-input";
import { loadActivePolicy } from "../eir/policy-store";
import { persistScore } from "../eir/persist-score";
import { calculateScore, type ScoreResult } from "../eir/risk/score";
import { resolveAuthority, type AuthorityContext } from "../eir/risk/limits";
import { AUTHORITY_LEVELS, TIER_LABELS, type AuthorityLevel } from "../eir/risk/policy";
import {
  recordCreditDecisionSchema,
  type AuthorityDecisionView,
  type BridgeDrawView,
  type CreditDecisionView,
  type RiskScoreView,
} from "../types";

/**
 * Credit risk — Admin → Credit risk.
 *
 * Wires the eir/risk engine (policy.ts/identity.ts/financial.ts/payroll.ts/
 * behavioural.ts/compliance.ts/industry.ts/knockouts.ts/limits.ts/score.ts)
 * to a real route for the first time. That engine is pure and untouched —
 * this file's whole job is: assemble real data (eir/scoring-input.ts), call
 * it, persist the result (eir/persist-score.ts), and gate a decision on its
 * own authority matrix (eir/risk/limits.ts resolveAuthority).
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: the full 19-stage `eir/risk/workflow.ts`
 * state machine (draft → submitted → completeness_review → ... →
 * activation → monitoring) is NOT enforced here — most of its preconditions
 * (a completed KYB pack, financial statements, a formal application) don't
 * exist as captured data anywhere in the product yet. This route uses a
 * single minimal `Application` row purely so `CreditDecision` has the
 * required relation it needs, not as a stand-in for the real workflow. See
 * AGENTS.md.
 *
 * WHAT ELSE IS DELIBERATELY UNRESOLVED: `DEFAULT_POLICY`'s authority matrix
 * ships with every `maxExposure: null` — by the engine's own design, that
 * means ZERO configured authority, not unlimited (see policy.ts). No policy
 * editor exists yet to change that. So a decision here will typically report
 * "no authority level is configured to approve this exposure" — which is
 * the CORRECT, honest answer given nobody has set real risk-appetite numbers
 * yet, not a bug in this route.
 */
const adminRiskRouter = new Hono();

adminRiskRouter.use("*", requireAdmin());
adminRiskRouter.use("*", requireAdminPermission("risk.view"));

function actor(c: Context): { id: string; label: string; role: string } {
  const staff = c.get("staff");
  return {
    id: staff?.uid ?? staff?.sub ?? "unknown",
    label: staff?.sub ?? "unknown",
    role: staff?.role ?? (staff?.uid ? "unknown" : "super_admin"),
  };
}

/**
 * Maps this portal's admin roles onto the engine's authority vocabulary.
 *
 * The two role systems were never unified (admin-roles.ts is job functions
 * in a compliance organisation; AUTHORITY_LEVELS is a credit-approval
 * hierarchy) and reconciling them for real needs a product decision this
 * route should not make silently. `super_admin` maps to `managing_director`
 * — high, but deliberately NOT the top of the ladder — so `credit_committee`
 * and `board`-level exposures correctly stay unreachable until a real
 * committee process exists, rather than one role being able to approve
 * everything.
 */
function authorityLevelFor(adminRole: string): AuthorityLevel | null {
  if (adminRole === "super_admin") return "managing_director";
  return null;
}

function toRiskScoreView(result: ScoreResult, scoreId: string): RiskScoreView {
  return {
    scoreId,
    employerId: result.employerId,
    policyVersion: result.policyVersion,
    totalScore: result.totalScore,
    tier: result.tier,
    tierLabel: result.tierLabel,
    classification: result.classification,
    components: result.components.map((c) => ({
      component: c.component,
      label: c.label,
      rawScore: c.rawScore,
      weight: c.weight,
      weightedScore: c.weightedScore,
      classification: c.classification,
      dataInsufficient: c.dataInsufficient,
      explanation: c.explanation,
    })),
    knockouts: {
      evaluations: result.knockouts.evaluations.map((e) => ({
        ruleKey: e.ruleKey,
        label: e.label,
        triggered: e.triggered,
        consequence: e.consequence,
        overridable: e.overridable,
        description: e.description,
        evidence: e.evidence,
      })),
      triggeredCount: result.knockouts.triggeredCount,
      blocked: result.knockouts.blocked,
      declineMandated: result.knockouts.declineMandated,
      committeeReferralRequired: result.knockouts.committeeReferralRequired,
      enhancedDueDiligenceRequired: result.knockouts.enhancedDueDiligenceRequired,
      worstConsequence: result.knockouts.worstConsequence,
      reasons: result.knockouts.reasons,
    },
    limits: {
      totalRecommendedExposure: result.limits.totalRecommendedExposure,
      displayTotal: result.limits.displayTotal,
      products: result.limits.products.map((p) => ({
        product: p.product,
        offered: p.offered,
        recommendedLimit: p.recommendedLimit,
        displayLimit: p.displayLimit,
        reason: p.reason,
      })),
      noLimitReason: result.limits.noLimitReason,
      conditions: result.limits.conditions,
    },
    decisionPermitted: result.decisionPermitted,
    recommendedRoute: result.recommendedRoute,
    dataCompleteness: result.dataCompleteness,
    keyStrengths: result.keyStrengths,
    keyConcerns: result.keyConcerns,
    outstandingItems: result.outstandingItems,
    explanation: result.explanation,
    calculatedAt: result.calculatedAt,
  };
}

/**
 * GET /employers — the real companies created via /api/employer/register
 * (webapp: /employer-portal/register). Deliberately separate from the
 * pre-launch lead/registration pipeline's "Employers" admin page, which
 * lists marketing interest (`Registration`, segment="employer"), not this
 * `Employer` model — the two are unrelated tables with the same English name.
 */
adminRiskRouter.get("/employers", async (c) => {
  const q = c.req.query("q")?.trim();
  const rows = await prisma.employer.findMany({
    where: q
      ? { OR: [{ registeredName: { contains: q, mode: "insensitive" } }, { industry: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      registeredName: true,
      status: true,
      industry: true,
      employeeCount: true,
      currentScore: true,
      currentTier: true,
      earlyWarningLevel: true,
      createdAt: true,
    },
  });
  return c.json({
    data: {
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    },
  });
});

/**
 * POST /employers/:employerId/score — (re)calculate and persist a snapshot.
 */
adminRiskRouter.post("/employers/:employerId/score", async (c) => {
  const employerId = c.req.param("employerId");
  const who = actor(c);

  const employer = await prisma.employer.findUnique({ where: { id: employerId }, select: { id: true } });
  if (!employer) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const [scoringInput, { policy, policyVersionId }] = await Promise.all([
    buildScoringInput(employerId),
    loadActivePolicy(),
  ]);

  const result = calculateScore(scoringInput, policy);
  const scoreId = await persistScore({
    employerId,
    policyVersionId,
    result,
    actorId: who.id,
    actorLabel: who.label,
    trigger: "manual",
  });

  await record(c, {
    action: "risk.score.calculated",
    outcome: "success",
    actorType: "admin",
    actorId: who.id,
    actorLabel: who.label,
    targetType: "employer_score",
    targetId: scoreId,
    detail: { employerId, tier: result.tier, totalScore: result.totalScore, knockoutOutcome: result.knockouts.worstConsequence },
  });

  return c.json({ data: toRiskScoreView(result, scoreId) }, 201);
});

/**
 * GET /employers/:employerId/score — the latest snapshot, live-recalculated.
 *
 * Recomputed rather than replayed from storage: the persisted row only keeps
 * denormalised scalars (see eir/persist-score.ts's header note), not the full
 * narrative fields this view needs. Recalculating is cheap (pure functions,
 * no I/O inside the engine itself) and guarantees the view is internally
 * consistent. It does NOT write a new snapshot — only POST does that.
 */
adminRiskRouter.get("/employers/:employerId/score", async (c) => {
  const employerId = c.req.param("employerId");

  const employer = await prisma.employer.findUnique({ where: { id: employerId }, select: { id: true } });
  if (!employer) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const existing = await prisma.employerScore.findFirst({ where: { employerId }, orderBy: { calculatedAt: "desc" } });
  if (!existing) return c.json({ data: null });

  const [scoringInput, { policy }] = await Promise.all([buildScoringInput(employerId), loadActivePolicy()]);
  const result = calculateScore(scoringInput, policy);
  return c.json({ data: toRiskScoreView(result, existing.id) });
});

/** Finds or creates the single Application `CreditDecision` needs to relate to. */
async function ensureApplication(employerId: string): Promise<string> {
  const existing = await prisma.application.findFirst({ where: { employerId }, orderBy: { createdAt: "desc" } });
  if (existing) return existing.id;

  const count = await prisma.application.count();
  const reference = `EIR-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const created = await prisma.application.create({
    data: { employerId, reference, stage: "scoring" },
  });
  return created.id;
}

async function finaliseDecision(decisionId: string): Promise<void> {
  const decision = await prisma.creditDecision.findUniqueOrThrow({
    where: { id: decisionId },
    include: { score: { include: { limitRecommendations: true } } },
  });

  if (decision.decision === "approve") {
    if (decision.score) {
      await prisma.creditLimit.createMany({
        data: decision.score.limitRecommendations.map((r) => ({
          employerId: decision.employerId,
          applicationId: decision.applicationId,
          decisionId: decision.id,
          product: r.product,
          approvedAmount: r.aggregateLimit ?? 0,
          availableAmount: r.aggregateLimit ?? 0,
          availabilityPercent: r.availabilityPercent,
          cycleCap: r.cycleCap,
          maxTenorDays: r.maxTenorDays,
          pricingTier: r.pricingTier,
        })),
      });
    }
    // "active" — not "approved" — is deliberate: this is the exact field
    // the Eligibility Engine's `employerActive` check reads (routes/
    // employee-link.ts). A weaker status here would leave every employee
    // ineligible even after a real approval.
    await prisma.employer.update({ where: { id: decision.employerId }, data: { status: "active" } });
  } else {
    await prisma.employer.update({ where: { id: decision.employerId }, data: { status: "declined" } });
  }
}

function toDecisionView(row: {
  id: string;
  employerId: string;
  decision: string;
  reason: string;
  decidedByLabel: string;
  authorityLevel: string;
  secondedByLabel: string | null;
  recommendedTier: string | null;
  recommendedLimit: unknown;
  approvedLimit: unknown;
  decidedAt: Date;
}, finalised: boolean): CreditDecisionView {
  return {
    id: row.id,
    employerId: row.employerId,
    decision: row.decision,
    reason: row.reason,
    decidedByLabel: row.decidedByLabel,
    authorityLevel: row.authorityLevel,
    secondedByLabel: row.secondedByLabel,
    recommendedTier: row.recommendedTier,
    recommendedLimit: row.recommendedLimit === null ? null : Number(row.recommendedLimit),
    approvedLimit: row.approvedLimit === null ? null : Number(row.approvedLimit),
    decidedAt: row.decidedAt.toISOString(),
    finalised,
  };
}

/**
 * POST /employers/:employerId/decision — approve or decline, gated by the
 * engine's own authority matrix (eir/risk/limits.ts resolveAuthority).
 */
adminRiskRouter.post(
  "/employers/:employerId/decision",
  requireAdminPermission("risk.decide"),
  validate("json", recordCreditDecisionSchema),
  async (c) => {
    const employerId = c.req.param("employerId");
    const who = actor(c);
    const input = c.req.valid("json");

    const score = await prisma.employerScore.findFirst({
      where: { employerId },
      orderBy: { calculatedAt: "desc" },
      include: { limitRecommendations: true, policyVersion: true },
    });
    if (!score) {
      return c.json(
        { error: { message: "Calculate a score for this employer before recording a decision.", code: "NO_SCORE" } },
        409,
      );
    }

    if (input.decision === "approve" && (score.knockoutOutcome === "blocked" || score.knockoutOutcome === "decline")) {
      return c.json(
        {
          error: {
            message:
              score.knockoutOutcome === "blocked"
                ? "This employer is blocked by a non-overridable knockout rule and cannot be approved."
                : "A knockout rule mandates decline for this employer.",
            code: "KNOCKOUT_BLOCKS_APPROVAL",
          },
        },
        409,
      );
    }

    const exposure =
      input.decision === "approve"
        ? score.limitRecommendations.reduce((sum, r) => sum + (r.aggregateLimit ? Number(r.aggregateLimit) : 0), 0)
        : 0;

    const { policy } = await loadActivePolicy();
    const authorityCtx: AuthorityContext = {
      exposure,
      isPolicyException: false,
      hasKnockoutOverride: false,
      isConnectedParty: false,
      hasAdverseComplianceFinding: score.knockoutOutcome !== "clear",
      limitIncreasePercent: null,
      committeeReferralRequired: score.knockoutOutcome === "committee_referral",
    };
    const authority = resolveAuthority(authorityCtx, policy);

    const actorLevel = authorityLevelFor(who.role);
    const actorRank = actorLevel ? AUTHORITY_LEVELS.indexOf(actorLevel) : -1;
    const requiredRank = authority.requiredLevel ? AUTHORITY_LEVELS.indexOf(authority.requiredLevel as AuthorityLevel) : -1;

    if (authority.exceedsAllAuthorities || requiredRank === -1 || actorRank < requiredRank) {
      const view: AuthorityDecisionView = {
        requiredLevel: authority.requiredLevel,
        requiredLevelLabel: authority.requiredLevelLabel,
        dualApprovalRequired: authority.dualApprovalRequired,
        dualApprovalReasons: authority.dualApprovalReasons,
        exceedsAllAuthorities: authority.exceedsAllAuthorities,
        explanation: authority.explanation,
      };
      return c.json(
        {
          // `authority` nested inside `error`, not alongside it: the shared
          // API client (webapp/src/lib/api.ts) unwraps a failure response to
          // `json.error` only — anything outside that object is silently
          // dropped before the caller ever sees it.
          error: {
            message: `No configured authority (including yours) can approve this exposure. ${authority.explanation}`,
            code: "AUTHORITY_NOT_CONFIGURED",
            authority: view,
          },
        },
        403,
      );
    }

    const applicationId = await ensureApplication(employerId);

    const created = await prisma.creditDecision.create({
      data: {
        employerId,
        applicationId,
        scoreId: score.id,
        policyVersionId: score.policyVersionId,
        decision: input.decision,
        reason: input.reason,
        decidedBy: who.id,
        decidedByLabel: who.label,
        decidedByRole: who.role,
        authorityLevel: actorLevel ?? "credit_administrator",
        recommendedTier: score.tier,
        recommendedLimit: score.limitRecommendations.reduce((sum, r) => sum + (r.aggregateLimit ? Number(r.aggregateLimit) : 0), 0) || null,
        approvedLimit: authority.dualApprovalRequired ? null : exposure || null,
        votes: {
          create: [{ voterId: who.id, voterLabel: who.label, voterRole: who.role, vote: input.decision }],
        },
      },
    });

    await record(c, {
      action: "risk.decision.recorded",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "credit_decision",
      targetId: created.id,
      newStatus: input.decision,
      detail: { employerId, dualApprovalRequired: authority.dualApprovalRequired, exposure },
    });

    if (authority.dualApprovalRequired) {
      return c.json({ data: toDecisionView(created, false) }, 201);
    }

    await finaliseDecision(created.id);
    return c.json({ data: toDecisionView(created, true) }, 201);
  },
);

/**
 * POST /employers/:employerId/decision/:decisionId/second — the second
 * authoriser, required whenever `resolveAuthority` said so. Must be a
 * different person than whoever recorded the first decision — enforced by
 * `ApprovalVote`'s unique `[decisionId, voterId]` constraint, not just a
 * role check.
 */
adminRiskRouter.post(
  "/employers/:employerId/decision/:decisionId/second",
  requireAdminPermission("risk.decide"),
  async (c) => {
    const who = actor(c);
    const decision = await prisma.creditDecision.findFirst({
      where: { id: c.req.param("decisionId"), employerId: c.req.param("employerId") },
    });
    if (!decision) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
    if (decision.secondedBy) {
      return c.json({ error: { message: "This decision already has a second approver.", code: "ALREADY_SECONDED" } }, 409);
    }
    if (decision.decidedBy === who.id) {
      return c.json({ error: { message: "A second approver must be a different person.", code: "SAME_APPROVER" } }, 409);
    }

    try {
      await prisma.approvalVote.create({
        data: { decisionId: decision.id, voterId: who.id, voterLabel: who.label, voterRole: who.role, vote: decision.decision },
      });
    } catch {
      return c.json({ error: { message: "You have already voted on this decision.", code: "ALREADY_VOTED" } }, 409);
    }

    const updated = await prisma.creditDecision.update({
      where: { id: decision.id },
      data: { secondedBy: who.id, secondedByLabel: who.label, secondedAt: new Date() },
    });

    await finaliseDecision(updated.id);

    await record(c, {
      action: "risk.decision.seconded",
      outcome: "success",
      actorType: "admin",
      actorId: who.id,
      actorLabel: who.label,
      targetType: "credit_decision",
      targetId: updated.id,
    });

    return c.json({ data: toDecisionView(updated, true) });
  },
);

adminRiskRouter.get("/employers/:employerId/decisions", async (c) => {
  const rows = await prisma.creditDecision.findMany({
    where: { employerId: c.req.param("employerId") },
    orderBy: { decidedAt: "desc" },
  });

  // "Finalised" is not a stored column — recompute the same authority check
  // that gated creation, using the exposure that was recorded at the time,
  // so a decision awaiting a second approver reads correctly here too.
  const { policy } = await loadActivePolicy();
  const items = rows.map((r) => {
    const authority = resolveAuthority(
      {
        exposure: r.recommendedLimit ? Number(r.recommendedLimit) : 0,
        isPolicyException: false,
        hasKnockoutOverride: false,
        isConnectedParty: false,
        hasAdverseComplianceFinding: false,
        limitIncreasePercent: null,
        committeeReferralRequired: false,
      },
      policy,
    );
    const finalised = !authority.dualApprovalRequired || r.secondedBy !== null;
    return toDecisionView(r, finalised);
  });

  return c.json({ data: { items } });
});

/**
 * GET /employers/:employerId/draws — treasury oversight of individual Bridge
 * draws for one employer. Staff-only: this is exactly the data
 * `Utilisation`'s "never who" comment says an EMPLOYER must never see (see
 * schema.prisma and routes/bridge.ts) — nothing here is reachable from any
 * employer-facing route.
 */
adminRiskRouter.get("/employers/:employerId/draws", async (c) => {
  const rows = await prisma.bridgeDraw.findMany({
    where: { employerId: c.req.param("employerId") },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
  const items: BridgeDrawView[] = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    requestedAmount: Number(r.requestedAmount),
    approvedAmount: r.approvedAmount === null ? null : Number(r.approvedAmount),
    status: r.status as BridgeDrawView["status"],
    rejectionReason: r.rejectionReason,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
  }));
  return c.json({ data: { items } });
});

adminRiskRouter.get("/employers/:employerId/limits", async (c) => {
  const rows = await prisma.creditLimit.findMany({
    where: { employerId: c.req.param("employerId") },
    orderBy: { createdAt: "desc" },
  });
  return c.json({
    data: {
      items: rows.map((r) => ({
        id: r.id,
        product: r.product,
        approvedAmount: Number(r.approvedAmount),
        availableAmount: Number(r.availableAmount),
        status: r.status,
        effectiveFrom: r.effectiveFrom.toISOString(),
      })),
    },
  });
});

export { adminRiskRouter, TIER_LABELS };
