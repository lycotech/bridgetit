import { Hono } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser, requireFinancialAccess } from "./auth";
import { computeEligibility } from "../bridge/eligibility";
import { computePayBridgeScore } from "../scoring/paybridge-score";
import { getAnthropicClient, isAiAssistantConfigured } from "../ai/client";
import { aiAssistantChatInputSchema, type AiAssistantChatResponseView } from "../types";

/**
 * AI Assistant — the real, live-Claude-backed chat on the customer's own
 * `/account` page (PRD.md's "AI Assistant" service, AGENTS.md §6 item 12).
 *
 * Deliberately NOT the same thing as AIAssistWidget.tsx (webapp/src/
 * components/account/AIAssistWidget.tsx), which stays exactly as it was —
 * a rules-based savings suggestion with no live model call. Both are kept,
 * by explicit user decision; this is a separate, general-purpose assistant.
 *
 * PRIVACY BOUNDARY: the model only ever sees a snapshot of the SIGNED-IN
 * customer's own data, assembled server-side from the same real routes every
 * other panel on this page reads (eligibility, Bridge draws, Savings,
 * PayBridge Score, PayBridge Account) — never another customer's data, never
 * anything from the employer/admin/operations side. Nothing the model says is
 * trusted back into the database: this route only ever reads and replies.
 */
const aiAssistantRouter = new Hono();

aiAssistantRouter.use("*", requireUser(), requireFinancialAccess());
aiAssistantRouter.use("/chat", rateLimit({ name: "ai-assistant:chat", limit: 20, windowMs: 60 * 60_000 }));

const SYSTEM_PROMPT = `You are the PayBridge AI Assistant, embedded on a customer's real PayBridge account page.

PayBridge is an earned-wage-access and financial-wellbeing platform that works AROUND an employer's existing payroll — it never replaces or duplicates payroll, and employees keep their existing bank account. PayBridge Access lets an eligible employee draw a portion of pay already earned in the current cycle, ahead of payday.

You will be given a snapshot of THIS customer's own real, current data. Rules:
- Only state facts that are in the snapshot below. Never invent a balance, score, date, or status.
- You are not a licensed financial adviser. Do not give personalised investment advice, tax advice, or legal advice. For anything regulated, tell the customer to speak with a qualified adviser or PayBridge support (support@getpaybridge.com).
- Never promise a guaranteed return, a fixed interest/yield figure, or that a deposit/withdrawal moves real money through a bank rail — PayBridge's Savings and Investments features are self-reported ledger entries today, not bank transfers. If asked about this, say so plainly.
- Never claim PayBridge disburses a Bridge draw as cash or collects a repayment automatically — no money-movement rail exists yet; a Bridge draw here only records an approved/rejected decision.
- Never call PayBridge Access "Bridger" as a name for the customer — refer to them as "you" or "employee".
- Keep replies short (2-4 sentences unless the customer asks for detail), warm, and plain-language for a non-technical reader.
- If a question is about something outside PayBridge (general chit-chat, unrelated topics), gently redirect to what you can help with here.`;

interface Snapshot {
  fullName: string;
  accountType: string;
  eligible: boolean;
  earnedWageEstimate: number | null;
  employerName: string | null;
  bridgeDrawCount: number;
  lastBridgeDraw: { status: string; requestedAmount: number; requestedAt: string } | null;
  savingsGoalCount: number;
  savingsTotalBalance: number;
  creditScore: number;
  creditBand: string;
  payBridgeAccountStatus: string;
  investmentCommittedCapital: number | null;
}

