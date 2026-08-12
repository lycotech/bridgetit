/**
 * PayBridge platform domain models.
 *
 * Single source of truth for every entity the dashboards render. These shapes
 * intentionally mirror what a real backend (Supabase/Postgres) would expose so
 * the mock service can later be swapped for live queries without touching UI.
 *
 * The payroll domain (normalised payroll records, exceptions, integrations,
 * policy and the net earnings engine's inputs and outputs) lives in
 * `payroll-models.ts` and is re-exported here so every consumer keeps one
 * import path.
 */

export * from "./payroll-models";
import type {
  AccrualResult,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
  PayrollEmployeeRecord,
  PayrollPeriod,
} from "./payroll-models";

/* ------------------------------------------------------------------ status */

export const TRANSACTION_STATUSES = [
  "Initiated",
  "Approved",
  "Processing",
  "Disbursed",
  "Settled",
  "Failed",
  "Reversed",
  "Overdue",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Statuses an employee ever sees on their own Bridge transactions. */
export const EMPLOYEE_TRANSACTION_STATUSES = [
  "Initiated",
  "Processing",
  "Disbursed",
  "Settled",
  "Failed",
  "Reversed",
] as const;

export const EMPLOYER_APPLICATION_STATUSES = [
  "New application",
  "Documents pending",
  "Under review",
  "Credit assessment",
  "Approved",
  "Rejected",
  "Suspended",
] as const;
export type EmployerApplicationStatus = (typeof EMPLOYER_APPLICATION_STATUSES)[number];

export const RECONCILIATION_STATUSES = [
  "Matched",
  "Partially matched",
  "Unmatched",
  "Investigating",
  "Resolved",
] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const RISK_LEVELS = ["Low", "Moderate", "High", "Critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const KYC_STATUSES = ["Not started", "In progress", "Submitted", "Verified", "Rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const BUFFER_STATUSES = [
  "Draft",
  "Submitted",
  "Under review",
  "Offer issued",
  "Accepted",
  "Funded",
  "Repaying",
  "Repaid",
  "Declined",
] as const;
export type BufferStatus = (typeof BUFFER_STATUSES)[number];

export const COMPLIANCE_STATUSES = ["Open", "In review", "Escalated", "Cleared", "Reported"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const TICKET_STATUSES = ["Open", "Waiting on customer", "Escalated", "Resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/* -------------------------------------------------------------------- user */

export type Role =
  | "employee"
  | "employer_admin"
  | "employer_finance"
  | "employer_hr"
  | "employer_viewer"
  | "investor"
  | "ops_officer"
  | "ops_risk"
  | "ops_compliance"
  | "ops_finance"
  | "super_admin";

export type Portal = "employee" | "employer" | "investor" | "operations";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  organisation?: string;
  /** Employer or investor record this user acts on behalf of. */
  accountId?: string;
  avatarInitials: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string;
  createdAt: string;
}

/* ---------------------------------------------------------------- employee */

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumberMasked: string;
  isPrimary: boolean;
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  staffId: string;
  employerId: string;
  employerName: string;
  department: string;
  jobTitle: string;
  /** Gross monthly salary as reported by payroll. */
  monthlySalary: number;
  /** Confirmed net salary after all payroll deductions — what Bridge is based on. */
  netSalary: number;
  /** Accrued NET earnings for the period to date. Never gross. */
  accruedSalary: number;
  availableToBridge: number;
  alreadyBridged: number;
  eligible: boolean;
  eligibilityNote?: string;
  kycStatus: KycStatus;
  nextPayday: string;
  joinedAt: string;
  wellbeingScore: number;
  savingsAllocationPct: number;
  bankAccounts: BankAccount[];
}

export interface BridgeRequest {
  id: string;
  reference: string;
  employeeId: string;
  employeeName: string;
  employerId: string;
  employerName: string;
  /** What the employee chose to bridge. Always paid in full. */
  amount: number;
  /** Service fee, added on top — never deducted from the amount received. */
  fee: number;
  /** Paid into the employee's account. Equals `amount` by design. */
  netAmount: number;
  /** Settled from payroll on payday: amount + fee. */
  settlementAmount: number;
  status: TransactionStatus;
  bankAccountId: string;
  destination: string;
  createdAt: string;
  disbursedAt?: string;
  settlementDate: string;
  timeline: TransactionEvent[];
}

export interface TransactionEvent {
  label: string;
  at: string;
  note?: string;
  state: "done" | "current" | "pending" | "failed";
}

export interface Transaction {
  id: string;
  reference: string;
  type: "Bridge" | "Salary Buffer" | "Repayment" | "Investor inflow" | "Withdrawal";
  counterparty: string;
  employerName?: string;
  amount: number;
  fee: number;
  status: TransactionStatus;
  channel: string;
  createdAt: string;
  reconciliation: ReconciliationStatus;
}

/* ---------------------------------------------------------------- employer */

/**
 * The two ways an employer can participate — the whole point of the "will
 * this create a second payroll?" objection this option pair exists to
 * answer. `existing_payroll` (the default and recommended path) keeps the
 * employer's own payroll as system of record; `paybridge_payroll` is the
 * optional full-service alternative. See PayrollSetupCard.
 */
export type PayrollModel = "existing_payroll" | "paybridge_payroll";

export interface Employer {
  id: string;
  name: string;
  rcNumber: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  employeeCount: number;
  activeEmployees: number;
  employeesUsingBridge: number;
  applicationStatus: EmployerApplicationStatus;
  approvedLimit: number;
  utilisedLimit: number;
  riskLevel: RiskLevel;
  onboardingStep: number;
  payrollDay: number;
  nextPayrollDate: string;
  payrollObligation: number;
  payrollFundsConfirmed: number;
  createdAt: string;
  payrollModel: PayrollModel;
  /** Employees whose eligibility checklist is fully satisfied — a subset of
   *  activeEmployees. Distinct from employeesUsingBridge (eligible but not
   *  necessarily activated). */
  eligibleEmployees: number;
  /** Salary Account requests currently approved and paying out — an
   *  aggregate count, not enumerated per row (see SalaryAccountRequest). */
  salaryAccountsActive: number;
}

export interface PayrollRun {
  id: string;
  employerId: string;
  period: string;
  headcount: number;
  grossAmount: number;
  uploadedBy: string;
  uploadedAt: string;
  status: "Draft" | "Validated" | "Processing" | "Reconciled" | "Failed";
  matchedRecords: number;
  flaggedRecords: number;
}

export interface SalaryBufferRequest {
  id: string;
  reference: string;
  employerId: string;
  employerName: string;
  payrollObligation: number;
  fundsConfirmed: number;
  shortfall: number;
  requestedAmount: number;
  approvedAmount?: number;
  pricingRatePct: number;
  tenorDays: number;
  status: BufferStatus;
  documents: UploadedDocument[];
  createdAt: string;
  fundedAt?: string;
  repaymentDate: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  sizeKb: number;
  uploadedAt: string;
  category: string;
}

export interface Repayment {
  id: string;
  reference: string;
  sourceType: "Salary Buffer" | "Payroll settlement";
  counterparty: string;
  employerId?: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: "Scheduled" | "Part paid" | "Paid" | "Overdue";
  reconciliation: ReconciliationStatus;
}

/* ---------------------------------------------------------------- investor */

export interface Investor {
  id: string;
  name: string;
  type: "Individual" | "Institution";
  email: string;
  kybStatus: KycStatus;
  accreditation: string;
  portfolioValue: number;
  capitalCommitted: number;
  capitalDeployed: number;
  undeployedCapital: number;
  netIncomeEarned: number;
  availableForWithdrawal: number;
  feesToDate: number;
  riskProfile: RiskLevel;
  joinedAt: string;
  bankAccounts: BankAccount[];
}

export interface Portfolio {
  id: string;
  name: string;
  summary: string;
  detail: string;
  minimumInvestment: number;
  indicativeReturnPct: number;
  tenorMonths: number;
  liquidity: string;
  riskLevel: RiskLevel;
  distributionFrequency: "Monthly" | "Quarterly" | "At maturity";
  capitalUnderManagement: number;
  capitalDeployed: number;
  investorCount: number;
  status: "Open" | "Closing soon" | "Closed";
}

export interface Investment {
  id: string;
  reference: string;
  investorId: string;
  investorName: string;
  portfolioId: string;
  portfolioName: string;
  amount: number;
  incomeEarned: number;
  feesCharged: number;
  status: "Pending funding" | "Active" | "Maturing" | "Matured" | "Withdrawn";
  startDate: string;
  maturityDate: string;
  distributionFrequency: Portfolio["distributionFrequency"];
}

export interface Withdrawal {
  id: string;
  reference: string;
  investorId: string;
  investorName: string;
  amount: number;
  bankAccountId: string;
  destination: string;
  status: "Requested" | "Under review" | "Approved" | "Paid" | "Declined";
  requestedAt: string;
  valueDate: string;
}

export interface Statement {
  id: string;
  ownerId: string;
  title: string;
  period: string;
  kind: "Statement" | "Tax report" | "Portfolio report" | "Payroll report" | "Settlement report";
  generatedAt: string;
  sizeKb: number;
}

/* ------------------------------------------------- risk, compliance, admin */

export interface RiskAlert {
  id: string;
  reference: string;
  title: string;
  entity: string;
  entityType: "Employer" | "Employee" | "Investor" | "Portfolio" | "Transaction";
  level: RiskLevel;
  detail: string;
  status: "Open" | "Monitoring" | "Mitigated" | "Closed";
  raisedAt: string;
  owner: string;
}

export interface ComplianceCase {
  id: string;
  reference: string;
  subject: string;
  entity: string;
  caseType: "KYC review" | "KYB review" | "Sanctions screening" | "Transaction monitoring" | "Complaint";
  status: ComplianceStatus;
  riskLevel: RiskLevel;
  openedAt: string;
  dueAt: string;
  owner: string;
  notes: string;
}

export interface SupportTicket {
  id: string;
  reference: string;
  subject: string;
  requester: string;
  requesterType: "Employee" | "Employer" | "Investor";
  channel: "Email" | "In-app" | "Phone" | "WhatsApp";
  priority: "Low" | "Normal" | "High" | "Urgent";
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  author: string;
  authorType: "Customer" | "PayBridge";
  body: string;
  at: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entity: string;
  at: string;
  ip: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  portal: Portal;
  tone: "info" | "success" | "attention";
}

/* --------------------------------------------------------------- overviews */

export interface EmployeeOverview {
  employee: Employee;
  /** Full net earnings calculation behind every figure on this page. */
  accrual: AccrualResult;
  payrollRecord: PayrollEmployeeRecord;
  remainingAvailable: number;
  monthProgressPct: number;
  daysToPayday: number;
  recentRequests: BridgeRequest[];
  wellbeing: WellbeingMetric[];
  savings: SavingsGoal[];
  /** Four-pillar snapshot for the overview hub. */
  savingsBalance: number;
  investedValue: number;
  wellbeingScore: number;
  pillars: PillarScore[];
  topRecommendation: Recommendation | null;
}

/** Employee-facing settlement line — their own Bridge, shown only to them. */
export interface EmployeePaySettlement {
  reference: string;
  bridged: number;
  fee: number;
  settlementAmount: number;
  settlementDate: string;
  status: TransactionStatus;
}

/** A payroll change affecting this employee, in employee-safe wording. */
export interface EmployeePayChange {
  reference: string;
  type: ExceptionType;
  detectedAt: string;
  effectiveDate: string;
  status: ExceptionStatus;
  severity: ExceptionSeverity;
  message: string;
}

/** "My Pay" — the employee's own gross-to-net working for the current period. */
export interface EmployeePayView {
  employee: Employee;
  record: PayrollEmployeeRecord;
  accrual: AccrualResult;
  period: PayrollPeriod;
  maxBridgePct: number;
  settlements: EmployeePaySettlement[];
  settlementTotal: number;
  expectedTakeHome: number;
  changes: EmployeePayChange[];
}

export interface WellbeingMetric {
  label: string;
  value: number;
  target: number;
  hint: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  allocationPct: number;
  balance: number;
  target: number;
  nextDeduction: string;
  /** Structured savings product the goal is held in, when one has been chosen. */
  productId?: string;
  productName?: string;
  interestEarned?: number;
  maturesAt?: string;
}

/* --------------------------------------------------- financial wellbeing */

/** The four pillars of the PayBridge experience. Bridge is one capability, not the product. */
export const PILLARS = ["Bridge", "Save", "Invest", "Grow"] as const;
export type Pillar = (typeof PILLARS)[number];

export const SAVINGS_PLAN_TYPES = ["Flexible", "Target", "Fixed"] as const;
export type SavingsPlanType = (typeof SAVINGS_PLAN_TYPES)[number];

export interface SavingsProduct {
  id: string;
  name: string;
  type: SavingsPlanType;
  /** Shown only where the approved offering permits a published rate. */
  ratePct?: number;
  rateBasis?: string;
  tenorDays?: number;
  minimumAmount: number;
  liquidity: string;
  manager: string;
  description: string;
  disclosure: string;
  status: "Available" | "Pending approval";
}

export const ASSET_CLASSES = [
  "Money market fund",
  "Treasury bills",
  "Government bonds",
  "Mutual fund",
  "Equity fund",
  "Listed equities",
  "Managed portfolio",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const SUITABILITY_BANDS = ["Conservative", "Balanced", "Growth"] as const;
export type SuitabilityBand = (typeof SUITABILITY_BANDS)[number];

export interface InvestmentProduct {
  id: string;
  name: string;
  assetClass: AssetClass;
  manager: string;
  band: SuitabilityBand;
  /** Indicative only. Never presented as a guaranteed or promised return. */
  indicativeYieldPct?: number;
  yieldBasis?: string;
  horizon: string;
  minimumAmount: number;
  liquidity: string;
  status: "Available" | "Pending approval";
  description: string;
  disclosure: string;
}

export interface Holding {
  id: string;
  productId: string;
  productName: string;
  assetClass: AssetClass;
  manager: string;
  band: SuitabilityBand;
  contributed: number;
  value: number;
  asOf: string;
}

export interface SuitabilityQuestion {
  id: string;
  question: string;
  options: { value: string; label: string; score: number }[];
}

export interface SuitabilityProfile {
  completed: boolean;
  band?: SuitabilityBand;
  score: number;
  reviewedAt?: string;
  answers: { questionId: string; value: string; score: number }[];
  /** True once the assessment is older than twelve months. */
  needsReview: boolean;
}

export interface PillarScore {
  pillar: Pillar;
  score: number;
  summary: string;
}

export interface WellbeingInsight {
  id: string;
  pillar: Pillar;
  title: string;
  body: string;
  observedAt: string;
}

export interface Recommendation {
  id: string;
  pillar: Pillar;
  title: string;
  body: string;
  /** What it could change for the employee, in plain words. */
  impact: string;
  actionLabel: string;
  actionTo: string;
  /** True when following it would reduce how much Bridge the employee needs. */
  reducesBridgeUse: boolean;
  dismissed: boolean;
}

export interface LearningModule {
  id: string;
  title: string;
  category: string;
  minutes: number;
  summary: string;
  takeaway: string;
  progressPct: number;
}

export interface WellbeingReport {
  score: number;
  band: "Building" | "Steady" | "Strong";
  pillars: PillarScore[];
  insights: WellbeingInsight[];
  recommendations: Recommendation[];
  learning: LearningModule[];
  /** Bridge fees the employee has avoided since following their plan. */
  feesAvoided: number;
  bridgeTrend: SeriesPoint[];
}

/* --------------------------------------------------- employer privacy layer */

/**
 * EMPLOYEE FINANCIAL PRIVACY
 *
 * An employer never receives an employee's personal financial behaviour. The
 * three types below are the complete set of employee-related data an employer
 * portal is allowed to hold:
 *
 *  - `EmployerEmployeeRecord` — payroll and eligibility facts the employer
 *    already owns. No Bridge usage, savings, investments, wellbeing score,
 *    insights or bank details.
 *  - `EmployerBridgeSummary` — company-level aggregates only.
 *  - `PayrollDeductionLine` — the minimum needed to run payroll, and only for
 *    users holding `employer.payroll.reconcile`.
 */

/** Payroll and eligibility only. Deliberately omits all financial behaviour. */
export interface EmployerEmployeeRecord {
  id: string;
  fullName: string;
  staffId: string;
  department: string;
  jobTitle: string;
  payrollId: string;
  monthlySalary: number;
  netSalary: number;
  employmentStatus: string;
  /** Whether earned-pay accrual is running. Not whether the employee uses it. */
  accrualActive: boolean;
  accrualNote?: string;
  dataSource: string;
  lastUpdatedAt: string;
  eligible: boolean;
  eligibilityNote?: string;
  kycStatus: KycStatus;
  nextPayday: string;
  joinedAt: string;
}

export type SalaryAccountRequestStatus = "pending_review" | "approved" | "rejected" | "active" | "suspended";

/**
 * Option A ("keep your payroll, add PayBridge"): an employee has voluntarily
 * asked their employer to redirect their salary-payment destination to a
 * PayBridge Salary Account. This is the one deliberate, narrow exception to
 * this file's "no bank details" rule above — HR needs to see which
 * destination account it is approving, exactly as any payroll system already
 * holds a destination account for every employee. Both accounts are masked
 * to last four digits, never shown in full, and nothing else about the
 * employee's PayBridge activity (why they enrolled, balances, usage) rides
 * along with it.
 */
export interface SalaryAccountRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  staffId: string;
  currentBank: string;
  currentAccountMasked: string;
  newPartnerBank: string;
  newAccountMasked: string;
  requestedAt: string;
  status: SalaryAccountRequestStatus;
  decidedAt?: string;
  decidedBy?: string;
  consent: {
    signedAt: string;
    deviceRef: string;
    consentReferenceId: string;
  };
}

/**
 * One line per employee per payroll period: the amount to deduct and the
 * reference to settle against. No amount bridged, no dates, no frequency and
 * no reason for the deduction.
 */
export interface PayrollDeductionLine {
  employeeRef: string;
  employeeName: string;
  deduction: number;
  settlementReference: string;
  period: string;
  status: "Scheduled" | "Settled";
}

/** Company-level aggregates. Nothing here can be traced to one employee. */
export interface EmployerBridgeSummary {
  period: string;
  volumeSeries: SeriesPoint[];
  adoptionSeries: SeriesPoint[];
  utilisationSeries: SeriesPoint[];
  volumeThisCycle: number;
  deductionThisCycle: number;
  /**
   * `undefined` means the cohort was smaller than `MIN_DISCLOSABLE_COHORT` and
   * the figure has been withheld — NOT that it was zero. Both of these are
   * optional for the same reason: paired with the cycle total, a count or an
   * average over one or two people discloses those people's exact amounts, which
   * an employer is never permitted to see.
   */
  employeesSupported?: number;
  enrolledEmployees: number;
  activeEmployees: number;
  adoptionPct: number;
  averageDeduction?: number;
  settlementProgressPct: number;
  utilisationOfEarnedPct: number;
  savingsParticipationPct: number;
  wellbeingParticipationPct: number;
  averageWellbeingScore: number;
}

export interface EmployerOverview {
  employer: Employer;
  projectedShortfall: number;
  approvedBuffer: number;
  utilisationPct: number;
  bridgeActivity: SeriesPoint[];
  upcomingRepayments: Repayment[];
  summary: EmployerBridgeSummary;
  salaryAccountsPending: number;
}

export interface InvestorOverview {
  investor: Investor;
  performance: SeriesPoint[];
  allocation: AllocationSlice[];
  investments: Investment[];
}

export interface OperationsOverview {
  activeEmployers: number;
  activeEmployees: number;
  approvedInvestors: number;
  availableCapital: number;
  deployedCapital: number;
  bridgeTransactionsToday: number;
  bridgeValueToday: number;
  salaryBufferExposure: number;
  repaymentsDue: number;
  failedTransactions: number;
  riskAlerts: number;
  complianceAlerts: number;
  volume: SeriesPoint[];
  capitalSplit: AllocationSlice[];
}

export interface SeriesPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface AllocationSlice {
  label: string;
  value: number;
  tone: "primary" | "available" | "protected" | "gold" | "muted";
}
