import { prisma } from "../db";
import type { EligibilityView } from "../types";

/**
 * The eligibility checklist from PRD.md's Business Rules, computed from real
 * employer/payroll/KYC state. Shared between `routes/employee-link.ts` (the
 * customer-facing read) and `routes/bridge.ts` (which needs the same
 * computation, plus the underlying ids, to actually place a draw request).
 */
export interface EligibilityResult {
  view: EligibilityView;
  employeeRecordId: string | null;
  limitId: string | null;
  cycleId: string | null;
}

export async function computeEligibility(userId: string, kycStatus: string): Promise<EligibilityResult> {
  const employeeRecord = await prisma.employeeRecord.findUnique({
    where: { userId },
    include: {
      employer: { select: { registeredName: true, status: true } },
      payrollRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { cycle: { select: { id: true, periodStart: true, expectedPayDate: true } } },
      },
    },
  });

  const reasons: string[] = [];

  const employmentVerified = Boolean(employeeRecord && employeeRecord.status === "active" && !employeeRecord.exitedAt);
  if (!employeeRecord) {
    reasons.push("Your account is not yet linked to your employer's payroll. Ask your employer to invite you.");
  } else if (employeeRecord.status !== "active" || employeeRecord.exitedAt) {
    reasons.push("Your employer's records do not show you as an active employee.");
  }

  const employerStatus = employeeRecord?.employer.status ?? null;
  const employerActive = employerStatus === "active";
  if (employeeRecord && !employerActive) {
    reasons.push(`Your employer's PayBridge account is not yet active (status: ${employerStatus}).`);
  }

  const latest = employeeRecord?.payrollRecords[0] ?? null;
  const payrollVerified = latest !== null;
  if (employeeRecord && !payrollVerified) {
    reasons.push("No pay record has been uploaded for you yet.");
  }

  const kycApproved = kycStatus === "approved";
  if (!kycApproved) {
    reasons.push(
      kycStatus === "pending"
        ? "Your identity verification is still being reviewed."
        : "Complete identity verification (KYC) to unlock this.",
    );
  }

  let earnedWageEstimate: number | null = null;
  let currentPeriodStart: string | null = null;
  if (latest) {
    const base = latest.netPay !== null ? Number(latest.netPay) : Number(latest.grossPay);
    const start = latest.cycle.periodStart.getTime();
    const end = latest.cycle.expectedPayDate.getTime();
    const now = Date.now();
    const span = end - start;
    const fraction = span > 0 ? Math.min(1, Math.max(0, (now - start) / span)) : 1;
    earnedWageEstimate = Math.round(base * fraction * 100) / 100;
    currentPeriodStart = latest.cycle.periodStart.toISOString().slice(0, 10);
  }

  const eligible = employmentVerified && employerActive && payrollVerified && kycApproved;

  // The `ewa` credit limit is a separate precondition from the four above —
  // an employer can be active with verified payroll and still have no active
  // EWA facility (e.g. only payroll_buffer was approved). Bridge requests
  // need it; the account-page eligibility panel doesn't ask this question,
  // so it stays out of `reasons`/`eligible` here and is checked again,
  // explicitly, in routes/bridge.ts.
  const limit = employeeRecord
    ? await prisma.creditLimit.findFirst({
        where: { employerId: employeeRecord.employerId, product: "ewa", status: "active" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return {
    view: {
      eligible,
      employmentVerified,
      employerActive,
      employerStatus,
      employerName: employeeRecord?.employer.registeredName ?? null,
      payrollVerified,
      kycApproved,
      earnedWageEstimate,
      currentPeriodStart,
      reasons,
    },
    employeeRecordId: employeeRecord?.id ?? null,
    limitId: limit?.id ?? null,
    cycleId: latest?.cycle.id ?? null,
  };
}
