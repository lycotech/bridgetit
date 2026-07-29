/**
 * PAYBRIDGE PAYROLL — normalised payroll domain model.
 *
 * Every payroll source (REST API, CSV, SFTP, webhook, HRIS or payroll
 * connector, manual entry) maps into the shapes below. Nothing downstream —
 * the net earnings engine, the exception inbox, settlement export — knows
 * which system the data came from. That is the point: no payroll vendor is
 * hard-coded into the platform.
 *
 * Privacy boundary: these types describe payroll and employment facts the
 * employer already owns. An employee's Bridge, savings, investment or
 * wellbeing behaviour never appears here.
 */

import type { SeriesPoint } from "./models";

/* ------------------------------------------------------------ enumerations */

export const EMPLOYMENT_STATUSES = [
  "Active",
  "Probation",
  "On paid leave",
  "On unpaid leave",
  "Suspended",
  "Notice period",
  "Resigned",
  "Terminated",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Statuses where salary continues to accrue day by day. */
export const ACCRUING_STATUSES: EmploymentStatus[] = [
  "Active",
  "Probation",
  "On paid leave",
  "Notice period",
];

export const PAYROLL_FREQUENCIES = ["Monthly", "Bi-weekly", "Weekly", "Daily"] as const;
export type PayrollFrequency = (typeof PAYROLL_FREQUENCIES)[number];

/** How a payroll record reached PayBridge. Shown on every record and exception. */
export const PAYROLL_DATA_SOURCES = [
  "REST API",
  "CSV upload",
  "SFTP",
  "Webhook",
  "Payroll connector",
  "HRIS connector",
  "Attendance system",
  "Manual entry",
] as const;
export type PayrollDataSource = (typeof PAYROLL_DATA_SOURCES)[number];

/** Employer confirmation state of a single payroll record. */
export const PAYROLL_APPROVAL_STATUSES = [
  "Confirmed",
  "Pending review",
  "On hold",
  "Rejected",
] as const;
export type PayrollApprovalStatus = (typeof PAYROLL_APPROVAL_STATUSES)[number];

/**
 * Where a deduction sits in the gross-to-net waterfall.
 *
 *  Statutory | Recurring | Variable | Obligation  → reduce gross to net
 *  Commitment                                     → reduce net to bridgeable
 */
export const DEDUCTION_KINDS = ["Statutory", "Recurring", "Variable", "Obligation", "Commitment"] as const;
export type DeductionKind = (typeof DEDUCTION_KINDS)[number];

export const EXCEPTION_SEVERITIES = ["Informational", "Review required", "Critical"] as const;
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

export const EXCEPTION_STATUSES = [
  "Open",
  "In review",
  "Information requested",
  "Accepted",
  "Rejected",
  "Resolved",
  "Escalated",
] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

/** Every condition that interrupts silent, automatic accrual. */
export const EXCEPTION_TYPES = [
  "Unpaid leave",
  "Absence affecting payroll",
  "Suspension",
  "Termination",
  "Resignation",
  "Salary increase",
  "Salary decrease",
  "Promotion",
  "Payroll hold",
  "New deduction",
  "Deduction removed",
  "Loan deduction changed",
  "Cooperative deduction changed",
  "Court-ordered deduction",
  "Payroll calendar changed",
  "Employee ID mismatch",
  "Duplicate employee",
  "Missing net salary",
  "Gross and net inconsistency",
  "Payroll file not received",
  "Payroll file late",
  "Employee not in current payroll",
  "Unusual salary variance",
  "Negative or zero net pay",
  "Retroactive adjustment",
  "Manual employer adjustment",
  "HRIS and payroll conflict",
  "Settlement exceeds net salary",
  "Bank account changed",
  "Integration failure",
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

/** What PayBridge does when payroll data does not arrive on time. */
export const FALLBACK_RULES = [
  "Continue accrual for a grace period",
  "Freeze accrual at last confirmed amount",
  "Suspend new Bridge availability",
  "Require manual payroll confirmation",
] as const;
export type FallbackRule = (typeof FALLBACK_RULES)[number];

/** Ordered stages of a payroll cycle — drives the command centre timeline. */
export const PAYROLL_STAGES = [
  "Payroll open",
  "Data collection",
  "Exceptions review",
  "Payroll calculation",
  "Approval",
  "Funding",
  "Disbursement",
  "Reconciliation",
  "Statutory remittance",
  "Payroll closed",
] as const;
export type PayrollStage = (typeof PAYROLL_STAGES)[number];

export const PAYROLL_CYCLE_STATUSES = [
  "On track",
  "Review required",
  "Funding required",
  "Approval pending",
  "Processing",
  "Completed",
  "Reconciliation required",
] as const;
export type PayrollCycleStatus = (typeof PAYROLL_CYCLE_STATUSES)[number];

export const INTEGRATION_STATUSES = [
  "Connected",
  "Sandbox",
  "Degraded",
  "Failed",
  "Not connected",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/* ------------------------------------------------------------- core record */

export interface PayrollDeduction {
  id: string;
  label: string;
  kind: DeductionKind;
  amount: number;
  /** Variable deductions only apply once the employer has approved them. */
  approved: boolean;
  effectiveDate: string;
  source: PayrollDataSource;
  note?: string;
}

/**
 * One employee, one payroll period. This is the normalised structure every
 * connector maps into — the single shape the rest of the platform reads.
 */
export interface PayrollEmployeeRecord {
  id: string;
  /** PayBridge employee id. */
  employeeId: string;
  /** The employer's own payroll number. */
  payrollId: string;
  employerId: string;
  employerName: string;
  fullName: string;
  department: string;
  jobTitle: string;
  employmentStatus: EmploymentStatus;
  employmentStartDate: string;
  employmentEndDate?: string;
  payrollPeriodId: string;
  payrollFrequency: PayrollFrequency;
  payday: string;
  grossSalary: number;
  overtime: number;
  bonuses: number;
  deductions: PayrollDeduction[];
  /** Net salary as confirmed by the payroll source, for cross-checking. */
  reportedNetSalary: number;
  unpaidLeaveDays: number;
  workingDaysInPeriod: number;
  daysWorked: number;
  salaryEffectiveDate: string;
  /** PayBridge settlement already committed against this period's salary. */
  settlementObligation: number;
  adjustmentReason?: string;
  lastUpdatedAt: string;
  dataSource: PayrollDataSource;
  approvalStatus: PayrollApprovalStatus;
  accrualPaused: boolean;
  accrualPauseReason?: string;
  bankVerified: boolean;
}

/* ----------------------------------------------------------------- periods */

export interface PayrollPeriod {
  id: string;
  employerId: string;
  label: string;
  frequency: PayrollFrequency;
  startDate: string;
  endDate: string;
  payday: string;
  workingDays: number;
  elapsedWorkingDays: number;
  stage: PayrollStage;
  status: PayrollCycleStatus;
  headcount: number;
  grossPayroll: number;
  totalDeductions: number;
  netPayroll: number;
  settlementObligation: number;
  statutoryLiability: number;
  fundsConfirmed: number;
  approvalStatus: "Not started" | "Awaiting review" | "Awaiting authorisation" | "Approved";
  approvedBy?: string;
  approvedAt?: string;
}

/* -------------------------------------------------------------- exceptions */

export interface PayrollException {
  id: string;
  reference: string;
  employerId: string;
  employeeId?: string;
  /** Employer's payroll id — the identifier used in exception review. */
  employeeRef: string;
  /** Shown only where operationally required to resolve the exception. */
  employeeName?: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  previousValue: string;
  newValue: string;
  effectiveDate: string;
  source: PayrollDataSource;
  recommendedAction: string;
  deadline: string;
  status: ExceptionStatus;
  assignedReviewer?: string;
  /** True when this exception has paused new Bridge availability. */
  pausesAccrual: boolean;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  periodLabel: string;
}

/* ------------------------------------------------------------ integrations */

export interface PayrollIntegration {
  id: string;
  employerId: string;
  name: string;
  vendor: string;
  category: "Payroll" | "HRIS" | "Attendance" | "Accounting" | "File transfer" | "API";
  method: PayrollDataSource;
  status: IntegrationStatus;
  schedule: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  uptimePct: number;
  recordsLastSync: number;
  /** Demo connectors are labelled in the UI — never presented as live. */
  demo: boolean;
  errorMessage?: string;
}

export interface PayrollSyncEvent {
  id: string;
  employerId: string;
  integrationId: string;
  integrationName: string;
  at: string;
  method: PayrollDataSource;
  status: "Success" | "Partial" | "Failed" | "Late";
  records: number;
  exceptionsRaised: number;
  message: string;
}

/* ------------------------------------------------------------------ policy */

/**
 * Approved once at onboarding, versioned thereafter. This is what the employer
 * signs off — not each employee's earnings, every week.
 */
export interface PayrollPolicy {
  employerId: string;
  version: number;
  frequency: PayrollFrequency;
  payrollCalendar: string;
  paydayRule: string;
  netMethod: "Confirmed payroll net" | "PayBridge gross-to-net calculation";
  eligibleCategories: string[];
  maxBridgePct: number;
  minimumMonthsService: number;
  protectedDeductions: string[];
  excludedDeductions: string[];
  gracePeriodDays: number;
  submissionSchedule: string;
  submissionDeadline: string;
  fallbackRule: FallbackRule;
  autoPauseOnCritical: boolean;
  allowBulkAcceptLowRisk: boolean;
  approvers: { payrollAdmin: string; hrAdmin: string; financeAuthoriser: string };
  approvedBy: string;
  approvedAt: string;
}

/* ------------------------------------------------- net earnings engine i/o */

export interface NetEarningsBreakdown {
  gross: number;
  overtime: number;
  bonuses: number;
  grossEarnings: number;
  statutory: number;
  recurring: number;
  variable: number;
  obligations: number;
  netSalary: number;
  protectedCommitments: number;
  settlementObligations: number;
  bridgeableSalary: number;
  lines: PayrollDeduction[];
  /** Reported net differs from calculated net — raises an exception. */
  netVariance: number;
}

export interface AccrualResult {
  breakdown: NetEarningsBreakdown;
  workingDays: number;
  unpaidLeaveDays: number;
  eligibleWorkingDays: number;
  daysCompleted: number;
  netDailyEarnings: number;
  accruedNetEarnings: number;
  maxBridgePct: number;
  maxAvailableToBridge: number;
  alreadyBridged: number;
  availableToBridge: number;
  paused: boolean;
  pauseReason?: string;
  payday: string;
  periodLabel: string;
  asOf: string;
}

/* ----------------------------------------------------------------- health */

/** Employer-facing payroll health summary — the exception inbox header. */
export interface PayrollHealth {
  employerId: string;
  periodLabel: string;
  totalEmployees: number;
  accruingNormally: number;
  exceptionsOpen: number;
  criticalExceptions: number;
  accrualsPaused: number;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncStatus: "Healthy" | "Late" | "Failed";
  fallbackApplied?: FallbackRule;
}

/** Command-centre figures for the current cycle. */
export interface PayrollCommandCentre {
  period: PayrollPeriod;
  health: PayrollHealth;
  policy: PayrollPolicy;
  activeEmployees: number;
  fundingGap: number;
  bufferAvailable: number;
  settlementObligation: number;
  statutoryStatus: "Not due" | "Scheduled" | "Remitted";
  disbursementStatus: "Not started" | "Scheduled" | "Processing" | "Paid";
  netPayrollTrend: SeriesPoint[];
}

/* ------------------------------------------------------------- settlements */

/**
 * Per-employee settlement line. NOT privacy-preserving, despite what an earlier
 * version of this comment claimed: `settlementAmount` IS that person's Bridge
 * amount plus their fee, next to their name and payroll ID. Knowing the line
 * exists is knowing they bridged.
 *
 * INTERNAL ONLY. This type may be returned to PayBridge operations, who settle
 * and reconcile it. It must never reach an employer surface — see
 * `EmployerSettlementInstruction` for what the employer gets instead.
 */
export interface SettlementLine {
  employeeRef: string;
  employeeName: string;
  period: string;
  settlementAmount: number;
  reference: string;
  description: "PayBridge Settlement" | "PayBridge Payroll Adjustment";
  status: "Scheduled" | "Settled" | "Deferred";
}

/**
 * What the employer actually receives: ONE line per payroll period, being the
 * single amount to deduct and remit.
 *
 * WHY the per-person breakdown is not here. An employer cannot be shown which
 * of their staff used Bridge, or how much any one of them took. Removing the
 * name is not enough on its own — a column of individual amounts sitting beside
 * a staff roster is re-identifiable, especially in a small department, and the
 * old per-line reference embedded the payroll ID (`PB-STL-EMP0042-JAN`), so it
 * named the person even with the name column deleted.
 *
 * `employeesIncluded` is a count, and it is suppressed below
 * `MIN_DISCLOSABLE_COHORT`: "1 employee" plus a total is that employee's exact
 * amount, which is the individual disclosure the count was meant to avoid.
 */
export interface EmployerSettlementInstruction {
  /** Opaque per-cycle id. Derived from the period, never from an employee. */
  reference: string;
  period: string;
  payday: string;
  /** Total to deduct across all participating employees, in one figure. */
  totalToDeduct: number;
  /** `undefined` means "fewer than the disclosure threshold" — not "none". */
  employeesIncluded?: number;
  description: "PayBridge Settlement";
  status: "Scheduled" | "Settled" | "Deferred";
}

/**
 * Smallest cohort PayBridge will report a count or an average for.
 *
 * Five is the usual floor for this kind of statistical disclosure control. Below
 * it, an aggregate stops being an aggregate: with two participants and a total,
 * either one of them can subtract their own amount and learn the other's.
 */
export const MIN_DISCLOSABLE_COHORT = 5;

/* ------------------------------------------------------------- ops monitor */

export interface PayrollOpsRow {
  employerId: string;
  employerName: string;
  mode: "Native payroll" | "Integration" | "Manual";
  periodLabel: string;
  payday: string;
  syncStatus: "Healthy" | "Late" | "Failed";
  lastSyncAt?: string;
  nextSyncAt?: string;
  openExceptions: number;
  criticalExceptions: number;
  accrualsPaused: number;
  fundingGap: number;
  settlementObligation: number;
  uptimePct: number;
  stage: PayrollStage;
}
