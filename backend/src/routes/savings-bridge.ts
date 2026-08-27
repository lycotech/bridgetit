import { Hono } from "hono";
import type { Context } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser, requireFinancialAccess } from "./auth";
import { requestSavingsBridgeSchema, type SavingsBridgeDrawView } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ELIGIBLE_AFTER_DAYS = 30;
const ELIGIBLE_FRACTION = 0.5;

/**
 * Savings Bridge — a draw against 50% of a savings goal held 30+ days. Real
 * counterpart of the demo-only mock "bridge from savings" (AGENTS.md §10).
 *
 * Deliberately independent from routes/bridge.ts / BridgeDraw: that model's
 * employerId/limitId are required and mean employer-facility funding, which
 * this is not — it draws against the employee's own savings, not a
 * pre-approved employer credit facility.
 *
 * WHAT THIS DOES NOT DO, same honesty bar as ordinary Bridge: no money
 * "disburses" anywhere. `status` stops at approved/rejected. Approval only
 * moves the balance from the savings goal to a withdrawal record — exactly
 * what routes/savings.ts's own withdraw endpoint already does, reused here
 * verbatim rather than reinvented.
 */
const savingsBridgeRouter = new Hono();

savingsBridgeRouter.use("*", requireUser(), requireFinancialAccess());
savingsBridgeRouter.use("/request", rateLimit({ name: "savings-bridge:request", limit: 10, windowMs: 60 * 60_000 }));

function fail(c: Context, status: 404, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

function eligibleAmount(balance: number, createdAt: Date): number {
  const ageDays = (Date.now() - createdAt.getTime()) / DAY_MS;
  if (ageDays < ELIGIBLE_AFTER_DAYS) return 0;
  return Math.floor(balance * ELIGIBLE_FRACTION);
}

function toDrawView(row: {
  id: string;
  reference: string;
  goalId: string;
  requestedAmount: unknown;
  approvedAmount: unknown;
  status: string;
  rejectionReason: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}): SavingsBridgeDrawView {
  return {
    id: row.id,
    reference: row.reference,
    goalId: row.goalId,
    requestedAmount: Number(row.requestedAmount),
    approvedAmount: row.approvedAmount === null ? null : Number(row.approvedAmount),
    status: row.status as SavingsBridgeDrawView["status"],
    rejectionReason: row.rejectionReason,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

async function nextReference(): Promise<string> {
  const count = await prisma.savingsBridgeDraw.count();
  return `SBR-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

savingsBridgeRouter.post("/request", validate("json", requestSavingsBridgeSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const goal = await prisma.savingsGoal.findFirst({
    where: { id: input.goalId, userId: account.id, status: "active" },
  });
  if (!goal) return fail(c, 404, "NOT_FOUND", "Savings goal not found.");

  const balance = Number(goal.balance);
  const eligible = eligibleAmount(balance, goal.createdAt);
  const ageDays = Math.floor((Date.now() - goal.createdAt.getTime()) / DAY_MS);

  let rejectionReason: string | null = null;
  if (ageDays < ELIGIBLE_AFTER_DAYS) {
    rejectionReason = `This goal becomes Bridge-eligible ${ELIGIBLE_AFTER_DAYS} days after it starts — it is currently ${ageDays} day${ageDays === 1 ? "" : "s"} old.`;
  } else if (input.amount > eligible) {
    rejectionReason = `You can Bridge up to ₦${eligible.toLocaleString("en-NG")} of this goal today.`;
  }

  const reference = await nextReference();

  const draw = await (rejectionReason
    ? prisma.savingsBridgeDraw.create({
        data: {
          userId: account.id,
          goalId: goal.id,
          reference,
          requestedAmount: input.amount,
          eligibleAmount: eligible,
          status: "rejected",
          rejectionReason,
          decidedAt: new Date(),
          decidedBy: "system",
          decidedByLabel: "Automatic decision",
        },
      })
    : prisma.$transaction(async (tx) => {
        const balanceAfter = balance - input.amount;
        const transaction = await tx.savingsTransaction.create({
          data: {
            goalId: goal.id,
            userId: account.id,
            type: "withdrawal",
            amount: input.amount,
            note: `Bridge from savings — ${reference}`,
            balanceAfter,
          },
        });
        await tx.savingsGoal.update({ where: { id: goal.id }, data: { balance: balanceAfter } });
        return tx.savingsBridgeDraw.create({
          data: {
            userId: account.id,
            goalId: goal.id,
            reference,
            requestedAmount: input.amount,
            approvedAmount: input.amount,
            eligibleAmount: eligible,
            status: "approved",
            decidedAt: new Date(),
            decidedBy: "system",
            decidedByLabel: "Automatic decision",
            withdrawalTransactionId: transaction.id,
          },
        });
      }));

  await record(c, {
    action: rejectionReason ? "savings_bridge.rejected" : "savings_bridge.approved",
    outcome: rejectionReason ? "denied" : "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "savings_bridge_draw",
    targetId: draw.id,
    detail: { reference, requestedAmount: input.amount },
  });

  // Always 201, same reasoning as bridge.ts: a rejection is a normal outcome
  // read from data.status, not an HTTP error.
  return c.json({ data: toDrawView(draw) }, 201);
});

savingsBridgeRouter.get("/draws", async (c) => {
  const account = c.get("account");
  const rows = await prisma.savingsBridgeDraw.findMany({
    where: { userId: account.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  return c.json({ data: { items: rows.map(toDrawView) } });
});

export { savingsBridgeRouter };
