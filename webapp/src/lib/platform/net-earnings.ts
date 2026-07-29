/**
 * NET EARNINGS ENGINE
 *
 * Pure functions. No dates from the clock, no data access, no side effects —
 * so the same maths runs in the mock service today and against a real payroll
 * feed later, and can be unit tested line by line.
 *
 * The waterfall, in order:
 *
 *   Gross Earnings
 *     − Statutory Deductions
 *     − Recurring Payroll Deductions
 *     − Approved Variable Deductions
 *     − Existing Payroll Obligations
 *   = Net Salary
 *     − Protected Payroll Commitments
 *     − Existing PayBridge Settlement Obligations
 *   = Bridgeable Salary
 *
 * Accrual then earns that Bridgeable Salary day by day across the payroll
 * calendar. Bridge availability is NEVER derived from gross salary.
 */

import type {
  AccrualResult,
  DeductionKind,
  NetEarningsBreakdown,
  PayrollDeduction,
  PayrollEmployeeRecord,
  PayrollPolicy,
} from "./payroll-models";
import { ACCRUING_STATUSES } from "./payroll-models";

/** Variable deductions only count once the employer has approved them. */
function counts(line: PayrollDeduction): boolean {
  return line.kind === "Variable" ? line.approved : true;
}

function sumKind(lines: PayrollDeduction[], kind: DeductionKind): number {
  return lines.filter((line) => line.kind === kind && counts(line)).reduce((sum, line) => sum + line.amount, 0);
}

/**
 * Gross to net to bridgeable for a single payroll record.
 *
 * `netVariance` compares our calculation against the net the payroll system
 * reported. Anything other than zero is an exception, never a silent override.
 */
export function computeNetEarnings(record: PayrollEmployeeRecord): NetEarningsBreakdown {
  const lines = record.deductions;
  const grossEarnings = record.grossSalary + record.overtime + record.bonuses;

  const statutory = sumKind(lines, "Statutory");
  const recurring = sumKind(lines, "Recurring");
  const variable = sumKind(lines, "Variable");
  const obligations = sumKind(lines, "Obligation");

  const netSalary = grossEarnings - statutory - recurring - variable - obligations;

  const protectedCommitments = sumKind(lines, "Commitment");
  const settlementObligations = record.settlementObligation;
  const bridgeableSalary = netSalary - protectedCommitments - settlementObligations;

  return {
    gross: record.grossSalary,
    overtime: record.overtime,
    bonuses: record.bonuses,
    grossEarnings,
    statutory,
    recurring,
    variable,
    obligations,
    netSalary,
    protectedCommitments,
    settlementObligations,
    bridgeableSalary: Math.max(0, bridgeableSalary),
    lines,
    netVariance: record.reportedNetSalary ? Math.round(netSalary - record.reportedNetSalary) : 0,
  };
}

/**
 * Working days actually earned in this period.
 *
 * Unpaid leave removes days from the eligible base — an employee on five days
 * of unpaid leave in a twenty day month earns fifteen days, not twenty.
 */
export function eligibleWorkingDays(record: PayrollEmployeeRecord): number {
  return Math.max(0, record.workingDaysInPeriod - record.unpaidLeaveDays);
}

export interface AccrualInput {
  record: PayrollEmployeeRecord;
  policy: PayrollPolicy;
  /** Bridge already taken against this period. Held by PayBridge, never the employer. */
  alreadyBridged: number;
  periodLabel: string;
  asOf: string;
  /** An unresolved critical exception freezes new availability. */
  blockingException?: { type: string; severity: string };
}

/**
 * Accrued net earnings and the resulting Bridge availability.
 *
 * Worked example from the product brief:
 *   Monthly net ₦400,000 · 20 eligible days · 10 completed
 *   → ₦20,000 net daily · ₦200,000 accrued · 50% cap · ₦100,000 available
 */
export function computeAccrual(input: AccrualInput): AccrualResult {
  const { record, policy, alreadyBridged, periodLabel, asOf } = input;
  const breakdown = computeNetEarnings(record);

  const eligibleDays = eligibleWorkingDays(record);
  const daysCompleted = Math.max(0, Math.min(record.daysWorked, eligibleDays));
  const netDailyEarnings = eligibleDays > 0 ? breakdown.netSalary / eligibleDays : 0;
  const accruedNetEarnings = Math.max(0, Math.round(netDailyEarnings * daysCompleted));

  const maxBridgePct = policy.maxBridgePct;
  /**
   * The cap is the lower of (accrued net × maximum percentage) and the
   * bridgeable salary, so protected commitments and settlement obligations can
   * never be bridged even when plenty of days have been worked.
   */
  const capFromAccrual = Math.round((accruedNetEarnings * maxBridgePct) / 100);
  const maxAvailableToBridge = Math.max(0, Math.min(capFromAccrual, breakdown.bridgeableSalary));

  const { paused, pauseReason } = accrualState(input);
  const availableToBridge = paused ? 0 : Math.max(0, maxAvailableToBridge - alreadyBridged);

  return {
    breakdown,
    workingDays: record.workingDaysInPeriod,
    unpaidLeaveDays: record.unpaidLeaveDays,
    eligibleWorkingDays: eligibleDays,
    daysCompleted,
    netDailyEarnings: Math.round(netDailyEarnings),
    accruedNetEarnings,
    maxBridgePct,
    maxAvailableToBridge,
    alreadyBridged,
    availableToBridge,
    paused,
    pauseReason,
    payday: record.payday,
    periodLabel,
    asOf,
  };
}

/**
 * Why accrual is or is not running. Employment status, an employer hold, a
 * critical exception or a payroll record that is not confirmed all stop new
 * availability — none of them ever reverse money already disbursed.
 */
export function accrualState(input: AccrualInput): { paused: boolean; pauseReason?: string } {
  const { record, policy, blockingException } = input;

  if (record.accrualPaused) {
    return { paused: true, pauseReason: record.accrualPauseReason ?? "Accrual paused by your employer" };
  }
  if (!ACCRUING_STATUSES.includes(record.employmentStatus)) {
    return { paused: true, pauseReason: `Employment status: ${record.employmentStatus.toLowerCase()}` };
  }
  if (record.approvalStatus === "On hold" || record.approvalStatus === "Rejected") {
    return { paused: true, pauseReason: "Payroll record is on hold pending employer confirmation" };
  }
  if (policy.autoPauseOnCritical && blockingException?.severity === "Critical") {
    return { paused: true, pauseReason: `Payroll confirmation in progress: ${blockingException.type.toLowerCase()}` };
  }
  if (computeNetEarnings(record).netSalary <= 0) {
    return { paused: true, pauseReason: "No confirmed net pay for this period" };
  }
  return { paused: false };
}

/** Whole-company roll-up used by the payroll command centre. */
export function summarisePayroll(records: PayrollEmployeeRecord[]): {
  headcount: number;
  gross: number;
  deductions: number;
  net: number;
  settlement: number;
  statutory: number;
} {
  return records.reduce(
    (acc, record) => {
      const b = computeNetEarnings(record);
      return {
        headcount: acc.headcount + 1,
        gross: acc.gross + b.grossEarnings,
        deductions: acc.deductions + (b.grossEarnings - b.netSalary),
        net: acc.net + Math.max(0, b.netSalary),
        settlement: acc.settlement + record.settlementObligation,
        statutory: acc.statutory + b.statutory,
      };
    },
    { headcount: 0, gross: 0, deductions: 0, net: 0, settlement: 0, statutory: 0 },
  );
}
