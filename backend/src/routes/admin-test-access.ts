import { Hono } from "hono";
import type { Context } from "hono";
import { prisma } from "../db";
import { requireAdmin, requireAdminPermission } from "../security/staff-session";
import { hashPassword, generateStrongPassword } from "../security/passwords";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { loadActivePolicy } from "../eir/policy-store";
import {
  resetTestAccessPasswordSchema,
  type ResetTestAccessPasswordInput,
  type TestAccessProvisionResult,
  type TestAccessStatusView,
} from "../types";

/**
 * Admin → Test accounts — three standing, real, fully-eligible fixture
 * accounts (one employer, one employee, one investor) a Super Admin
 * provisions once and reuses indefinitely to check any real portal, instead
 * of registering a brand-new real account through the ordinary signup flow
 * every time.
 *
 * DELIBERATELY NOT IMPERSONATION: there is no session-minting shortcut here,
 * no bypass of any password check anywhere. Each fixture is a completely
 * real row — real password hash, real KYC-approved status, a real linked
 * employer with a real payroll cycle and a real active `ewa` credit limit —
 * so the employee fixture can genuinely request a Bridge draw and the
 * investor fixture can genuinely commit capital. You log into each one
 * through the ordinary `/sign-in` or `/employer-portal/login` forms, with
 * the email/password this route hands you.
 *
 * A generated password is returned exactly once, at the moment it is set —
 * on first provisioning, or after an explicit reset. It is never stored in
 * plaintext and never re-shown after that.
 */
const adminTestAccessRouter = new Hono();

adminTestAccessRouter.use("*", requireAdmin());
adminTestAccessRouter.use("*", requireAdminPermission("test_access.manage"));

const QA_EMPLOYER_USER_EMAIL = "qa-employer@internal.getpaybridge.com";
const QA_EMPLOYEE_EMAIL = "qa-employee@internal.getpaybridge.com";
const QA_INVESTOR_EMAIL = "qa-investor@internal.getpaybridge.com";
const QA_EMPLOYER_NAME = "PayBridge Internal QA Employer";
const QA_STAFF_REF = "QA-0001";

function actor(c: Context): { id: string; label: string } {
  const staff = c.get("staff");
  return { id: staff?.uid ?? staff?.sub ?? "unknown", label: staff?.sub ?? "unknown" };
}

async function ensureApplication(employerId: string): Promise<string> {
  const existing = await prisma.application.findFirst({ where: { employerId }, orderBy: { createdAt: "desc" } });
  if (existing) return existing.id;
  const count = await prisma.application.count();
  const created = await prisma.application.create({
    data: { employerId, reference: `QA-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`, stage: "scoring" },
  });
  return created.id;
}

/** A real active `ewa` facility — without this, a Bridge draw request has nothing to approve against. */
async function ensureCreditLimit(employerId: string, who: { id: string; label: string }): Promise<void> {
  const existing = await prisma.creditLimit.findFirst({ where: { employerId, product: "ewa", status: "active" } });
  if (existing) return;

  const applicationId = await ensureApplication(employerId);
  const { policyVersionId } = await loadActivePolicy();

  const decision = await prisma.creditDecision.create({
    data: {
      employerId,
      applicationId,
      policyVersionId,
      decision: "approve",
      reason: "Internal QA fixture — auto-provisioned for Admin Console test access.",
      decidedBy: who.id,
      decidedByLabel: who.label,
      decidedByRole: "super_admin",
      authorityLevel: "credit_administrator",
      approvedLimit: 1_000_000,
    },
  });

  await prisma.creditLimit.create({
    data: {
      employerId,
      applicationId,
      decisionId: decision.id,
      product: "ewa",
      approvedAmount: 1_000_000,
      availableAmount: 1_000_000,
      status: "active",
    },
  });
}

/** A real payroll record for the current cycle — without this, earned-wage estimate is zero and payrollVerified is false. */
async function ensurePayroll(employerId: string, employeeRecordId: string): Promise<void> {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const expectedPayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const cycle = await prisma.payrollCycle.upsert({
    where: { employerId_periodStart: { employerId, periodStart } },
    update: {},
    create: {
      employerId,
      periodStart,
      expectedPayDate,
      totalAmount: 300_000,
      employeeCount: 1,
      timeliness: "on_time",
      source: "payroll_upload",
    },
  });

  const existingRecord = await prisma.payrollRecord.findFirst({ where: { cycleId: cycle.id, employeeId: employeeRecordId } });
  if (existingRecord) return;

  await prisma.payrollRecord.create({
    data: {
      cycleId: cycle.id,
      employeeId: employeeRecordId,
      staffRef: QA_STAFF_REF,
      grossPay: 300_000,
      netPay: 250_000,
      paymentStatus: "paid",
    },
  });
}

