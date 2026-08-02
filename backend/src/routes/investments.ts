import { Hono } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser, requireFinancialAccess } from "./auth";
import {
  createInvestmentCommitmentSchema,
  type InvestmentCommitmentView,
  type PortfolioSnapshotView,
} from "../types";

/**
 * Investments — a capital-commitment ledger for capital-partner accounts.
 *
 * Same honesty limitation as Savings: a commitment is recorded here, not
 * transferred — no payment rail exists yet. `GET /portfolio` is the part
 * that IS real: it reports actual portfolio statistics computed from
 * Employer/CreditLimit/BridgeDraw, so an investor sees what their capital is
 * genuinely funding. It deliberately never reports a return/yield figure —
 * there is no interest-distribution model anywhere in this codebase, and
 * inventing one here would be fabricating a financial promise this project
 * has not made.
 */
const investmentsRouter = new Hono();

investmentsRouter.use("*", requireUser(), requireFinancialAccess());
investmentsRouter.use("/commitments", rateLimit({ name: "investments:commit", limit: 20, windowMs: 60 * 60_000 }));

function toCommitmentView(row: {
  id: string;
  amount: unknown;
  status: string;
  note: string | null;
  committedAt: Date;
  withdrawnAt: Date | null;
}): InvestmentCommitmentView {
  return {
    id: row.id,
    amount: Number(row.amount),
    status: row.status as InvestmentCommitmentView["status"],
    note: row.note,
    committedAt: row.committedAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
  };
}

investmentsRouter.get("/commitments", async (c) => {
  const account = c.get("account");
  const rows = await prisma.investmentCommitment.findMany({
    where: { userId: account.id },
    orderBy: { committedAt: "desc" },
  });
  return c.json({ data: { items: rows.map(toCommitmentView) } });
});

investmentsRouter.post("/commitments", validate("json", createInvestmentCommitmentSchema), async (c) => {
  const account = c.get("account");
  if (account.accountType !== "investor") {
    return c.json(
      { error: { message: "Only a capital-partner account can commit capital.", code: "NOT_AN_INVESTOR" } },
      403,
    );
  }
  const input = c.req.valid("json");

  const commitment = await prisma.investmentCommitment.create({
    data: { userId: account.id, amount: input.amount, note: input.note || null },
  });

  await record(c, {
    action: "investment.commitment.recorded",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "investment_commitment",
    targetId: commitment.id,
    detail: { amount: input.amount },
  });

  return c.json({ data: toCommitmentView(commitment) }, 201);
});

investmentsRouter.post("/commitments/:id/withdraw", async (c) => {
  const account = c.get("account");
  const commitment = await prisma.investmentCommitment.findFirst({
    where: { id: c.req.param("id"), userId: account.id },
  });
  if (!commitment) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
  if (commitment.status === "withdrawn") {
    return c.json({ error: { message: "This commitment has already been withdrawn.", code: "ALREADY_WITHDRAWN" } }, 409);
  }

  const updated = await prisma.investmentCommitment.update({
    where: { id: commitment.id },
    data: { status: "withdrawn", withdrawnAt: new Date() },
  });

  await record(c, {
    action: "investment.commitment.withdrawn",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "investment_commitment",
    targetId: commitment.id,
  });

  return c.json({ data: toCommitmentView(updated) });
});

/**
 * GET /portfolio — the real numbers. What every committed naira is actually
 * funding, computed live from the credit-risk and Bridge data built earlier
 * in this project (see AGENTS.md §2).
 */
investmentsRouter.get("/portfolio", async (c) => {
  const account = c.get("account");

  const [employersByStatus, employersByTier, exposure, draws, payroll, committed, yours] = await Promise.all([
    prisma.employer.groupBy({ by: ["status"], _count: true }),
    prisma.employer.groupBy({ by: ["currentTier"], _count: true, where: { currentTier: { not: null } } }),
    prisma.creditLimit.aggregate({
      where: { status: "active" },
      _sum: { approvedAmount: true, availableAmount: true },
    }),
    prisma.bridgeDraw.aggregate({
      where: { status: "approved" },
      _count: true,
      _sum: { approvedAmount: true },
    }),
    prisma.payrollCycle.aggregate({ _sum: { totalAmount: true } }),
    prisma.investmentCommitment.aggregate({ where: { status: "committed" }, _sum: { amount: true } }),
    prisma.investmentCommitment.aggregate({
      where: { status: "committed", userId: account.id },
      _sum: { amount: true },
    }),
  ]);

  const view: PortfolioSnapshotView = {
    totalEmployers: employersByStatus.reduce((sum, r) => sum + r._count, 0),
    activeEmployers: employersByStatus.find((r) => r.status === "active")?._count ?? 0,
    tierDistribution: employersByTier.map((r) => ({ tier: r.currentTier ?? "unscored", count: r._count })),
    totalApprovedExposure: Number(exposure._sum.approvedAmount ?? 0),
    totalAvailableExposure: Number(exposure._sum.availableAmount ?? 0),
    bridgeDrawsApprovedCount: draws._count,
    bridgeDrawsApprovedVolume: Number(draws._sum.approvedAmount ?? 0),
    totalPayrollProcessed: Number(payroll._sum.totalAmount ?? 0),
    totalCommittedCapital: Number(committed._sum.amount ?? 0),
    yourCommittedCapital: Number(yours._sum.amount ?? 0),
    asOf: new Date().toISOString(),
  };

  return c.json({ data: view });
});

export { investmentsRouter };
