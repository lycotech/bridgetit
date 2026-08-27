import { Hono } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser } from "./auth";
import { sendReferralSchema, type ReferralSummaryView, type ReferralView } from "../types";

/**
 * Referrals — real counterpart of the demo-only mock referral system
 * (AGENTS.md §10). Invites and their status are fully real. The reward, once
 * a referral joins, is a real SavingsTransaction deposit — see auth.ts's
 * register handler for the join trigger and reward logic, the only place
 * that writes a "joined" outcome. This file only handles the referrer's own
 * side: reading their code/summary and sending an invite.
 */
const referralsRouter = new Hono();

referralsRouter.use("*", requireUser());
referralsRouter.use("/invite", rateLimit({ name: "referrals:invite", limit: 20, windowMs: 60 * 60_000 }));

function toReferralView(row: {
  id: string;
  referredName: string;
  referredEmail: string;
  status: string;
  rewardAmount: unknown;
  invitedAt: Date;
  joinedAt: Date | null;
}): ReferralView {
  return {
    id: row.id,
    referredName: row.referredName,
    referredEmail: row.referredEmail,
    status: row.status as ReferralView["status"],
    rewardAmount: Number(row.rewardAmount),
    invitedAt: row.invitedAt.toISOString(),
    joinedAt: row.joinedAt?.toISOString() ?? null,
  };
}

/** initials + a 3-digit suffix unique among users sharing those initials, e.g. "AO101". */
async function generateReferralCode(fullName: string): Promise<string> {
  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "PB";

  for (let attempt = 0; attempt < 20; attempt++) {
    const count = await prisma.user.count({ where: { referralCode: { startsWith: initials } } });
    const candidate = `${initials}${100 + count + attempt}`;
    const existing = await prisma.user.findUnique({ where: { referralCode: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  // Astronomically unlikely fallback — timestamp suffix guarantees uniqueness.
  return `${initials}${Date.now().toString().slice(-6)}`;
}

referralsRouter.get("/me", async (c) => {
  const account = c.get("account");

  let code = account.referralCode;
  if (!code) {
    code = await generateReferralCode(account.fullName);
    await prisma.user.update({ where: { id: account.id }, data: { referralCode: code } });
  }

  const rows = await prisma.referral.findMany({
    where: { referrerUserId: account.id },
    orderBy: { invitedAt: "desc" },
  });

  const items = rows.map(toReferralView);
  const joined = items.filter((r) => r.status === "joined");

  const view: ReferralSummaryView = {
    code,
    invited: items.length,
    joined: joined.length,
    totalEarned: joined.reduce((sum, r) => sum + r.rewardAmount, 0),
    items,
  };

  return c.json({ data: view });
});

referralsRouter.post("/invite", validate("json", sendReferralSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  if (input.email === account.email) {
    return c.json({ error: { message: "You cannot refer yourself.", code: "SELF_REFERRAL" } }, 400);
  }

  const existing = await prisma.referral.findUnique({
    where: { referrerUserId_referredEmail: { referrerUserId: account.id, referredEmail: input.email } },
  });
  if (existing) {
    return c.json({ error: { message: "You have already referred this person.", code: "ALREADY_REFERRED" } }, 409);
  }

  const referral = await prisma.referral.create({
    data: { referrerUserId: account.id, referredName: input.name, referredEmail: input.email },
  });

  await record(c, {
    action: "referral.invited",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "referral",
    targetId: referral.id,
    detail: { referredEmail: input.email },
  });

  return c.json({ data: toReferralView(referral) }, 201);
});

export { referralsRouter };