async function buildSnapshot(accountId: string, account: { fullName: string; accountType: string; kycStatus: string }): Promise<Snapshot> {
  const [eligibility, lastDraw, bridgeDrawCount, savingsGoals, employeeRecord, savingsDepositCount, payBridgeAccount, investmentAgg] =
    await Promise.all([
      computeEligibility(accountId, account.kycStatus),
      prisma.bridgeDraw.findFirst({ where: { userId: accountId }, orderBy: { requestedAt: "desc" } }),
      prisma.bridgeDraw.count({ where: { userId: accountId } }),
      prisma.savingsGoal.findMany({ where: { userId: accountId }, select: { balance: true } }),
      prisma.employeeRecord.findUnique({ where: { userId: accountId }, select: { createdAt: true } }),
      prisma.savingsTransaction.count({ where: { userId: accountId, type: "deposit" } }),
      prisma.payBridgeAccount.findUnique({ where: { userId: accountId }, select: { status: true } }),
      account.accountType === "investor"
        ? prisma.investmentCommitment.aggregate({
            where: { userId: accountId, status: "committed" },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
    ]);

  const tenureMonths = employeeRecord
    ? Math.floor((Date.now() - employeeRecord.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;
  const score = computePayBridgeScore({
    kycStatus: account.kycStatus,
    tenureMonths,
    hasActiveSavingsGoal: savingsGoals.length > 0,
    savingsDepositCount,
  });

  return {
    fullName: account.fullName,
    accountType: account.accountType,
    eligible: eligibility.view.eligible,
    earnedWageEstimate: eligibility.view.earnedWageEstimate,
    employerName: eligibility.view.employerName,
    bridgeDrawCount,
    lastBridgeDraw: lastDraw
      ? { status: lastDraw.status, requestedAmount: Number(lastDraw.requestedAmount), requestedAt: lastDraw.requestedAt.toISOString() }
      : null,
    savingsGoalCount: savingsGoals.length,
    savingsTotalBalance: savingsGoals.reduce((sum, g) => sum + Number(g.balance), 0),
    creditScore: score.score,
    creditBand: score.band,
    payBridgeAccountStatus: payBridgeAccount?.status ?? "pending",
    investmentCommittedCapital: investmentAgg ? Number(investmentAgg._sum.amount ?? 0) : null,
  };
}

function snapshotToPrompt(s: Snapshot): string {
  const lines = [
    `Customer: ${s.fullName} (${s.accountType} account)`,
    `Bridge eligibility: ${s.eligible ? "eligible" : "not currently eligible"}${s.employerName ? ` — employer: ${s.employerName}` : ""}`,
    s.earnedWageEstimate !== null ? `Estimated earned pay available this cycle: ₦${s.earnedWageEstimate.toLocaleString("en-NG")}` : null,
    `Bridge draws so far: ${s.bridgeDrawCount}`,
    s.lastBridgeDraw
      ? `Most recent Bridge draw: ₦${s.lastBridgeDraw.requestedAmount.toLocaleString("en-NG")}, status ${s.lastBridgeDraw.status}, requested ${s.lastBridgeDraw.requestedAt}`
      : "No Bridge draws yet.",
    `Savings: ${s.savingsGoalCount} goal(s), total recorded balance ₦${s.savingsTotalBalance.toLocaleString("en-NG")} (self-reported ledger, no bank rail)`,
    `PayBridge Score: ${s.creditScore} (${s.creditBand}) — internal indicator, not a credit-bureau score`,
    `PayBridge Account status: ${s.payBridgeAccountStatus}`,
    s.investmentCommittedCapital !== null
      ? `Investor committed capital: ₦${s.investmentCommittedCapital.toLocaleString("en-NG")} (recorded, not transferred — no yield figure exists)`
      : null,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

aiAssistantRouter.post("/chat", validate("json", aiAssistantChatInputSchema), async (c) => {
  if (!isAiAssistantConfigured()) {
    return c.json(
      { error: { message: "The AI Assistant is not configured yet. Please try again later.", code: "AI_NOT_CONFIGURED" } },
      503,
    );
  }

  const account = c.get("account");
  const input = c.req.valid("json");

  const snapshot = await buildSnapshot(account.id, account);

  const client = getAnthropicClient();

  let reply: string;
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: `Current data snapshot for this customer:\n${snapshotToPrompt(snapshot)}`, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        ...input.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: input.message },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    reply = textBlock && textBlock.type === "text" ? textBlock.text : "I couldn't put together a reply just now — please try again.";
  } catch (err) {
    await record(c, {
      action: "ai_assistant.chat.error",
      outcome: "failure",
      actorType: "user",
      actorId: account.id,
      actorLabel: account.email,
      targetType: "ai_assistant",
      targetId: account.id,
      detail: { message: err instanceof Error ? err.message : "unknown error" },
    });
    return c.json(
      { error: { message: "The AI Assistant could not respond right now. Please try again shortly.", code: "AI_REQUEST_FAILED" } },
      502,
    );
  }

  await record(c, {
    action: "ai_assistant.chat.replied",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "ai_assistant",
    targetId: account.id,
  });

  const view: AiAssistantChatResponseView = { reply };
  return c.json({ data: view });
});

export { aiAssistantRouter };
