import { Hono } from "hono";
import { prisma } from "../db";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import type { AdminInvestorListItem } from "../types";

/**
 * Admin → Investors — the real directory that was missing: `/admin/reports`
 * only ever shows a platform-wide committed-capital total (by design, see
 * that route's header), so staff had no way to see WHICH investors hold
 * WHAT. This lists real `accountType === "investor"` customers with their
 * real `InvestmentCommitment` totals, computed fresh on every request the
 * same way `/api/investments/portfolio` does for the customer themselves.
 *
 * No yield/return figure — same honesty limitation as the customer-facing
 * Investments panel (backend/src/routes/investments.ts), because none
 * exists anywhere in this system.
 */
const adminInvestorsRouter = new Hono();

adminInvestorsRouter.use("*", requireAdmin());
adminInvestorsRouter.use("*", requireAdminPermission("investors.view"));

adminInvestorsRouter.get("/", async (c) => {
  const q = c.req.query("q")?.trim();

  const users = await prisma.user.findMany({
    where: {
      accountType: "investor",
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, fullName: true, email: true, kycStatus: true, status: true, createdAt: true },
  });

  const commitments = await prisma.investmentCommitment.groupBy({
    by: ["userId", "status"],
    where: { userId: { in: users.map((u) => u.id) } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const items: AdminInvestorListItem[] = users.map((u) => {
    const committed = commitments.find((row) => row.userId === u.id && row.status === "committed");
    const withdrawn = commitments.find((row) => row.userId === u.id && row.status === "withdrawn");
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      kycStatus: u.kycStatus,
      status: u.status,
      committedCapital: Number(committed?._sum.amount ?? 0),
      withdrawnCapital: Number(withdrawn?._sum.amount ?? 0),
      activeCommitmentCount: committed?._count._all ?? 0,
      joinedAt: u.createdAt.toISOString(),
    };
  });

  return c.json({ data: { items } });
});

export { adminInvestorsRouter };
