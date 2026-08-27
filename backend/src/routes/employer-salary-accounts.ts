import { Hono } from "hono";
import type { Context, MiddlewareHandler, Next } from "hono";
import { prisma } from "../db";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireEmployerUser } from "./employer";
import { decryptField } from "../security/field-crypto";
import {
  decideSalaryAccountRequestSchema,
  type SalaryAccountRequestDetailView,
} from "../types";

/**
 * Salary Account — employer-facing review side. Real counterpart of the
 * demo-only mock "SalaryAccountRequestReview" screen (AGENTS.md §9).
 *
 * Employer HR/admin review is the whole of what this file does: list
 * requests, view one in full (including the employee's consent record), and
 * decide it. Approving copies the request's new account onto
 * EmployeeRecord.payrollAccount* and increments Employer.salaryAccountsActive
 * — nothing else changes, matching the mock's own "HR's whole action: change
 * one payroll field" framing. No money moves.
 */
const employerSalaryAccountsRouter = new Hono();

employerSalaryAccountsRouter.use("*", requireEmployerUser());

function fail(c: Context, status: 403 | 404 | 409, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/** employer_admin and employer_contributor may review; employer_viewer may not. */
function requireEmployerReviewer(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.get("employerUser")?.role === "employer_viewer") {
      return fail(c, 403, "FORBIDDEN", "Your role can view Salary Account requests but not decide them.");
    }
    await next();
  };
}

function maskLast4(value: string): string {
  return `•••• ${value}`;
}

employerSalaryAccountsRouter.get("/requests", async (c) => {
  const { employerId } = c.get("employerUser")!;

  const rows = await prisma.salaryAccountRequest.findMany({
    where: { employerId },
    orderBy: { requestedAt: "desc" },
    include: { employeeRecord: { select: { staffRef: true, fullNameEnc: true } } },
  });

  const items = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    status: r.status,
    employeeName: decryptField(r.employeeRecord.fullNameEnc),
    staffRef: r.employeeRecord.staffRef,
    newBankName: r.newBankName,
    newAccountMasked: maskLast4(r.newAccountLast4),
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
  }));

  return c.json({ data: { items } });
});

employerSalaryAccountsRouter.get("/requests/:id", async (c) => {
  const { employerId } = c.get("employerUser")!;

  const row = await prisma.salaryAccountRequest.findFirst({
    where: { id: c.req.param("id"), employerId },
    include: { employeeRecord: { select: { staffRef: true, fullNameEnc: true } } },
  });
  if (!row) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const view: SalaryAccountRequestDetailView = {
    id: row.id,
    reference: row.reference,
    status: row.status as SalaryAccountRequestDetailView["status"],
    employeeName: decryptField(row.employeeRecord.fullNameEnc),
    staffRef: row.employeeRecord.staffRef,
    currentBankName: row.currentBankName,
    currentAccountMasked: row.currentAccountLast4 ? maskLast4(row.currentAccountLast4) : null,
    newBankName: row.newBankName,
    newAccountName: decryptField(row.newAccountNameEnc) ?? "",
    newAccountMasked: maskLast4(row.newAccountLast4),
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByLabel: row.decidedByLabel,
    rejectionReason: row.rejectionReason,
    consent: {
      signedAt: row.consentSignedAt.toISOString(),
      deviceRef: row.consentDeviceRef,
      consentReferenceId: row.consentReferenceId,
    },
  };

  return c.json({ data: view });
});

employerSalaryAccountsRouter.post(
  "/requests/:id/decide",
  requireEmployerReviewer(),
  validate("json", decideSalaryAccountRequestSchema),
  async (c) => {
    const actor = c.get("employerUser")!;
    const input = c.req.valid("json");

    const requestRow = await prisma.salaryAccountRequest.findFirst({
      where: { id: c.req.param("id"), employerId: actor.employerId },
    });
    if (!requestRow) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
    if (requestRow.status !== "pending_review") {
      return fail(c, 409, "ALREADY_DECIDED", "This request has already been decided.");
    }

    const now = new Date();
    const approve = input.decision === "approve";

    await prisma.$transaction(async (tx) => {
      await tx.salaryAccountRequest.update({
        where: { id: requestRow.id },
        data: {
          status: approve ? "active" : "rejected",
          rejectionReason: approve ? null : (input.rejectionReason ?? "Rejected by employer."),
          decidedAt: now,
          decidedBy: actor.id,
          decidedByLabel: actor.fullName,
        },
      });

      if (approve) {
        await tx.employeeRecord.update({
          where: { id: requestRow.employeeRecordId },
          data: {
            payrollAccountNameEnc: requestRow.newAccountNameEnc,
            payrollAccountNumberEnc: requestRow.newAccountNumberEnc,
            payrollAccountLast4: requestRow.newAccountLast4,
            payrollBankName: requestRow.newBankName,
            payrollAccountSource: "paybridge_salary_account",
            payrollAccountUpdatedAt: now,
          },
        });
        await tx.employer.update({
          where: { id: actor.employerId },
          data: { salaryAccountsActive: { increment: 1 } },
        });
      }
    });

    await record(c, {
      action: approve ? "salary_account.approved" : "salary_account.rejected",
      outcome: "success",
      actorType: "user",
      actorId: actor.id,
      actorLabel: actor.email,
      targetType: "salary_account_request",
      targetId: requestRow.id,
      detail: { reference: requestRow.reference },
    });

    return c.json({ data: { ok: true, status: approve ? "active" : "rejected" } });
  },
);

export { employerSalaryAccountsRouter };
