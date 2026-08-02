import { Hono } from "hono";
import type { Context, MiddlewareHandler, Next } from "hono";
import { prisma } from "../db";
import { rateLimit } from "../security/rate-limit";
import { validate } from "../security/validate";
import { record } from "../security/audit-store";
import { requireEmployerUser } from "./employer";
import { encryptField, decryptField } from "../security/field-crypto";
import { signEmployeeLinkInvite } from "../security/employee-link";
import { sendMail } from "../email/mailer";
import { BRIDGERS } from "../email/identities";
import {
  createPayrollCycleSchema,
  inviteEmployeeLinkSchema,
  type EmployeeRecordView,
  type PayrollCycleDetailView,
  type PayrollCycleView,
  type PayrollRecordView,
} from "../types";

/**
 * Payroll ingestion — Employer portal → Payroll.
 *
 * Deliberately the whole of this router's job: get real payroll data into
 * `PayrollCycle` / `PayrollRecord` / `EmployeeRecord`. It does NOT compute
 * timeliness, delay days, or anything else `eir/risk/payroll.ts` derives —
 * that engine is a separate, already-tested module (see AGENTS.md §6, the
 * next item on the punch list is wiring it up). This router's only job is to
 * make sure that engine has real rows to read, instead of none.
 *
 * Names and account numbers are encrypted at rest for the same reason KYC
 * fields are (security/field-crypto.ts): compensation data tied to a bank
 * account and a name is identity-theft-grade if a backup or replica leaks.
 */
const payrollRouter = new Hono();

payrollRouter.use("*", requireEmployerUser());
payrollRouter.use(
  "/cycles/:cycleId/upload",
  rateLimit({ name: "employer:payroll:upload", limit: 20, windowMs: 60 * 60_000 }),
);

const MAX_CSV_BYTES = 5 * 1024 * 1024;

function fail(c: Context, status: 400 | 403 | 404 | 409, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/** Contributor and admin can upload; viewer is read-only. */
function requireEmployerWriter(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.get("employerUser")?.role === "employer_viewer") {
      return fail(c, 403, "FORBIDDEN", "Your role can view payroll but not upload it.");
    }
    await next();
  };
}

