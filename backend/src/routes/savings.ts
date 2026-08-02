import { Hono } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser, requireFinancialAccess } from "./auth";
import {
  createSavingsGoalSchema,
  savingsTransactionInputSchema,
  type SavingsGoalView,
  type SavingsTransactionView,
} from "../types";

/**
 * Savings — a self-service ledger, not a bank account.
 *
 * No bank rail exists yet (see AGENTS.md, "Disbursement/Repayment"), so a
 * deposit or withdrawal here is a self-reported bookkeeping entry: real
 * numbers the employee entered, not money PayBridge actually moved. This is
 * stated in the UI, not hidden — see webapp's SavingsSection. `balanceAfter`
 * on every transaction makes the ledger self-auditable without replaying the
 * whole history on every read.
 */
const savingsRouter = new Hono();

savingsRouter.use("*", requireUser(), requireFinancialAccess());
savingsRouter.use("/goals/:id/deposit", rateLimit({ name: "savings:deposit", limit: 30, windowMs: 60 * 60_000 }));
savingsRouter.use("/goals/:id/withdraw", rateLimit({ name: "savings:withdraw", limit: 30, windowMs: 60 * 60_000 }));

function toGoalView(row: {
  id: string;
  label: string;
  targetAmount: unknown;
  targetDate: Date | null;
  balance: unknown;
  status: string;
  createdAt: Date;
}): SavingsGoalView {
  return {
    id: row.id,
    label: row.label,
    targetAmount: row.targetAmount === null ? null : Number(row.targetAmount),
    targetDate: row.targetDate?.toISOString().slice(0, 10) ?? null,
    balance: Number(row.balance),
    status: row.status as SavingsGoalView["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

savingsRouter.get("/goals", async (c) => {
  const account = c.get("account");
  const rows = await prisma.savingsGoal.findMany({ where: { userId: account.id }, orderBy: { createdAt: "asc" } });
  return c.json({ data: { items: rows.map(toGoalView) } });
});

savingsRouter.post("/goals", validate("json", createSavingsGoalSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: account.id,
      label: input.label,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
    },
  });

  await record(c, {
    action: "savings.goal.created",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "savings_goal",
    targetId: goal.id,
  });

  return c.json({ data: toGoalView(goal) }, 201);
});

savingsRouter.get("/goals/:id/transactions", async (c) => {
  const account = c.get("account");
  const goal = await prisma.savingsGoal.findFirst({ where: { id: c.req.param("id"), userId: account.id } });
  if (!goal) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const rows = await prisma.savingsTransaction.findMany({ where: { goalId: goal.id }, orderBy: { createdAt: "desc" } });
  const items: SavingsTransactionView[] = rows.map((r) => ({
    id: r.id,
    type: r.type as SavingsTransactionView["type"],
    amount: Number(r.amount),
    note: r.note,
    balanceAfter: Number(r.balanceAfter),
    createdAt: r.createdAt.toISOString(),
  }));
  return c.json({ data: { items } });
});

savingsRouter.post("/goals/:id/deposit", validate("json", savingsTransactionInputSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const goal = await prisma.savingsGoal.findFirst({ where: { id: c.req.param("id"), userId: account.id } });
  if (!goal) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
  if (goal.status !== "active") {
    return c.json({ error: { message: "This goal is closed.", code: "GOAL_CLOSED" } }, 409);
  }

  const balanceAfter = Number(goal.balance) + input.amount;
  const [, transaction] = await prisma.$transaction([
    prisma.savingsGoal.update({ where: { id: goal.id }, data: { balance: balanceAfter } }),
    prisma.savingsTransaction.create({
      data: { goalId: goal.id, userId: account.id, type: "deposit", amount: input.amount, note: input.note || null, balanceAfter },
    }),
  ]);

  await record(c, {
    action: "savings.deposit.recorded",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "savings_goal",
    targetId: goal.id,
    detail: { amount: input.amount },
  });

  return c.json({
    data: {
      id: transaction.id,
      type: "deposit" as const,
      amount: input.amount,
      note: transaction.note,
      balanceAfter,
      createdAt: transaction.createdAt.toISOString(),
    },
  });
});

savingsRouter.post("/goals/:id/withdraw", validate("json", savingsTransactionInputSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const goal = await prisma.savingsGoal.findFirst({ where: { id: c.req.param("id"), userId: account.id } });
  if (!goal) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
  if (input.amount > Number(goal.balance)) {
    return c.json({ error: { message: "You cannot withdraw more than the goal's balance.", code: "INSUFFICIENT_BALANCE" } }, 409);
  }

  const balanceAfter = Number(goal.balance) - input.amount;
  const [, transaction] = await prisma.$transaction([
    prisma.savingsGoal.update({ where: { id: goal.id }, data: { balance: balanceAfter } }),
    prisma.savingsTransaction.create({
      data: { goalId: goal.id, userId: account.id, type: "withdrawal", amount: input.amount, note: input.note || null, balanceAfter },
    }),
  ]);

  await record(c, {
    action: "savings.withdrawal.recorded",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "savings_goal",
    targetId: goal.id,
    detail: { amount: input.amount },
  });

  return c.json({
    data: {
      id: transaction.id,
      type: "withdrawal" as const,
      amount: input.amount,
      note: transaction.note,
      balanceAfter,
      createdAt: transaction.createdAt.toISOString(),
    },
  });
});

export { savingsRouter };