async function ensureQaEmployer(): Promise<{ employerId: string; employerUserId: string; password: string | null }> {
  const existingUser = await prisma.employerUser.findUnique({ where: { email: QA_EMPLOYER_USER_EMAIL } });
  if (existingUser) return { employerId: existingUser.employerId, employerUserId: existingUser.id, password: null };

  const employer = await prisma.employer.create({
    data: { registeredName: QA_EMPLOYER_NAME, status: "active", industry: "Internal QA" },
  });

  const password = generateStrongPassword();
  const employerUser = await prisma.employerUser.create({
    data: {
      employerId: employer.id,
      email: QA_EMPLOYER_USER_EMAIL,
      fullName: "QA Employer Admin",
      role: "employer_admin",
      status: "active",
      passwordHash: await hashPassword(password),
    },
  });

  return { employerId: employer.id, employerUserId: employerUser.id, password };
}

async function ensureQaEmployee(employerId: string, who: { id: string; label: string }): Promise<{ password: string | null }> {
  const existingUser = await prisma.user.findUnique({ where: { email: QA_EMPLOYEE_EMAIL } });
  let userId: string;
  let password: string | null = null;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    password = generateStrongPassword();
    const user = await prisma.user.create({
      data: {
        email: QA_EMPLOYEE_EMAIL,
        fullName: "QA Employee",
        accountType: "employee",
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
        kycStatus: "approved",
        kycSubmittedAt: new Date(),
        kycReviewedAt: new Date(),
        kycReviewedBy: who.id,
      },
    });
    userId = user.id;
  }

  const employeeRecord = await prisma.employeeRecord.upsert({
    where: { employerId_staffRef: { employerId, staffRef: QA_STAFF_REF } },
    update: { userId, status: "active" },
    create: { employerId, staffRef: QA_STAFF_REF, status: "active", userId },
  });

  await ensurePayroll(employerId, employeeRecord.id);
  await ensureCreditLimit(employerId, who);

  return { password };
}

async function ensureQaInvestor(): Promise<{ password: string | null }> {
  const existing = await prisma.user.findUnique({ where: { email: QA_INVESTOR_EMAIL } });
  if (existing) return { password: null };

  const password = generateStrongPassword();
  await prisma.user.create({
    data: {
      email: QA_INVESTOR_EMAIL,
      fullName: "QA Investor",
      accountType: "investor",
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      kycStatus: "approved",
      kycSubmittedAt: new Date(),
      kycReviewedAt: new Date(),
    },
  });
  return { password };
}

adminTestAccessRouter.get("/status", async (c) => {
  const [employerUser, employee, investor] = await Promise.all([
    prisma.employerUser.findUnique({ where: { email: QA_EMPLOYER_USER_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: QA_EMPLOYEE_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: QA_INVESTOR_EMAIL }, select: { id: true } }),
  ]);
  const view: TestAccessStatusView = {
    employer: { provisioned: Boolean(employerUser), email: QA_EMPLOYER_USER_EMAIL },
    employee: { provisioned: Boolean(employee), email: QA_EMPLOYEE_EMAIL },
    investor: { provisioned: Boolean(investor), email: QA_INVESTOR_EMAIL },
  };
  return c.json({ data: view });
});

adminTestAccessRouter.post("/provision", async (c) => {
  const who = actor(c);

  const { employerId, password: employerPassword } = await ensureQaEmployer();
  const { password: employeePassword } = await ensureQaEmployee(employerId, who);
  const { password: investorPassword } = await ensureQaInvestor();

  await record(c, {
    action: "admin_test_access.provisioned",
    outcome: "success",
    actorType: "admin",
    actorId: who.id,
    actorLabel: who.label,
    targetType: "test_access",
  });

  const view: TestAccessProvisionResult = {
    employer: { email: QA_EMPLOYER_USER_EMAIL, password: employerPassword },
    employee: { email: QA_EMPLOYEE_EMAIL, password: employeePassword },
    investor: { email: QA_INVESTOR_EMAIL, password: investorPassword },
  };
  return c.json({ data: view });
});

adminTestAccessRouter.post("/reset-password", validate("json", resetTestAccessPasswordSchema), async (c) => {
  const who = actor(c);
  const { which } = c.req.valid("json") as ResetTestAccessPasswordInput;

  const password = generateStrongPassword();
  const passwordHash = await hashPassword(password);
  const resetFields = { passwordHash, failedLoginCount: 0, lockedUntil: null, sessionEpoch: { increment: 1 } } as const;

  if (which === "employer") {
    await prisma.employerUser.update({ where: { email: QA_EMPLOYER_USER_EMAIL }, data: resetFields });
  } else if (which === "employee") {
    await prisma.user.update({ where: { email: QA_EMPLOYEE_EMAIL }, data: resetFields });
  } else {
    await prisma.user.update({ where: { email: QA_INVESTOR_EMAIL }, data: resetFields });
  }

  await record(c, {
    action: "admin_test_access.password_reset",
    outcome: "success",
    actorType: "admin",
    actorId: who.id,
    actorLabel: who.label,
    targetType: "test_access",
    detail: { which },
  });

  return c.json({ data: { password } });
});

export { adminTestAccessRouter };