function toCycleView(row: {
  id: string;
  periodStart: Date;
  expectedPayDate: Date;
  actualPayDate: Date | null;
  totalAmount: unknown;
  employeeCount: number | null;
  timeliness: string;
  source: string;
  createdAt: Date;
}): PayrollCycleView {
  return {
    id: row.id,
    periodStart: row.periodStart.toISOString().slice(0, 10),
    expectedPayDate: row.expectedPayDate.toISOString().slice(0, 10),
    actualPayDate: row.actualPayDate?.toISOString().slice(0, 10) ?? null,
    totalAmount: row.totalAmount === null ? null : Number(row.totalAmount),
    employeeCount: row.employeeCount,
    timeliness: row.timeliness,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

/* =============================================================== CYCLES */

payrollRouter.get("/cycles", async (c) => {
  const { employerId } = c.get("employerUser")!;
  const rows = await prisma.payrollCycle.findMany({
    where: { employerId },
    orderBy: { periodStart: "desc" },
  });
  return c.json({ data: { items: rows.map(toCycleView) } });
});

payrollRouter.post(
  "/cycles",
  requireEmployerWriter(),
  validate("json", createPayrollCycleSchema),
  async (c) => {
    const actor = c.get("employerUser")!;
    const input = c.req.valid("json");

    const cycle = await prisma.payrollCycle.upsert({
      where: { employerId_periodStart: { employerId: actor.employerId, periodStart: new Date(input.periodStart) } },
      create: {
        employerId: actor.employerId,
        periodStart: new Date(input.periodStart),
        expectedPayDate: new Date(input.expectedPayDate),
        source: "payroll_upload",
      },
      update: { expectedPayDate: new Date(input.expectedPayDate) },
    });

    await record(c, {
      action: "employer.payroll.cycle_created",
      outcome: "success",
      actorType: "user",
      actorId: actor.id,
      actorLabel: actor.email,
      targetType: "payroll_cycle",
      targetId: cycle.id,
      detail: { periodStart: input.periodStart },
    });

    return c.json({ data: toCycleView(cycle) }, 201);
  },
);

payrollRouter.get("/cycles/:cycleId", async (c) => {
  const { employerId } = c.get("employerUser")!;
  const cycle = await prisma.payrollCycle.findFirst({
    where: { id: c.req.param("cycleId"), employerId },
    include: { records: { orderBy: { createdAt: "asc" } } },
  });
  if (!cycle) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  const view: PayrollCycleDetailView = {
    ...toCycleView(cycle),
    records: cycle.records.map(
      (r): PayrollRecordView => ({
        id: r.id,
        staffRef: r.staffRef,
        fullName: decryptField(r.fullNameEnc),
        grossPay: Number(r.grossPay),
        netPay: r.netPay === null ? null : Number(r.netPay),
        deductions: r.deductions === null ? null : Number(r.deductions),
        allowances: r.allowances === null ? null : Number(r.allowances),
        bonus: r.bonus === null ? null : Number(r.bonus),
        paymentStatus: r.paymentStatus,
        paidAt: r.paidAt?.toISOString() ?? null,
      }),
    ),
  };
  return c.json({ data: view });
});

/* ================================================================ UPLOAD */

/**
 * Minimal RFC4180-ish CSV parser: quoted fields (with escaped `""`), commas
 * inside quotes, CRLF or LF line endings. Payroll exports are simple tabular
 * data — this avoids a dependency for a format this constrained.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  return rows;
}

const REQUIRED_HEADERS = ["staffref", "grosspay"] as const;
const KNOWN_HEADERS = [
  "staffref",
  "fullname",
  "grosspay",
  "netpay",
  "deductions",
  "allowances",
  "bonus",
  "accountnumber",
  "paymentstatus",
  "paidat",
] as const;

function num(v: string | undefined): number | null {
  if (!v || !v.trim()) return null;
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Upload a CSV of pay records against one cycle. Replaces the cycle's
 * existing records rather than appending — a corrected re-upload must not
 * double-count, the same reason a re-uploaded KYC document replaces the old
 * one rather than stacking (see auth.ts's /kyc/documents).
 *
 * Expected columns (case-insensitive, order-independent): staffRef,
 * fullName, grossPay, netPay, deductions, allowances, bonus, accountNumber,
 * paymentStatus, paidAt. Only staffRef and grossPay are required.
 */
payrollRouter.post("/cycles/:cycleId/upload", requireEmployerWriter(), async (c) => {
  const actor = c.get("employerUser")!;
  const cycle = await prisma.payrollCycle.findFirst({
    where: { id: c.req.param("cycleId"), employerId: actor.employerId },
  });
  if (!cycle) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return fail(c, 400, "BAD_UPLOAD", "That upload could not be read. Try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(c, 400, "NO_FILE", "Attach a CSV file.");
  if (file.size === 0) return fail(c, 400, "EMPTY_FILE", "That file is empty.");
  if (file.size > MAX_CSV_BYTES) return fail(c, 400, "FILE_TOO_LARGE", "CSV files must be 5 MB or smaller.");

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return fail(c, 400, "EMPTY_FILE", "That file has no data rows.");

  const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return fail(c, 400, "BAD_COLUMNS", `Missing required column(s): ${missing.join(", ")}.`);
  }
  const col = (name: (typeof KNOWN_HEADERS)[number]) => header.indexOf(name);

  const dataRows = rows.slice(1);
  if (dataRows.length > 5000) {
    return fail(c, 400, "TOO_MANY_ROWS", "Upload at most 5,000 rows at a time.");
  }

  type Parsed = {
    staffRef: string;
    fullName: string | null;
    grossPay: number;
    netPay: number | null;
    deductions: number | null;
    allowances: number | null;
    bonus: number | null;
    accountNumber: string | null;
    paymentStatus: string;
    paidAt: Date | null;
  };
  const parsed: Parsed[] = [];
  for (const r of dataRows) {
    const staffRef = r[col("staffref")]?.trim();
    const grossPay = num(r[col("grosspay")]);
    if (!staffRef || grossPay === null) continue; // skip malformed rows rather than fail the whole file
    const paidAtRaw = col("paidat") >= 0 ? r[col("paidat")]?.trim() : undefined;
    const paidAt = paidAtRaw && /^\d{4}-\d{2}-\d{2}/.test(paidAtRaw) ? new Date(paidAtRaw) : null;
    parsed.push({
      staffRef,
      fullName: col("fullname") >= 0 ? r[col("fullname")]?.trim() || null : null,
      grossPay,
      netPay: col("netpay") >= 0 ? num(r[col("netpay")]) : null,
      deductions: col("deductions") >= 0 ? num(r[col("deductions")]) : null,
      allowances: col("allowances") >= 0 ? num(r[col("allowances")]) : null,
      bonus: col("bonus") >= 0 ? num(r[col("bonus")]) : null,
      accountNumber: col("accountnumber") >= 0 ? r[col("accountnumber")]?.trim() || null : null,
      paymentStatus:
        col("paymentstatus") >= 0 && r[col("paymentstatus")]?.trim() ? r[col("paymentstatus")]!.trim() : "paid",
      paidAt,
    });
  }
  if (parsed.length === 0) return fail(c, 400, "NO_VALID_ROWS", "No row had both a staff reference and a gross pay.");

  const { totalAmount, employeeCount } = await prisma.$transaction(async (tx) => {
    // Upsert the roster first, so every record can link to a real EmployeeRecord.
    const employeeIds = new Map<string, string>();
    for (const p of parsed) {
      const existing = await tx.employeeRecord.findUnique({
        where: { employerId_staffRef: { employerId: actor.employerId, staffRef: p.staffRef } },
      });
      if (existing) {
        if (p.fullName) {
          await tx.employeeRecord.update({
            where: { id: existing.id },
            data: { fullNameEnc: encryptField(p.fullName) },
          });
        }
        employeeIds.set(p.staffRef, existing.id);
      } else {
        const created = await tx.employeeRecord.create({
          data: {
            employerId: actor.employerId,
            staffRef: p.staffRef,
            fullNameEnc: p.fullName ? encryptField(p.fullName) : null,
          },
        });
        employeeIds.set(p.staffRef, created.id);
      }
    }

    // Replace this cycle's records rather than appending.
    await tx.payrollRecord.deleteMany({ where: { cycleId: cycle.id } });
    await tx.payrollRecord.createMany({
      data: parsed.map((p) => ({
        cycleId: cycle.id,
        employeeId: employeeIds.get(p.staffRef) ?? null,
        staffRef: p.staffRef,
        fullNameEnc: p.fullName ? encryptField(p.fullName) : null,
        grossPay: p.grossPay,
        netPay: p.netPay,
        deductions: p.deductions,
        allowances: p.allowances,
        bonus: p.bonus,
        accountNumberEnc: p.accountNumber ? encryptField(p.accountNumber) : null,
        paymentStatus: p.paymentStatus,
        paidAt: p.paidAt,
      })),
    });

    const totalAmount = parsed.reduce((sum, p) => sum + p.grossPay, 0);
    const employeeCount = employeeIds.size;
    await tx.payrollCycle.update({
      where: { id: cycle.id },
      data: { totalAmount, employeeCount, source: "payroll_upload" },
    });

    return { totalAmount, employeeCount };
  });

  await record(c, {
    action: "employer.payroll.uploaded",
    outcome: "success",
    actorType: "user",
    actorId: actor.id,
    actorLabel: actor.email,
    targetType: "payroll_cycle",
    targetId: cycle.id,
    detail: { rows: parsed.length, skipped: dataRows.length - parsed.length },
  });

  return c.json({ data: { cycleId: cycle.id, recordsImported: parsed.length, totalAmount, employeeCount } });
});

/* =============================================================== ROSTER */

payrollRouter.get("/employees", async (c) => {
  const { employerId } = c.get("employerUser")!;
  const rows = await prisma.employeeRecord.findMany({
    where: { employerId, deletedAt: null },
    orderBy: { staffRef: "asc" },
  });
  const items: EmployeeRecordView[] = rows.map((r) => ({
    id: r.id,
    staffRef: r.staffRef,
    fullName: decryptField(r.fullNameEnc),
    department: r.department,
    jobTitle: r.jobTitle,
    status: r.status,
    ewaEnrolled: r.ewaEnrolled,
    linked: r.userId !== null,
  }));
  return c.json({ data: { items } });
});

/**
 * Invite the real person behind one payroll row to link their PayBridge
 * account to it — "Employees invited" in PRD.md's business flow. A signed,
 * stateless link (security/employee-link.ts): no schema column needed for
 * the token itself, and it self-expires.
 */
payrollRouter.post(
  "/employees/:id/invite",
  requireEmployerWriter(),
  validate("json", inviteEmployeeLinkSchema),
  async (c) => {
    const actor = c.get("employerUser")!;
    const input = c.req.valid("json");

    const target = await prisma.employeeRecord.findFirst({
      where: { id: c.req.param("id"), employerId: actor.employerId },
    });
    if (!target) return c.json({ error: { message: "Not found.", code: "NOT_FOUND" } }, 404);
    if (target.userId) return fail(c, 409, "ALREADY_LINKED", "This payroll row is already linked to an account.");

    const employer = await prisma.employer.findUniqueOrThrow({
      where: { id: actor.employerId },
      select: { registeredName: true },
    });

    const link = `${process.env.PUBLIC_SITE_URL ?? "https://getpaybridge.com"}/link-employer?token=${signEmployeeLinkInvite(target.id, input.email)}`;

    await record(c, {
      action: "employee.link.invited",
      outcome: "success",
      actorType: "user",
      actorId: actor.id,
      actorLabel: actor.email,
      targetType: "employee_record",
      targetId: target.id,
    });

    await sendMail({
      to: input.email,
      from: BRIDGERS,
      subject: `${employer.registeredName} has added you to PayBridge`,
      text: `Hello,\n\n${employer.registeredName} has added you to their payroll on PayBridge. If you already have a PayBridge account with this email address, follow this link to connect it to your payroll record:\n${link}\n\nIf you do not have an account yet, create one at https://getpaybridge.com/register with this same email address, then follow the link above.\n\nThis link expires in 14 days.\n\nPayBridge`,
      html: `<p>Hello,</p><p><strong>${employer.registeredName}</strong> has added you to their payroll on PayBridge.</p><p>If you already have a PayBridge account with this email address, <a href="${link}">connect it to your payroll record</a>.</p><p>If you do not have an account yet, <a href="https://getpaybridge.com/register">create one</a> with this same email address, then follow the link above.</p><p>This link expires in 14 days.</p><p>PayBridge</p>`,
    }).catch(() => ({ delivered: false, note: "send threw" }));

    return c.json({ data: { ok: true } }, 201);
  },
);

export { payrollRouter };
