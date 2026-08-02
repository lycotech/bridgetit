import { Hono } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireUser } from "./auth";
import { verifyEmployeeLinkInvite } from "../security/employee-link";
import { computeEligibility } from "../bridge/eligibility";
import { acceptEmployeeLinkSchema } from "../types";

/**
 * The customer side of the payroll link, plus the eligibility checklist that
 * depends on it — Account → (once linked) Eligibility.
 *
 * "Employment verified" in PRD.md's Business Rules means exactly one thing in
 * this codebase: the signed-in `User` has a `EmployeeRecord.userId` pointing
 * back at them. Nothing here can fabricate that link — it only exists once
 * either side has proven it (the employer issued the invite; the customer
 * holds a matching, unexpired token).
 */
const employeeLinkRouter = new Hono();

employeeLinkRouter.use("/link", rateLimit({ name: "employee:link", limit: 10, windowMs: 60 * 60_000 }));

employeeLinkRouter.post("/link", requireUser(), validate("json", acceptEmployeeLinkSchema), async (c) => {
  const account = c.get("account");
  const input = c.req.valid("json");

  const verified = verifyEmployeeLinkInvite(input.token);
  if (!verified) {
    return c.json({ error: { message: "This link is invalid or has expired.", code: "INVALID_TOKEN" } }, 400);
  }
  if (verified.email !== account.email) {
    return c.json(
      {
        error: {
          message: "This invitation was issued to a different email address than your account.",
          code: "EMAIL_MISMATCH",
        },
      },
      403,
    );
  }

  const target = await prisma.employeeRecord.findUnique({ where: { id: verified.employeeRecordId } });
  if (!target) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
  if (target.userId && target.userId !== account.id) {
    return c.json(
      { error: { message: "This payroll record is already linked to a different account.", code: "ALREADY_LINKED" } },
      409,
    );
  }
  const already = await prisma.employeeRecord.findUnique({ where: { userId: account.id } });
  if (already && already.id !== target.id) {
    return c.json(
      { error: { message: "Your account is already linked to a different employer's payroll.", code: "ALREADY_LINKED" } },
      409,
    );
  }

  await prisma.employeeRecord.update({ where: { id: target.id }, data: { userId: account.id } });

  await record(c, {
    action: "employee.link.accepted",
    outcome: "success",
    actorType: "user",
    actorId: account.id,
    actorLabel: account.email,
    targetType: "employee_record",
    targetId: target.id,
  });

  return c.json({ data: { linked: true } });
});

employeeLinkRouter.get("/eligibility", requireUser(), async (c) => {
  const account = c.get("account");
  const { view } = await computeEligibility(account.id, account.kycStatus);
  return c.json({ data: view });
});

export { employeeLinkRouter };
