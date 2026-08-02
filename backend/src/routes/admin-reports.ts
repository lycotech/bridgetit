import { Hono } from "hono";
import { prisma } from "../db";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { record } from "../security/audit-store";
import type { AdminReportsOverviewView } from "../types";

/**
 * Reports — Admin → Reports.
 *
 * Portfolio-wide aggregates only — no individual customer's name, balance or
 * KYC detail appears here, by construction: every query below is a `count`/
 * `groupBy`/`aggregate`, never a `findMany` of rows with a person's name on
 * them. That is what makes `reports.view` safe to grant more broadly than
 * `risk.view` or `kyc.view`.
 */
const adminReportsRouter = new Hono();

adminReportsRouter.use("*", requireAdmin());
adminReportsRouter.use("*", requireAdminPermission("reports.view"));

adminReportsRouter.get("/overview", async (c) => {
  const staff = c.get("staff");

  const [employersByStatus, kycFunnel, exposure, cycles, draws, savings, investments] = await Promise.all([
    prisma.employer.groupBy({ by: ["status"], _count: true }),
    prisma.user.groupBy({ by: ["kycStatus"], _count: true }),
    prisma.creditLimit.aggregate({ where: { status: "active" }, _sum: { approvedAmount: true, availableAmount: true } }),
    prisma.payrollCycle.aggregate({ _count: true, _sum: { totalAmount: true } }),
    prisma.bridgeDraw.groupBy({ by: ["status"], _count: true, _sum: { approvedAmount: true } }),
    prisma.savingsGoal.aggregate({ _sum: { balance: true } }),
    prisma.investmentCommitment.aggregate({ where: { status: "committed" }, _sum: { amount: true } }),
  ]);

  const employersByTier = await prisma.employer.groupBy({
    by: ["currentTier"],
    _count: true,
    where: { currentTier: { not: null } },
  });

  const drawCount = (status: string) => draws.find((d) => d.status === status)?._count ?? 0;
  const approvedVolume = draws.find((d) => d.status === "approved")?._sum.approvedAmount ?? null;

  const view: AdminReportsOverviewView = {
    employersByStatus: employersByStatus.map((r) => ({ status: r.status, count: r._count })),
    employersByTier: employersByTier.map((r) => ({ tier: r.currentTier ?? "unscored", count: r._count })),
    kycFunnel: kycFunnel.map((r) => ({ status: r.kycStatus, count: r._count })),
    totalApprovedExposure: Number(exposure._sum.approvedAmount ?? 0),
    totalAvailableExposure: Number(exposure._sum.availableAmount ?? 0),
    payrollCyclesProcessed: cycles._count,
    totalPayrollProcessed: Number(cycles._sum.totalAmount ?? 0),
    bridgeDraws: {
      requested: drawCount("requested") + drawCount("approved") + drawCount("rejected"),
      approved: drawCount("approved"),
      rejected: drawCount("rejected"),
      approvedVolume: Number(approvedVolume ?? 0),
    },
    savingsTotalBalance: Number(savings._sum.balance ?? 0),
    investmentsTotalCommitted: Number(investments._sum.amount ?? 0),
    asOf: new Date().toISOString(),
  };

  await record(c, {
    action: "reports.viewed",
    outcome: "success",
    actorType: "admin",
    actorId: staff?.uid ?? staff?.sub ?? "unknown",
    actorLabel: staff?.sub ?? "unknown",
    targetType: null,
  });

  return c.json({ data: view });
});

export { adminReportsRouter };
