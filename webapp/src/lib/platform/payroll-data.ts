/**
 * PAYBRIDGE PAYROLL — seed data.
 *
 * Builds a normalised payroll record for every employee, a payroll period per
 * employer, connector inventory, sync history, exception scenarios and the
 * onboarding-approved policy. Deliberately separate from `mock-data.ts` so the
 * payroll domain can be lifted out to a real service on its own.
 */

import { employees, employers, DEMO_EMPLOYER_ID, DEMO_EMPLOYEE_ID, NEXT_PAYDAY } from "./mock-data";
import type {
  PayrollDeduction,
  PayrollEmployeeRecord,
  PayrollException,
  PayrollIntegration,
  PayrollPeriod,
  PayrollPolicy,
  PayrollSyncEvent,
} from "./payroll-models";

/* ----------------------------------------------------------------- helpers */

function makeRng(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
const rng = makeRng(20260801);
const int = (min: number, max: number) => Math.floor(min + rng() * (max - min + 1));
const round = (value: number, to: number) => Math.round(value / to) * to;

const NOW = new Date();
function iso(daysFromNow: number, hour = 9, minute = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const CURRENT_PERIOD_LABEL = "August 2026";
const PERIOD_START = "2026-08-01T00:00:00.000Z";
const PERIOD_END = "2026-08-31T00:00:00.000Z";

/** Every employee in the demo works a 20-day payroll calendar. */
const WORKING_DAYS = 20;
/** Days of the calendar completed at the moment the prototype is viewed. */
const DAYS_ELAPSED = 10;

/* ------------------------------------------------------------- deductions */

let deductionSeq = 0;
function deduction(
  label: string,
  kind: PayrollDeduction["kind"],
  amount: number,
  source: PayrollEmployeeRecord["dataSource"],
  opts: { approved?: boolean; note?: string } = {},
): PayrollDeduction {
  deductionSeq += 1;
  return {
    id: `ded_${String(deductionSeq).padStart(5, "0")}`,
    label,
    kind,
    amount: Math.round(amount),
    approved: opts.approved ?? true,
    effectiveDate: PERIOD_START,
    source,
    note: opts.note,
  };
}

/**
 * Nigeria statutory stack: pension 8%, PAYE on a simplified effective rate and
 * the National Housing Fund at 2.5%. Rates live in the country pack, never in
 * the engine — see `NIGERIA_PACK` below.
 */
export const NIGERIA_PACK = {
  country: "Nigeria",
  currency: "NGN",
  version: "2026.1",
  effectiveFrom: "2026-01-01",
  pensionEmployeePct: 8,
  pensionEmployerPct: 10,
  nhfPct: 2.5,
  payeEffectivePct: 12,
  minimumWage: 70_000,
  remittanceDeadlineDay: 10,
} as const;

function statutoryLines(gross: number, source: PayrollEmployeeRecord["dataSource"]): PayrollDeduction[] {
  return [
    deduction("PAYE (income tax)", "Statutory", gross * (NIGERIA_PACK.payeEffectivePct / 100), source),
    deduction("Pension contribution", "Statutory", gross * (NIGERIA_PACK.pensionEmployeePct / 100), source),
    deduction("National Housing Fund", "Statutory", gross * (NIGERIA_PACK.nhfPct / 100), source),
  ];
}

/* --------------------------------------------------------- payroll records */

const SOURCES: PayrollEmployeeRecord["dataSource"][] = [
  "HRIS connector",
  "Payroll connector",
  "SFTP",
  "REST API",
  "CSV upload",
];

function baseRecord(index: number): PayrollEmployeeRecord {
  const employee = employees[index];
  const source = SOURCES[index % SOURCES.length];
  const gross = employee.monthlySalary;
  const lines = statutoryLines(gross, source);

  if (index % 3 === 0) lines.push(deduction("Staff cooperative", "Recurring", round(gross * 0.02, 500), source));
  if (index % 5 === 0) lines.push(deduction("Union dues", "Recurring", 2_000, source));
  if (index % 4 === 1)
    lines.push(
      deduction("Staff loan repayment", "Obligation", round(gross * 0.06, 500), source, {
        note: "Employer loan schedule",
      }),
    );

  const reportedNet = Math.round(gross - lines.reduce((sum, l) => sum + l.amount, 0));

  return {
    id: `pay_${employee.id}`,
    employeeId: employee.id,
    payrollId: employee.staffId,
    employerId: employee.employerId,
    employerName: employee.employerName,
    fullName: employee.fullName,
    department: employee.department,
    jobTitle: employee.jobTitle,
    employmentStatus: "Active",
    employmentStartDate: employee.joinedAt,
    payrollPeriodId: `per_${employee.employerId}_2026_08`,
    payrollFrequency: "Monthly",
    payday: NEXT_PAYDAY,
    grossSalary: gross,
    overtime: 0,
    bonuses: 0,
    deductions: lines,
    reportedNetSalary: reportedNet,
    unpaidLeaveDays: 0,
    workingDaysInPeriod: WORKING_DAYS,
    daysWorked: DAYS_ELAPSED,
    salaryEffectiveDate: "2026-01-01T00:00:00.000Z",
    settlementObligation: employee.alreadyBridged > 0 ? Math.round(employee.alreadyBridged * 1.03) : 0,
    lastUpdatedAt: iso(-int(0, 3), int(2, 8), int(0, 59)),
    dataSource: source,
    approvalStatus: "Confirmed",
    accrualPaused: false,
    bankVerified: true,
  };
}

export const payrollRecords: PayrollEmployeeRecord[] = employees.map((_, i) => baseRecord(i));

const byEmployee = new Map(payrollRecords.map((record) => [record.employeeId, record]));
function record(employeeId: string): PayrollEmployeeRecord {
  const found = byEmployee.get(employeeId);
  if (!found) throw new Error(`No payroll record for ${employeeId}`);
  return found;
}

/* ------------------------------------------- the brief's worked example ---
 * Monthly net ₦400,000 · 20 eligible days · 10 completed
 *   → ₦20,000 daily · ₦200,000 accrued · 50% cap · ₦100,000 maximum
 */
const demo = record(DEMO_EMPLOYEE_ID);
demo.grossSalary = 520_000;
demo.deductions = [
  deduction("PAYE (income tax)", "Statutory", 62_400, "HRIS connector"),
  deduction("Pension contribution", "Statutory", 41_600, "HRIS connector"),
  deduction("National Housing Fund", "Statutory", 13_000, "HRIS connector"),
  deduction("Staff cooperative", "Recurring", 3_000, "HRIS connector"),
];
demo.reportedNetSalary = 400_000;
demo.settlementObligation = 20_600;
demo.dataSource = "HRIS connector";
demo.lastUpdatedAt = iso(0, 6, 12);

/* ------------------------------------------------------ demo scenario set */

/** Scenario 2 — unpaid leave reduces the eligible days, so accrual slows. */
const unpaidLeave = record("stf_0003");
unpaidLeave.unpaidLeaveDays = 4;
unpaidLeave.employmentStatus = "On unpaid leave";
unpaidLeave.adjustmentReason = "Four days approved unpaid leave";
unpaidLeave.approvalStatus = "Pending review";

/** Scenario 3 — salary increase, effective this period. */
const raised = record("stf_0004");
const previousGross = raised.grossSalary;
raised.grossSalary = round(previousGross * 1.18, 5_000);
raised.deductions = statutoryLines(raised.grossSalary, raised.dataSource);
raised.reportedNetSalary = Math.round(
  raised.grossSalary - raised.deductions.reduce((sum, l) => sum + l.amount, 0),
);
raised.salaryEffectiveDate = iso(-2);
raised.adjustmentReason = "Annual review increase";

/** Scenario 4 — employment terminated mid-cycle. Accrual stops, history stands. */
const terminated = record("stf_0006");
terminated.employmentStatus = "Terminated";
terminated.employmentEndDate = iso(-3);
terminated.daysWorked = 6;
terminated.accrualPaused = true;
terminated.accrualPauseReason = "Employment ended — payroll confirmation in progress";
terminated.approvalStatus = "On hold";

/** Scenario 5 — a new recurring deduction appears from the payroll feed. */
const newDeduction = record("stf_0008");
newDeduction.deductions.push(
  deduction("Cooperative loan (new)", "Recurring", 45_000, newDeduction.dataSource, {
    note: "First appeared in this payroll file",
  }),
);
newDeduction.reportedNetSalary = Math.round(
  newDeduction.grossSalary - newDeduction.deductions.reduce((sum, l) => sum + l.amount, 0),
);

/** Scenario 8 — settlement obligation exceeds the confirmed net salary. */
const overCommitted = record("stf_0010");
overCommitted.grossSalary = 165_000;
overCommitted.deductions = [
  ...statutoryLines(165_000, overCommitted.dataSource),
  deduction("Staff loan repayment", "Obligation", 78_000, overCommitted.dataSource),
  deduction("Court-ordered deduction", "Obligation", 25_000, overCommitted.dataSource, {
    note: "Magistrate order — protected",
  }),
];
overCommitted.reportedNetSalary = Math.round(
  165_000 - overCommitted.deductions.reduce((sum, l) => sum + l.amount, 0),
);
overCommitted.settlementObligation = 42_000;
overCommitted.accrualPaused = true;
overCommitted.accrualPauseReason = "Settlement obligation exceeds expected net pay";

/** Suspension — status change stops accrual without touching disbursed funds. */
const suspended = record("stf_0012");
suspended.employmentStatus = "Suspended";
suspended.accrualPaused = true;
suspended.accrualPauseReason = "Employment suspended pending employer review";
suspended.approvalStatus = "On hold";

/** Protected commitment — a salary-linked school fees plan sits outside Bridge. */
const committed = record("stf_0014");
committed.deductions.push(
  deduction("School fees commitment", "Commitment", 60_000, committed.dataSource, {
    note: "Protected payroll commitment — excluded from bridgeable salary",
  }),
);

/** Variable overtime awaiting approval — excluded until the employer accepts. */
const overtime = record("stf_0016");
overtime.overtime = 38_000;
overtime.deductions.push(
  deduction("Overtime tax adjustment", "Variable", 4_560, overtime.dataSource, { approved: false }),
);
overtime.adjustmentReason = "Night shift overtime, awaiting approval";

/* ----------------------------------------------------------------- periods */

const activeEmployerIds = employers
  .filter((employer) => employer.applicationStatus === "Approved")
  .map((employer) => employer.id);

export const payrollPeriods: PayrollPeriod[] = activeEmployerIds.map((employerId, index) => {
  const employer = employers.find((e) => e.id === employerId)!;
  const records = payrollRecords.filter((r) => r.employerId === employerId);
  const isDemo = employerId === DEMO_EMPLOYER_ID;
  return {
    id: `per_${employerId}_2026_08`,
    employerId,
    label: CURRENT_PERIOD_LABEL,
    frequency: "Monthly",
    startDate: PERIOD_START,
    endDate: PERIOD_END,
    payday: NEXT_PAYDAY,
    workingDays: WORKING_DAYS,
    elapsedWorkingDays: DAYS_ELAPSED,
    stage: isDemo ? "Exceptions review" : index % 2 ? "Data collection" : "Payroll calculation",
    status: isDemo ? "Review required" : index % 2 ? "On track" : "Processing",
    headcount: employer.activeEmployees,
    grossPayroll: employer.payrollObligation,
    totalDeductions: Math.round(employer.payrollObligation * 0.23),
    netPayroll: Math.round(employer.payrollObligation * 0.77),
    settlementObligation: records.reduce((sum, r) => sum + r.settlementObligation, 0),
    statutoryLiability: Math.round(employer.payrollObligation * 0.205),
    fundsConfirmed: employer.payrollFundsConfirmed,
    approvalStatus: isDemo ? "Awaiting review" : "Not started",
  };
});

/* ------------------------------------------------------------------ policy */

function policyFor(employerId: string, approvedBy: string): PayrollPolicy {
  return {
    employerId,
    version: 3,
    frequency: "Monthly",
    payrollCalendar: "20 working days · Monday to Friday · Nigeria public holidays",
    paydayRule: "28th of each month, or the preceding working day",
    netMethod: "Confirmed payroll net",
    eligibleCategories: ["Full-time", "Permanent", "Confirmed staff"],
    maxBridgePct: 50,
    minimumMonthsService: 3,
    protectedDeductions: ["Court-ordered deduction", "School fees commitment", "Pension top-up"],
    excludedDeductions: ["Reimbursable expenses", "Travel advance"],
    gracePeriodDays: 3,
    submissionSchedule: "Weekly, every Friday by 17:00 WAT",
    submissionDeadline: "Two working days before payday",
    fallbackRule: "Continue accrual for a grace period",
    autoPauseOnCritical: true,
    allowBulkAcceptLowRisk: true,
    approvers: {
      payrollAdmin: "Chidi Balogun",
      hrAdmin: "Ngozi Eze",
      financeAuthoriser: "Tunde Adeyemi",
    },
    approvedBy,
    approvedAt: "2026-02-14T10:20:00.000Z",
  };
}

export const payrollPolicies: PayrollPolicy[] = activeEmployerIds.map((id) =>
  policyFor(id, id === DEMO_EMPLOYER_ID ? "Chidi Balogun" : "Payroll administrator"),
);

/* ------------------------------------------------------------ integrations */

export const payrollIntegrations: PayrollIntegration[] = [
  {
    id: "int_001",
    employerId: DEMO_EMPLOYER_ID,
    name: "SeamlessHR",
    vendor: "SeamlessHR",
    category: "HRIS",
    method: "HRIS connector",
    status: "Connected",
    schedule: "Every 6 hours",
    lastSyncAt: iso(0, 6, 12),
    nextSyncAt: iso(0, 12, 12),
    uptimePct: 99.8,
    recordsLastSync: 284,
    demo: true,
  },
  {
    id: "int_002",
    employerId: DEMO_EMPLOYER_ID,
    name: "Sage Payroll",
    vendor: "Sage",
    category: "Payroll",
    method: "Payroll connector",
    status: "Sandbox",
    schedule: "Nightly at 02:00",
    lastSyncAt: iso(-1, 2, 0),
    nextSyncAt: iso(0, 2, 0),
    uptimePct: 98.1,
    recordsLastSync: 284,
    demo: true,
  },
  {
    id: "int_003",
    employerId: DEMO_EMPLOYER_ID,
    name: "Payroll SFTP drop",
    vendor: "Kaduna Foods",
    category: "File transfer",
    method: "SFTP",
    status: "Connected",
    schedule: "Weekly, Friday 17:00",
    lastSyncAt: iso(-2, 17, 4),
    nextSyncAt: iso(5, 17, 0),
    uptimePct: 97.4,
    recordsLastSync: 284,
    demo: false,
  },
  {
    id: "int_004",
    employerId: DEMO_EMPLOYER_ID,
    name: "Time & attendance API",
    vendor: "ClockPoint",
    category: "Attendance",
    method: "Attendance system",
    status: "Failed",
    schedule: "Every 4 hours",
    lastSyncAt: iso(-1, 20, 40),
    nextSyncAt: iso(0, 16, 0),
    uptimePct: 88.6,
    recordsLastSync: 0,
    demo: true,
    errorMessage: "Connection timed out after 30s — attendance for 3 sites not received",
  },
  {
    id: "int_005",
    employerId: DEMO_EMPLOYER_ID,
    name: "Manual portal entry",
    vendor: "PayBridge",
    category: "API",
    method: "Manual entry",
    status: "Connected",
    schedule: "On demand",
    lastSyncAt: iso(-6, 11, 2),
    uptimePct: 100,
    recordsLastSync: 12,
    demo: false,
  },
];

/** Connectors an employer can request. Nothing here is a live integration. */
export const AVAILABLE_CONNECTORS: { name: string; category: PayrollIntegration["category"]; note: string }[] = [
  { name: "SAP SuccessFactors", category: "HRIS", note: "Employee central + payroll replication" },
  { name: "Oracle Fusion HCM", category: "HRIS", note: "REST extract, scheduled" },
  { name: "Workday", category: "HRIS", note: "Report-as-a-service feed" },
  { name: "Microsoft Dynamics 365", category: "Payroll", note: "Finance & operations payroll journal" },
  { name: "Sage 300 People", category: "Payroll", note: "Payroll register export" },
  { name: "PaidHR", category: "Payroll", note: "Native API" },
  { name: "BambooHR", category: "HRIS", note: "Employee + compensation sync" },
  { name: "Zoho People", category: "HRIS", note: "Attendance + leave sync" },
  { name: "QuickBooks / Xero", category: "Accounting", note: "Payroll journal posting" },
];

export const payrollSyncEvents: PayrollSyncEvent[] = [
  {
    id: "sync_001",
    employerId: DEMO_EMPLOYER_ID,
    integrationId: "int_001",
    integrationName: "SeamlessHR",
    at: iso(0, 6, 12),
    method: "HRIS connector",
    status: "Success",
    records: 284,
    exceptionsRaised: 6,
    message: "284 records normalised · 6 exceptions raised",
  },
  {
    id: "sync_002",
    employerId: DEMO_EMPLOYER_ID,
    integrationId: "int_004",
    integrationName: "Time & attendance API",
    at: iso(-1, 20, 40),
    method: "Attendance system",
    status: "Failed",
    records: 0,
    exceptionsRaised: 1,
    message: "Connection timed out — attendance for 3 sites not received",
  },
  {
    id: "sync_003",
    employerId: DEMO_EMPLOYER_ID,
    integrationId: "int_002",
    integrationName: "Sage Payroll",
    at: iso(-1, 2, 0),
    method: "Payroll connector",
    status: "Partial",
    records: 281,
    exceptionsRaised: 3,
    message: "3 records missing a net salary value",
  },
  {
    id: "sync_004",
    employerId: DEMO_EMPLOYER_ID,
    integrationId: "int_003",
    integrationName: "Payroll SFTP drop",
    at: iso(-2, 17, 4),
    method: "SFTP",
    status: "Late",
    records: 284,
    exceptionsRaised: 1,
    message: "File arrived 4 minutes after the agreed deadline",
  },
  {
    id: "sync_005",
    employerId: DEMO_EMPLOYER_ID,
    integrationId: "int_001",
    integrationName: "SeamlessHR",
    at: iso(-1, 6, 12),
    method: "HRIS connector",
    status: "Success",
    records: 284,
    exceptionsRaised: 2,
    message: "284 records normalised · 2 exceptions raised",
  },
];

/* -------------------------------------------------------------- exceptions */

let exceptionSeq = 0;
function exception(input: Omit<PayrollException, "id" | "reference" | "periodLabel" | "employerId">): PayrollException {
  exceptionSeq += 1;
  return {
    id: `exc_${String(exceptionSeq).padStart(4, "0")}`,
    reference: `PB-EX-${String(4100 + exceptionSeq)}`,
    employerId: DEMO_EMPLOYER_ID,
    periodLabel: CURRENT_PERIOD_LABEL,
    ...input,
  };
}

const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;

export const payrollExceptions: PayrollException[] = [
  exception({
    employeeId: unpaidLeave.employeeId,
    employeeRef: unpaidLeave.payrollId,
    employeeName: unpaidLeave.fullName,
    type: "Unpaid leave",
    severity: "Review required",
    previousValue: "0 unpaid days",
    newValue: "4 unpaid days",
    effectiveDate: iso(-4),
    source: "HRIS connector",
    recommendedAction: "Confirm the unpaid days so earned pay is recalculated for this period.",
    deadline: iso(2, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(0, 6, 12),
  }),
  exception({
    employeeId: raised.employeeId,
    employeeRef: raised.payrollId,
    employeeName: raised.fullName,
    type: "Salary increase",
    severity: "Informational",
    previousValue: money(previousGross),
    newValue: money(raised.grossSalary),
    effectiveDate: raised.salaryEffectiveDate,
    source: "HRIS connector",
    recommendedAction: "Accept to apply the new salary to this period's accrual.",
    deadline: iso(5, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(0, 6, 12),
  }),
  exception({
    employeeId: terminated.employeeId,
    employeeRef: terminated.payrollId,
    employeeName: terminated.fullName,
    type: "Termination",
    severity: "Critical",
    previousValue: "Active",
    newValue: "Terminated",
    effectiveDate: terminated.employmentEndDate ?? iso(-3),
    source: "HRIS connector",
    recommendedAction:
      "Confirm the final working day and final net pay. New availability is paused; settled transactions are unaffected.",
    deadline: iso(1, 17),
    status: "Open",
    pausesAccrual: true,
    detectedAt: iso(-1, 6, 12),
  }),
  exception({
    employeeId: newDeduction.employeeId,
    employeeRef: newDeduction.payrollId,
    employeeName: newDeduction.fullName,
    type: "New deduction",
    severity: "Review required",
    previousValue: "No cooperative loan",
    newValue: `Cooperative loan ${money(45_000)} per month`,
    effectiveDate: PERIOD_START,
    source: "Payroll connector",
    recommendedAction: "Confirm the deduction so net pay and bridgeable salary reflect it.",
    deadline: iso(3, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-1, 2, 0),
  }),
  exception({
    employeeId: overCommitted.employeeId,
    employeeRef: overCommitted.payrollId,
    employeeName: overCommitted.fullName,
    type: "Settlement exceeds net salary",
    severity: "Critical",
    previousValue: `Expected net ${money(overCommitted.reportedNetSalary)}`,
    newValue: `Settlement obligation ${money(42_000)}`,
    effectiveDate: PERIOD_START,
    source: "Payroll connector",
    recommendedAction:
      "Escalated to PayBridge operations. Confirm net pay; settlement will be rescheduled rather than over-deducted.",
    deadline: iso(1, 12),
    status: "Escalated",
    pausesAccrual: true,
    detectedAt: iso(-1, 2, 0),
  }),
  exception({
    employeeId: suspended.employeeId,
    employeeRef: suspended.payrollId,
    employeeName: suspended.fullName,
    type: "Suspension",
    severity: "Critical",
    previousValue: "Active",
    newValue: "Suspended",
    effectiveDate: iso(-5),
    source: "HRIS connector",
    recommendedAction: "Confirm whether salary continues during suspension.",
    deadline: iso(1, 17),
    status: "In review",
    assignedReviewer: "Ngozi Eze",
    pausesAccrual: true,
    detectedAt: iso(-5, 8, 30),
  }),
  exception({
    employeeRef: "KF-2287",
    type: "Employee not in current payroll",
    severity: "Critical",
    previousValue: "Present in July payroll",
    newValue: "Absent from August payroll file",
    effectiveDate: PERIOD_START,
    source: "SFTP",
    recommendedAction: "Confirm whether the employee has left. Accrual is paused until confirmed.",
    deadline: iso(1, 17),
    status: "Open",
    pausesAccrual: true,
    detectedAt: iso(-2, 17, 6),
  }),
  exception({
    employeeRef: "KF-1042 / KF-1042-A",
    type: "Duplicate employee",
    severity: "Review required",
    previousValue: "1 payroll record",
    newValue: "2 payroll records with the same bank account",
    effectiveDate: PERIOD_START,
    source: "CSV upload",
    recommendedAction: "Merge or remove the duplicate before payroll is approved.",
    deadline: iso(2, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-2, 17, 6),
  }),
  exception({
    employeeRef: "Attendance feed",
    type: "Integration failure",
    severity: "Review required",
    previousValue: "Last successful sync 21:00 yesterday",
    newValue: "Connection timed out — 3 sites missing",
    effectiveDate: iso(-1),
    source: "Attendance system",
    recommendedAction:
      "Attendance for 3 sites is missing. Grace period applies for 3 days, then accrual freezes at the last confirmed amount.",
    deadline: iso(2, 12),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-1, 20, 40),
  }),
  exception({
    employeeRef: "Payroll file · August",
    type: "Payroll file late",
    severity: "Informational",
    previousValue: "Due Friday 17:00",
    newValue: "Received Friday 17:04",
    effectiveDate: iso(-2),
    source: "SFTP",
    recommendedAction: "No action needed. Logged for the payroll submission record.",
    deadline: iso(7, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-2, 17, 4),
  }),
  exception({
    employeeId: overtime.employeeId,
    employeeRef: overtime.payrollId,
    employeeName: overtime.fullName,
    type: "Manual employer adjustment",
    severity: "Review required",
    previousValue: "No overtime",
    newValue: `Overtime ${money(38_000)} pending approval`,
    effectiveDate: iso(-1),
    source: "Manual entry",
    recommendedAction: "Approve the overtime so it counts toward earned pay this period.",
    deadline: iso(3, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-1, 14, 20),
  }),
  exception({
    employeeId: "stf_0018",
    employeeRef: record("stf_0018").payrollId,
    employeeName: record("stf_0018").fullName,
    type: "Bank account changed",
    severity: "Informational",
    previousValue: "GTBank •••• 6621",
    newValue: "Kuda •••• 1180",
    effectiveDate: iso(-1),
    source: "HRIS connector",
    recommendedAction: "Accept once the new account has been verified.",
    deadline: iso(4, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-1, 6, 12),
  }),
  exception({
    employeeId: "stf_0020",
    employeeRef: record("stf_0020").payrollId,
    employeeName: record("stf_0020").fullName,
    type: "Unusual salary variance",
    severity: "Review required",
    previousValue: money(record("stf_0020").grossSalary),
    newValue: money(Math.round(record("stf_0020").grossSalary * 0.62)),
    effectiveDate: PERIOD_START,
    source: "Payroll connector",
    recommendedAction: "A 38% drop is outside the normal range. Confirm or correct the payroll value.",
    deadline: iso(2, 17),
    status: "Open",
    pausesAccrual: false,
    detectedAt: iso(-1, 2, 0),
  }),
  exception({
    employeeId: "stf_0022",
    employeeRef: record("stf_0022").payrollId,
    employeeName: record("stf_0022").fullName,
    type: "Promotion",
    severity: "Informational",
    previousValue: "Officer",
    newValue: "Team Lead",
    effectiveDate: iso(-6),
    source: "HRIS connector",
    recommendedAction: "Accept to update the payroll record. No effect on this period's accrual.",
    deadline: iso(6, 17),
    status: "Resolved",
    resolvedAt: iso(-5, 10, 12),
    resolvedBy: "Ngozi Eze",
    resolutionNote: "Accepted — grade and title updated.",
    pausesAccrual: false,
    detectedAt: iso(-6, 6, 12),
  }),
];

/* --------------------------------------------------------- other employers */

/** A light exception load for the other live employers, for ops monitoring. */
payrollExceptions.push(
  {
    id: "exc_0101",
    reference: "PB-EX-4201",
    employerId: "emp_002",
    periodLabel: CURRENT_PERIOD_LABEL,
    employeeRef: "LR-3310",
    type: "Payroll file not received",
    severity: "Critical",
    previousValue: "Due 2 days ago",
    newValue: "Not received",
    effectiveDate: iso(-2),
    source: "SFTP",
    recommendedAction: "Grace period expires today. Accrual will freeze at the last confirmed amount.",
    deadline: iso(0, 17),
    status: "Open",
    pausesAccrual: true,
    detectedAt: iso(-2, 17, 30),
  },
  {
    id: "exc_0102",
    reference: "PB-EX-4202",
    employerId: "emp_003",
    periodLabel: CURRENT_PERIOD_LABEL,
    employeeRef: "SL-8842",
    type: "Negative or zero net pay",
    severity: "Critical",
    previousValue: "₦142,000",
    newValue: "−₦8,400",
    effectiveDate: iso(-1),
    source: "REST API",
    recommendedAction: "Deductions exceed gross pay. Correct the payroll record before approval.",
    deadline: iso(1, 17),
    status: "Open",
    pausesAccrual: true,
    detectedAt: iso(-1, 9, 5),
  },
);

export const otherEmployerIntegrations: PayrollIntegration[] = [
  {
    id: "int_101",
    employerId: "emp_002",
    name: "PaidHR",
    vendor: "PaidHR",
    category: "Payroll",
    method: "REST API",
    status: "Degraded",
    schedule: "Every 12 hours",
    lastSyncAt: iso(-2, 17, 30),
    nextSyncAt: iso(0, 17, 30),
    uptimePct: 92.3,
    recordsLastSync: 0,
    demo: true,
    errorMessage: "Payroll file not received for the current period",
  },
  {
    id: "int_102",
    employerId: "emp_003",
    name: "Workday",
    vendor: "Workday",
    category: "HRIS",
    method: "HRIS connector",
    status: "Connected",
    schedule: "Nightly at 01:00",
    lastSyncAt: iso(-1, 1, 0),
    nextSyncAt: iso(0, 1, 0),
    uptimePct: 99.1,
    recordsLastSync: 208,
    demo: true,
  },
];

payrollIntegrations.push(...otherEmployerIntegrations);
