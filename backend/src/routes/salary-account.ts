import { Hono } from "hono";
import type { Context } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser, requireFinancialAccess } from "./auth";
import { encryptField, last4 } from "../security/field-crypto";
import { clientIp } from "../security/client-ip";
import { requestSalaryAccountSchema, PARTNER_BANK_NAME_DEFAULT, type SalaryAccountRequestView } from "../types";

/**
 * Salary Account — employee-facing side of the real counterpart to the
 * demo-only mock feature described in AGENTS.md §9.
 *
 * An employee who is linked to an employer's payroll roster can request that
 * their payroll destination be moved to a PayBridge-managed account. This
 * route only ever creates a request; approving it (routes/
 * employer-salary-accounts.ts) is the only thing that writes to
 * EmployeeRecord.payrollAccount* — nothing here moves money or changes
 * payroll processing itself.
 *
 * Gated on requireFinancialAccess() (KYC-approved), same bar as Savings and
 * Bridge: redirecting someone's payroll destination is a fraud target, so
 * this is treated as a financial feature even though no money physically
 * moves yet.
 */
const salaryAccountRouter = new Hono();

salaryAccountRouter.use("*", requireUser(), requireFinancialAccess());
salaryAccountRouter.use("/request", rateLimit({ name: "salary-account:request", limit: 10, windowMs: 60 * 60_000 }));

function fail(c: Context, status: 403 | 409, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

function toRequestView(row: {
  id: string;
  reference: string;
  status: string;
  newBankName: string;
  newAccountLast4: string;
  requestedAt: Date;
  decidedAt: Date | null;
  rejectionReason: string | null;
}): SalaryAccountRequestView {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status as SalaryAccountRequestView["status"],
    newBankName: row.newBankName,
    newAccountMasked: `•••• ${row.newAccountLast4}`,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
  };
}

async function nextReference(): Promise<string> {
  const count = await prisma.salaryAccountRequest.count();
  return `SAR-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

salaryAccountRouter.post("/request", validate("json", requestSalaryAccountSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const employeeRecord = await prisma.employeeRecord.findUnique({ where: { userId: account.id } });
  if (!employeeRecord) {
    return fail(c, 403, "NOT_LINKED", "You are not linked to an employer's payroll yet.");
  }

  const openRequest = await prisma.salaryAccountRequest.findFirst({
    where: { employeeRecordId: employeeRecord.id, status: { in: ["pending_review", "active"] } },
  });
  if (openRequest) {
    return fail(c, 409, "REQUEST_ALREADY_OPEN", "You already have a Salary Account request in progress.");
  }

  const reference = await nextReference();
  const partnerBank = process.env.PARTNER_BANK_NAME ?? PARTNER_BANK_NAME_DEFAULT;
  const deviceRef = `${c.req.header("user-agent") ?? "unknown device"} · ${clientIp(c) ?? "unknown IP"}`;

  const created = await prisma.salaryAccountRequest.create({
    data: {
      userId: account.id,
      employeeRecordId: employeeRecord.id,
      employerId: employeeRecord.employerId,
      reference,
      currentBankName: employeeRecord.payrollBankName,
      currentAccountLast4: employeeRecord.payrollAccountLast4,
      newBankName: partnerBank,
      newAccountNameEnc: encryptField(input.accountName),
      newAccountNumberEnc: encryptField(input.accountNumber),
      newAccountLast4: last4(input.accountNumber),
      consentDeviceRef: deviceRef,
      consentReferenceId: `CNS-${reference}`,
    },
  });

  await record(c, {
    action: "salary_account.requested",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "salary_account_request",
    targetId: created.id,
    detail: { reference },
  });

  return c.json({ data: toRequestView(created) }, 201);
});

salaryAccountRouter.get("/requests", async (c) => {
  const account = c.get("account");
  const rows = await prisma.salaryAccountRequest.findMany({
    where: { userId: account.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  return c.json({ data: { items: rows.map(toRequestView) } });
});

export { salaryAccountRouter };
