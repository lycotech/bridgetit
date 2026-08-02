import { Hono } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser, requireFinancialAccess } from "./auth";
import { computeEligibility } from "../bridge/eligibility";
import { requestBridgeDrawSchema, type BridgeDrawView } from "../types";

/**
 * Bridge — the employee earned-wage-access draw request.
 *
 * "Treasury approves funding" (PRD.md's business flow) does NOT mean a
 * PayBridge staff member reviews each draw. Treasury's approval already
 * happened, once, when a human with real authority set the employer's `ewa`
 * CreditLimit (routes/admin-risk.ts's decision endpoint). From there, every
 * individual draw is a deterministic check against that pre-approved
 * capacity — exactly how a real EWA product works: instant for the
 * employee, because the risk decision was already made upstream. A route
 * that queued every ₦5,000 draw for manual staff review would be a UX
 * failure this product exists to avoid, not a safety feature.
 *
 * WHAT THIS DOES NOT DO: no money moves. `status` stops at
 * `approved`/`rejected`. Disbursement (actually paying the employee) and
 * repayment (the payroll deduction) are a separate, not-yet-built piece —
 * see AGENTS.md, "Disbursement/Repayment".
 *
 * EMPLOYEE PRIVACY: nothing in this file is reachable from an employer
 * session (routes/employer*.ts). An employer's own routes only ever read
 * `Utilisation`, which is an aggregate — see the model comment in
 * schema.prisma. Individual draws are visible to the employee themselves and
 * to PayBridge staff (routes/admin-risk.ts's employer draw list) only.
 */
const bridgeRouter = new Hono();

bridgeRouter.use("/request", rateLimit({ name: "bridge:request", limit: 20, windowMs: 60 * 60_000 }));

function toDrawView(row: {
  id: string;
  reference: string;
  requestedAmount: unknown;
  approvedAmount: unknown;
  status: string;
  rejectionReason: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}): BridgeDrawView {
  return {
    id: row.id,
    reference: row.reference,
    requestedAmount: Number(row.requestedAmount),
    approvedAmount: row.approvedAmount === null ? null : Number(row.approvedAmount),
    status: row.status as BridgeDrawView["status"],
    rejectionReason: row.rejectionReason,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

async function nextReference(): Promise<string> {
  const count = await prisma.bridgeDraw.count();
  return `BRG-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

bridgeRouter.post(
  "/request",
  requireUser(),
  requireFinancialAccess(),
  validate("json", requestBridgeDrawSchema),
  async (c) => {
    const account = c.get("account");
    const input = c.req.valid("json");

    const eligibility = await computeEligibility(account.id, account.kycStatus);

    if (!eligibility.view.eligible || !eligibility.employeeRecordId) {
      return c.json(
        {
          error: {
            message: eligibility.view.reasons[0] ?? "You are not currently eligible for a Bridge.",
            code: "NOT_ELIGIBLE",
          },
        },
        403,
      );
    }

    if (!eligibility.limitId) {
      return c.json(
        {
          error: {
            message: "Your employer does not have an active earned-wage-access facility yet.",
            code: "NO_ACTIVE_LIMIT",
          },
        },
        409,
      );
    }

    const limit = await prisma.creditLimit.findUniqueOrThrow({ where: { id: eligibility.limitId } });
    const reference = await nextReference();

    const earned = eligibility.view.earnedWageEstimate ?? 0;
    const available = Number(limit.availableAmount);

    let rejectionReason: string | null = null;
    if (input.amount > earned) {
      rejectionReason = `You have earned an estimated ₦${earned.toLocaleString("en-NG")} so far this period, which is less than the ₦${input.amount.toLocaleString("en-NG")} requested.`;
    } else if (input.amount > available) {
      rejectionReason = "Your employer's earned-wage-access facility does not currently have enough capacity for this amount.";
    } else if (limit.cycleCap && input.amount > Number(limit.cycleCap)) {
      rejectionReason = "This amount exceeds the per-cycle limit set for your employer.";
    }

    const draw = await prisma.bridgeDraw.create({
      data: {
        userId: account.id,
        employeeRecordId: eligibility.employeeRecordId,
        employerId: limit.employerId,
        limitId: limit.id,
        cycleId: eligibility.cycleId,
        reference,
        requestedAmount: input.amount,
        approvedAmount: rejectionReason ? null : input.amount,
        status: rejectionReason ? "rejected" : "approved",
        rejectionReason,
        decidedAt: new Date(),
        decidedBy: "system",
        decidedByLabel: "Automatic decision",
      },
    });

    if (!rejectionReason) {
      await prisma.creditLimit.update({
        where: { id: limit.id },
        data: { availableAmount: { decrement: input.amount } },
      });

      // Aggregate only — see the model comment on Utilisation for why this
      // never records which employee drew.
      if (eligibility.cycleId) {
        const cycle = await prisma.payrollCycle.findUnique({ where: { id: eligibility.cycleId } });
        if (cycle) {
          const existing = await prisma.utilisation.findFirst({
            where: { limitId: limit.id, product: "ewa", cyclePeriodStart: cycle.periodStart },
          });
          const participantCount = await prisma.bridgeDraw.groupBy({
            by: ["userId"],
            where: { limitId: limit.id, cycleId: eligibility.cycleId, status: "approved" },
          }).then((rows) => rows.length);

          if (existing) {
            await prisma.utilisation.update({
              where: { id: existing.id },
              data: { amount: { increment: input.amount }, participantCount },
            });
          } else {
            await prisma.utilisation.create({
              data: {
                employerId: limit.employerId,
                limitId: limit.id,
                product: "ewa",
                amount: input.amount,
                participantCount,
                cyclePeriodStart: cycle.periodStart,
                dueAt: cycle.expectedPayDate,
              },
            });
          }
        }
      }
    }

    await record(c, {
      action: rejectionReason ? "bridge.draw.rejected" : "bridge.draw.approved",
      outcome: rejectionReason ? "denied" : "success",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "bridge_draw",
      targetId: draw.id,
      detail: { reference, requestedAmount: input.amount },
    });

    // Always 201: the request was successfully processed and a BridgeDraw
    // row exists either way. A rejection is a normal outcome the caller
    // reads from `data.status`/`data.rejectionReason` — matching how a KYC
    // rejection returns 200 with the case data rather than an HTTP error
    // (.claude/rules/api-patterns.md's envelope convention). A 4xx here
    // would put the response body outside the `{ data }`/`{ error }`
    // envelope the shared client (webapp/src/lib/api.ts) expects.
    return c.json({ data: toDrawView(draw) }, 201);
  },
);

bridgeRouter.get("/draws", requireUser(), async (c) => {
  const account = c.get("account");
  const rows = await prisma.bridgeDraw.findMany({
    where: { userId: account.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  return c.json({ data: { items: rows.map(toDrawView) } });
});

export { bridgeRouter };
