import { Hono } from "hono";
import { prisma } from "../db";
import { requireUser, requireFinancialAccess } from "./auth";
import { computePayBridgeScore } from "../scoring/paybridge-score";
import type { PayBridgeScoreView } from "../types";

/**
 * PayBridge Score — real counterpart of the demo-only mock "credit score".
 * See scoring/paybridge-score.ts for the formula. Computed fresh on every
 * request from live data (KYC status, employer-link tenure, savings
 * activity) — no persisted field, so it can never go stale.
 */
const creditScoreRouter = new Hono();

creditScoreRouter.use("*", requireUser(), requireFinancialAccess());

creditScoreRouter.get("/", async (c) => {
  const account = c.get("account");

  const [employeeRecord, activeSavingsGoal, depositCount] = await Promise.all([
    prisma.employeeRecord.findUnique({ where: { userId: account.id }, select: { createdAt: true } }),
    prisma.savingsGoal.findFirst({ where: { userId: account.id, status: "active" }, select: { id: true } }),
    prisma.savingsTransaction.count({ where: { userId: account.id, type: "deposit" } }),
  ]);

  const tenureMonths = employeeRecord
    ? Math.floor((Date.now() - employeeRecord.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  const result = computePayBridgeScore({
    kycStatus: account.kycStatus,
    tenureMonths,
    hasActiveSavingsGoal: activeSavingsGoal !== null,
    savingsDepositCount: depositCount,
  });

  const view: PayBridgeScoreView = {
    score: result.score,
    band: result.band,
    label: "PayBridge Score",
    disclaimer: "An internal PayBridge indicator, not a credit-bureau score.",
    signals: result.signals,
    computedAt: new Date().toISOString(),
  };

  return c.json({ data: view });
});

export { creditScoreRouter };
