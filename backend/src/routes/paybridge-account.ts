import { Hono } from "hono";
import { prisma } from "../db";
import { requireUser, requireFinancialAccess } from "./auth";
import { decryptField } from "../security/field-crypto";
import type { PayBridgeAccountView } from "../types";

/**
 * PayBridge Account — a general-purpose PayBridge-managed account, distinct
 * from Salary Account (routes/salary-account.ts, which is specifically about
 * payroll routing). No real bank-issuing partner exists yet, so this is
 * "pending" for every user today — real state to read ("coming soon"), not a
 * hardcoded frontend string, and a future partner integration is a status
 * transition on this existing row rather than a new table.
 *
 * Deliberately no issuance route: there is nothing to issue an account
 * number against yet.
 */
const payBridgeAccountRouter = new Hono();

payBridgeAccountRouter.use("*", requireUser(), requireFinancialAccess());

payBridgeAccountRouter.get("/", async (c) => {
  const account = c.get("account");

  const row = await prisma.payBridgeAccount.upsert({
    where: { userId: account.id },
    update: {},
    create: { userId: account.id },
  });

  const view: PayBridgeAccountView = {
    id: row.id,
    status: row.status as PayBridgeAccountView["status"],
    bankName: row.bankName,
    accountName: decryptField(row.accountNameEnc),
    accountNumberMasked: row.accountNumberLast4 ? `•••• ${row.accountNumberLast4}` : null,
    createdAt: row.createdAt.toISOString(),
  };

  return c.json({ data: view });
});

export { payBridgeAccountRouter };
