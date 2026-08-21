/**
 * Central mock data service.
 *
 * Every dashboard reads and writes through this module only — no component
 * touches the seed arrays directly. Swapping this file for Supabase (or the
 * Hono backend) is the single integration point for going live.
 */

import { daysBetween, makeReference, naira } from "./format";
import * as seed from "./mock-data";
import * as payrollSeed from "./payroll-data";
import { computeAccrual, computeNetEarnings, summarisePayroll } from "./net-earnings";
import { ACCRUING_STATUSES, MIN_DISCLOSABLE_COHORT, PAYROLL_STAGES } from "./payroll-models";
import type {
  AllocationSlice,
  AuditLog,
  BankAccount,
  BridgeRequest,
  ComplianceCase,
  Employee,
  Employer,
  EmployeeOverview,
  EmployeePayView,
  EmployerBridgeSummary,
  EmployerEmployeeRecord,
  EmployerOverview,
  PayrollDeductionLine,
  Holding,
  Investment,
  InvestmentProduct,
  Investor,
  InvestorOverview,
  LearningModule,
  Notification,
  OperationsOverview,
  PayrollRun,
  PillarScore,
  Portal,
  Portfolio,
  Repayment,
  RiskAlert,
  Recommendation,
  Referral,
  SalaryAccountRequest,
  SalaryBufferRequest,
  SavingsGoal,
  SavingsProduct,
  Statement,
  SuitabilityBand,
  SuitabilityProfile,
  SuitabilityQuestion,
  SupportTicket,
  Transaction,
  TransactionStatus,
  AccrualResult,
  DeductionKind,
  EmployerSettlementInstruction,
  EmploymentStatus,
  ExceptionSeverity,
  ExceptionType,
  ExceptionStatus,
  PayrollCommandCentre,
  PayrollDataSource,
  PayrollEmployeeRecord,
  PayrollException,
  PayrollHealth,
  PayrollIntegration,
  PayrollOpsRow,
  PayrollPeriod,
  PayrollPolicy,
  PayrollSyncEvent,
  SettlementLine,
  WellbeingReport,
  Withdrawal,
} from "./models";

/* ------------------------------------------------------------ in-memory db */

const db = {
  employers: [...seed.employers],
  employees: [...seed.employees],
  savingsProducts: [...seed.savingsProducts],
  investmentProducts: [...seed.investmentProducts],
  holdings: [...seed.employeeHoldings],
  learning: seed.learningModules.map((m) => ({ ...m })),
  recommendations: seed.recommendations.map((r) => ({ ...r })),
  suitability: {
    completed: false,
    score: 0,
    answers: [] as { questionId: string; value: string; score: number }[],
    needsReview: false,
  } as SuitabilityProfile,
  bridgeRequests: [...seed.bridgeRequests],
  payrollRuns: [...seed.payrollRuns],
  buffers: [...seed.salaryBufferRequests],
  salaryAccountRequests: [...seed.salaryAccountRequests],
  investors: [...seed.investors],
  portfolios: [...seed.portfolios],
  investments: [...seed.investments],
  withdrawals: [...seed.withdrawals],
  repayments: [...seed.repayments],
  transactions: [...seed.transactions],
  riskAlerts: [...seed.riskAlerts],
  complianceCases: [...seed.complianceCases],
  tickets: [...seed.supportTickets],
  auditLogs: [...seed.auditLogs],
  statements: [...seed.statements],
  notifications: [...seed.notifications],
  savings: [...seed.savingsGoals],
  referrals: [...seed.referrals],
  payrollRecords: payrollSeed.payrollRecords.map((r) => ({ ...r, deductions: [...r.deductions] })),
  payrollPeriods: payrollSeed.payrollPeriods.map((p) => ({ ...p })),
  payrollPolicies: payrollSeed.payrollPolicies.map((p) => ({ ...p })),
  payrollExceptions: payrollSeed.payrollExceptions.map((e) => ({ ...e })),
  payrollIntegrations: payrollSeed.payrollIntegrations.map((i) => ({ ...i })),
  payrollSyncEvents: [...payrollSeed.payrollSyncEvents],
};

export const DEMO_IDS = {
  employee: seed.DEMO_EMPLOYEE_ID,
  employer: seed.DEMO_EMPLOYER_ID,
  investor: seed.DEMO_INVESTOR_ID,
};

export const NEXT_PAYDAY = seed.NEXT_PAYDAY;
export const bridgeFee = seed.bridgeFee;

/** Network-ish latency so loading states are real in the prototype. */
function delay<T>(value: T, ms = 220 + Math.random() * 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function fail(message: string): never {
  throw new Error(message);
}

function logAudit(actor: string, actorRole: string, action: string, entity: string): void {
  db.auditLogs.unshift({
    id: `al_${Date.now()}`,
    actor,
    actorRole,
    action,
    entity,
    ip: "102.89.34.12",
    at: new Date().toISOString(),
  });
}

/* --------------------------------------------------------------- query keys */

export const qk = {
  employeeOverview: (id: string) => ["employee", "overview", id] as const,
  employeeRequests: (id: string) => ["employee", "requests", id] as const,
  employeeRequest: (ref: string) => ["employee", "request", ref] as const,
  employeeBanks: (id: string) => ["employee", "banks", id] as const,
  employeeSavings: (id: string) => ["employee", "savings", id] as const,
  employeeReferrals: (id: string) => ["employee", "referrals", id] as const,
  employeeSavingsProducts: () => ["employee", "savings-products"] as const,
  employeeInvestProducts: () => ["employee", "invest-products"] as const,
  employeeHoldings: (id: string) => ["employee", "holdings", id] as const,
  employeeSuitability: (id: string) => ["employee", "suitability", id] as const,
  employeeWellbeing: (id: string) => ["employee", "wellbeing", id] as const,
  employeeStatements: (id: string) => ["employee", "statements", id] as const,
  employerOverview: (id: string) => ["employer", "overview", id] as const,
  employerEmployees: (id: string) => ["employer", "employees", id] as const,
  employerSalaryAccountRequests: (id: string) => ["employer", "salary-account-requests", id] as const,
  employerSalaryAccountRequest: (id: string) => ["employer", "salary-account-request", id] as const,
  employerPayroll: (id: string) => ["employer", "payroll", id] as const,
  employerBuffers: (id: string) => ["employer", "buffers", id] as const,
  employerActivity: (id: string) => ["employer", "activity", id] as const,
  employerRepayments: (id: string) => ["employer", "repayments", id] as const,
  employerReports: (id: string) => ["employer", "reports", id] as const,
  investorOverview: (id: string) => ["investor", "overview", id] as const,
  investorPortfolios: () => ["investor", "portfolios"] as const,
  investorInvestments: (id: string) => ["investor", "investments", id] as const,
  investorTransactions: (id: string) => ["investor", "transactions", id] as const,
  investorWithdrawals: (id: string) => ["investor", "withdrawals", id] as const,
  investorStatements: (id: string) => ["investor", "statements", id] as const,
  payrollCommandCentre: (id: string) => ["payroll", "command-centre", id] as const,
  payrollRecords: (id: string) => ["payroll", "records", id] as const,
  payrollExceptions: (id: string) => ["payroll", "exceptions", id] as const,
  payrollIntegrations: (id: string) => ["payroll", "integrations", id] as const,
  payrollSettlements: (id: string) => ["payroll", "settlements", id] as const,
  payrollPolicy: (id: string) => ["payroll", "policy", id] as const,
  employeePay: (id: string) => ["employee", "pay", id] as const,
  ops: (section: string) => ["ops", section] as const,
  notifications: (portal: Portal) => ["notifications", portal] as const,
};

/* ------------------------------------------------------------------ helpers */

function employeeById(id: string): Employee {
  return db.employees.find((e) => e.id === id) ?? fail("Employee record not found");
}
function employerById(id: string): Employer {
  return db.employers.find((e) => e.id === id) ?? fail("Employer record not found");
}
function investorById(id: string): Investor {
  return db.investors.find((i) => i.id === id) ?? fail("Investor record not found");
}

const STATUS_FLOW: TransactionStatus[] = ["Initiated", "Processing", "Disbursed", "Settled"];

function rebuildTimeline(request: BridgeRequest): void {
  const index = STATUS_FLOW.indexOf(request.status);
  request.timeline = request.timeline.map((event, i) => {
    if (request.status === "Failed") {
      return { ...event, state: i < 2 ? "done" : i === 2 ? "failed" : "pending" };
    }
    if (i < index + 1) return { ...event, state: "done" };
    if (i === index + 1) return { ...event, state: index + 1 === 4 ? "pending" : "current" };
    return { ...event, state: "pending" };
  });
}


/* ------------------------------------------------------------------ payroll */

/**
 * PAYROLL ENGINE BINDING
 *
 * Every Bridge figure in the platform comes from here: a normalised payroll
 * record + the employer's approved policy, run through the net earnings
 * engine. Nothing reads gross salary to decide availability.
 */

function policyFor(employerId: string): PayrollPolicy {
  return (
    db.payrollPolicies.find((p) => p.employerId === employerId) ??
    db.payrollPolicies.find((p) => p.employerId === DEMO_IDS.employer) ??
    db.payrollPolicies[0]
  );
}

function periodFor(employerId: string): PayrollPeriod {
  return (
    db.payrollPeriods.find((p) => p.employerId === employerId) ??
    db.payrollPeriods.find((p) => p.employerId === DEMO_IDS.employer) ??
    db.payrollPeriods[0]
  );
}

function payrollRecordFor(employeeId: string): PayrollEmployeeRecord {
  return db.payrollRecords.find((r) => r.employeeId === employeeId) ?? fail("No payroll record for this employee");
}

/** Requests still riding on the current payroll cycle. */
function openRequests(employeeId: string): BridgeRequest[] {
  return db.bridgeRequests.filter(
    (r) => r.employeeId === employeeId && ["Initiated", "Processing", "Disbursed"].includes(r.status),
  );
}

function bridgedThisCycle(employeeId: string): number {
  return openRequests(employeeId).reduce((sum, r) => sum + r.amount, 0);
}

function settlementDueThisCycle(employeeId: string): number {
  return openRequests(employeeId).reduce((sum, r) => sum + r.settlementAmount, 0);
}

const OPEN_EXCEPTION_STATUSES: ExceptionStatus[] = ["Open", "In review", "Information requested", "Escalated"];

function blockingExceptionFor(employeeId: string): PayrollException | undefined {
  return db.payrollExceptions.find(
    (e) => e.employeeId === employeeId && e.pausesAccrual && OPEN_EXCEPTION_STATUSES.includes(e.status),
  );
}

/** The single source of truth for "how much can this person bridge today". */
export function accrualFor(employeeId: string): AccrualResult {
  const record = payrollRecordFor(employeeId);
  const blocking = blockingExceptionFor(employeeId);
  return computeAccrual({
    record,
    policy: policyFor(record.employerId),
    alreadyBridged: bridgedThisCycle(employeeId),
    periodLabel: periodFor(record.employerId).label,
    asOf: new Date().toISOString(),
    blockingException: blocking ? { type: blocking.type, severity: blocking.severity } : undefined,
  });
}

/**
 * Pushes the payroll truth back onto the employee record the dashboards read.
 * Called at start-up and after anything that changes payroll or Bridge state.
 */
function syncEmployeeFromPayroll(employeeId: string): void {
  const employee = db.employees.find((e) => e.id === employeeId);
  if (!employee) return;
  const record = payrollRecordFor(employeeId);
  record.settlementObligation = settlementDueThisCycle(employeeId);
  const accrual = accrualFor(employeeId);
  employee.netSalary = Math.max(0, accrual.breakdown.netSalary);
  employee.accruedSalary = accrual.accruedNetEarnings;
  employee.availableToBridge = accrual.maxAvailableToBridge;
  employee.alreadyBridged = accrual.alreadyBridged;
  if (accrual.paused) {
    employee.eligible = false;
    employee.eligibilityNote = accrual.pauseReason;
  }
}

function syncAllEmployeesFromPayroll(): void {
  db.payrollRecords.forEach((record) => syncEmployeeFromPayroll(record.employeeId));
}

syncAllEmployeesFromPayroll();

function payrollHealthFor(employerId: string): PayrollHealth {
  const records = db.payrollRecords.filter((r) => r.employerId === employerId);
  const exceptions = db.payrollExceptions.filter(
    (e) => e.employerId === employerId && OPEN_EXCEPTION_STATUSES.includes(e.status),
  );
  const integrations = db.payrollIntegrations.filter((i) => i.employerId === employerId);
  const lastSync = integrations
    .map((i) => i.lastSyncAt)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const nextSync = integrations
    .map((i) => i.nextSyncAt)
    .filter(Boolean)
    .sort()[0];
  const failing = integrations.some((i) => i.status === "Failed");
  const late = exceptions.some((e) => e.type === "Payroll file late" || e.type === "Payroll file not received");
  const paused = records.filter((r) => accrualFor(r.employeeId).paused).length;
  const employer = db.employers.find((e) => e.id === employerId);
  const total = employer?.activeEmployees ?? records.length;
  return {
    employerId,
    periodLabel: periodFor(employerId).label,
    totalEmployees: total,
    accruingNormally: Math.max(0, total - exceptions.length - paused),
    exceptionsOpen: exceptions.length,
    criticalExceptions: exceptions.filter((e) => e.severity === "Critical").length,
    accrualsPaused: paused,
    lastSyncAt: lastSync,
    nextSyncAt: nextSync,
    syncStatus: failing ? "Failed" : late ? "Late" : "Healthy",
    fallbackApplied: failing || late ? policyFor(employerId).fallbackRule : undefined,
  };
}

/**
 * Company-level Bridge aggregates. Everything an employer is allowed to see
 * about earned-pay usage — and nothing traceable to one person.
 */
function bridgeSummaryFor(employerId: string): EmployerBridgeSummary {
  const employer = employerById(employerId);
  const requests = db.bridgeRequests.filter(
    (r) => r.employerId === employerId && !["Failed", "Reversed"].includes(r.status),
  );
  const cycle = requests.filter((r) => ["Initiated", "Processing", "Disbursed"].includes(r.status));
  const volumeThisCycle = cycle.reduce((sum, r) => sum + r.amount, 0);
  const deductionThisCycle = cycle.reduce((sum, r) => sum + r.settlementAmount, 0);
  const supported = new Set(cycle.map((r) => r.employeeId)).size;
  const records = db.payrollRecords.filter((r) => r.employerId === employerId);
  const netTotal = records.reduce((sum, r) => sum + Math.max(0, computeNetEarnings(r).netSalary), 0);
  const settled = requests.filter((r) => r.status === "Settled").length;
  return {
    period: periodFor(employerId).label,
    volumeSeries: seed.employerBridgeActivity,
    adoptionSeries: seed.employerBridgeActivity.map((point) => ({
      label: point.label,
      value: Math.round((point.secondary ?? 0) / 3),
    })),
    utilisationSeries: seed.employerBridgeActivity.map((point) => ({
      label: point.label,
      value: Math.min(50, Math.round((point.value / Math.max(1, employer.payrollObligation)) * 100 * 6)),
    })),
    volumeThisCycle,
    deductionThisCycle,
    /*
     * Suppressed below the disclosure threshold. "Employees supported: 1"
     * alongside "Payroll deduction: ₦51,500" is not an aggregate — it is one
     * named-in-all-but-name person's Bridge amount, and with a small roster the
     * employer can usually work out whose. `undefined` reads as "fewer than 5",
     * which the UI states in words rather than showing a bare zero.
     */
    employeesSupported: supported >= MIN_DISCLOSABLE_COHORT ? supported : undefined,
    enrolledEmployees: employer.employeesUsingBridge,
    activeEmployees: employer.activeEmployees,
    adoptionPct: employer.activeEmployees
      ? (employer.employeesUsingBridge / employer.activeEmployees) * 100
      : 0,
    /* An average over fewer than five people is a lookup, not a statistic. */
    averageDeduction:
      supported >= MIN_DISCLOSABLE_COHORT ? Math.round(deductionThisCycle / supported) : undefined,
    settlementProgressPct: requests.length ? (settled / requests.length) * 100 : 0,
    utilisationOfEarnedPct: netTotal ? Math.min(100, (volumeThisCycle / netTotal) * 100) : 0,
    savingsParticipationPct: 42,
    wellbeingParticipationPct: 58,
    averageWellbeingScore: 71,
  };
}

/**
 * Per-employee settlement lines. INTERNAL — operations only. See the warning on
 * the `SettlementLine` type: these name the person and state their exact Bridge
 * amount, so they are the single most sensitive rows in the platform.
 */
function settlementLinesFor(employerId: string): SettlementLine[] {
  const period = periodFor(employerId);
  return db.payrollRecords
    .filter((r) => r.employerId === employerId && settlementDueThisCycle(r.employeeId) > 0)
    .map((r) => {
      const amount = settlementDueThisCycle(r.employeeId);
      const net = Math.max(0, computeNetEarnings(r).netSalary);
      return {
        employeeRef: r.payrollId,
        employeeName: r.fullName,
        period: period.label,
        settlementAmount: amount,
        reference: `PB-STL-${r.payrollId.replace(/[^A-Za-z0-9]/g, "")}-${period.label.slice(0, 3).toUpperCase()}`,
        description: amount > net ? ("PayBridge Payroll Adjustment" as const) : ("PayBridge Settlement" as const),
        status: amount > net ? ("Deferred" as const) : ("Scheduled" as const),
      };
    })
    .sort((a, b) => b.settlementAmount - a.settlementAmount);
}

/**
 * THE EMPLOYER-FACING SETTLEMENT VIEW. One line for the whole cycle.
 *
 * This function is the privacy boundary for settlement, in the same way that
 * `employerApi.employees` is the boundary for staff records: it consumes the
 * per-person lines and returns a shape that cannot carry a name, a payroll ID or
 * an individual amount, because the type has no field for one.
 *
 * The employer loses nothing operationally. Payroll posts a single deduction and
 * remits a single figure; which of their staff made up that figure is PayBridge's
 * business and, more to the point, the staff member's own.
 */
function settlementInstructionFor(employerId: string): EmployerSettlementInstruction[] {
  const lines = settlementLinesFor(employerId);
  if (lines.length === 0) return [];
  const period = periodFor(employerId);
  const total = lines.reduce((sum, line) => sum + line.settlementAmount, 0);
  const count = lines.length;
  return [
    {
      // Keyed on the cycle, not on anybody in it.
      reference: `PB-STL-${employerId.toUpperCase()}-${period.label.replace(/\s+/g, "").toUpperCase()}`,
      period: period.label,
      payday: period.payday,
      totalToDeduct: total,
      employeesIncluded: count >= MIN_DISCLOSABLE_COHORT ? count : undefined,
      description: "PayBridge Settlement" as const,
      // Deferred only if EVERY line deferred; otherwise payroll still deducts.
      status: lines.every((line) => line.status === "Deferred")
        ? ("Deferred" as const)
        : ("Scheduled" as const),
    },
  ];
}

let exceptionCounter = 5000;

/** Raises an exception and, when critical, pauses new availability. */
function raiseException(
  input: Omit<PayrollException, "id" | "reference" | "detectedAt" | "status" | "periodLabel"> & {
    status?: ExceptionStatus;
  },
): PayrollException {
  exceptionCounter += 1;
  const exception: PayrollException = {
    id: `exc_${exceptionCounter}`,
    reference: `PB-EX-${exceptionCounter}`,
    detectedAt: new Date().toISOString(),
    status: input.status ?? "Open",
    periodLabel: periodFor(input.employerId).label,
    ...input,
  };
  db.payrollExceptions.unshift(exception);
  if (exception.employeeId) syncEmployeeFromPayroll(exception.employeeId);
  db.notifications.unshift({
    id: `nt_${Date.now()}_${exceptionCounter}`,
    portal: "employer",
    tone: exception.severity === "Critical" ? "attention" : "info",
    title: `${exception.severity === "Critical" ? "Critical payroll exception" : "Payroll exception"}: ${exception.type}`,
    body: `${exception.employeeRef} · ${exception.recommendedAction}`,
    at: exception.detectedAt,
    read: false,
  });
  if (exception.pausesAccrual && exception.employeeId) {
    db.notifications.unshift({
      id: `nt_emp_${Date.now()}_${exceptionCounter}`,
      portal: "employee",
      tone: "info",
      title: "Your Bridge availability is paused",
      body: "Your employer is confirming payroll information. Nothing already sent to you is affected.",
      at: exception.detectedAt,
      read: false,
    });
  }
  logAudit("PayBridge payroll engine", "System", `Raised ${exception.type} (${exception.severity})`, `Exception · ${exception.reference}`);
  return exception;
}

/* ------------------------------------------------- financial wellbeing */

const clampScore = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** Guidance that reduces Bridge use is always surfaced first — wellbeing over volume. */
function byBridgeReduction(a: Recommendation, b: Recommendation): number {
  return Number(b.reducesBridgeUse) - Number(a.reducesBridgeUse);
}

function savingsTotal(): number {
  return db.savings.reduce((sum, goal) => sum + goal.balance, 0);
}
/** Half of a savings goal's balance becomes Bridge-eligible once it has been held 30+ days. */
export function savingsBridgeEligible(goal: SavingsGoal): number {
  if (daysBetween(goal.startedAt, new Date().toISOString()) < 30) return 0;
  return Math.floor(goal.balance * 0.5);
}
function investedTotal(): number {
  return db.holdings.reduce((sum, holding) => sum + holding.value, 0);
}
function learningProgress(): number {
  if (db.learning.length === 0) return 0;
  return db.learning.reduce((sum, module) => sum + module.progressPct, 0) / db.learning.length;
}

/** Days the savings cushion would cover, assuming three quarters of salary is committed. */
function daysOfCover(employee: Employee): number {
  const daily = (employee.monthlySalary * 0.75) / 30;
  return daily > 0 ? Math.round(savingsTotal() / daily) : 0;
}

function pillarScores(employee: Employee): PillarScore[] {
  const usedShare = employee.availableToBridge
    ? employee.alreadyBridged / employee.availableToBridge
    : 0;
  const cover = daysOfCover(employee);
  const invested = investedTotal();
  const lessonsDone = db.learning.filter((m) => m.progressPct >= 100).length;

  return [
    {
      pillar: "Bridge",
      score: clampScore(100 - usedShare * 70),
      summary:
        usedShare <= 0.3
          ? "You bring forward less of your earned pay than most people on your salary band."
          : usedShare <= 0.6
            ? "You use around half of the earned pay available to you each cycle."
            : "Most of your available earned pay is already in use this cycle.",
    },
    {
      pillar: "Save",
      score: clampScore((cover / 30) * 100),
      summary:
        cover <= 0
          ? "No cushion yet. Even a small amount each payday changes how the month feels."
          : `Your cushion covers about ${cover} ${cover === 1 ? "day" : "days"} of committed spending.`,
    },
    {
      pillar: "Invest",
      score: clampScore((invested / 250_000) * 80 + (db.suitability.completed ? 20 : 0)),
      summary:
        invested > 0
          ? `${naira(invested)} held across ${db.holdings.length} ${db.holdings.length === 1 ? "product" : "products"}, managed by ${seed.ASSET_MANAGER}.`
          : db.suitability.completed
            ? "Your suitability profile is ready. Nothing invested yet."
            : "Complete the short suitability assessment to see what fits you.",
    },
    {
      pillar: "Grow",
      score: clampScore(learningProgress()),
      summary: `${lessonsDone} of ${db.learning.length} short lessons finished.`,
    },
  ];
}

function wellbeingScore(employee: Employee): number {
  const scores = pillarScores(employee);
  return Math.round(scores.reduce((sum, p) => sum + p.score, 0) / scores.length);
}

function wellbeingBand(score: number): WellbeingReport["band"] {
  return score >= 75 ? "Strong" : score >= 50 ? "Steady" : "Building";
}

/** Service fees avoided as monthly Bridge amounts have come down. */
function feesAvoided(): number {
  const peak = Math.max(...seed.employeeBridgeTrend.map((point) => point.value));
  return seed.employeeBridgeTrend.reduce(
    (sum, point) => sum + Math.max(0, seed.bridgeFee(peak) - seed.bridgeFee(point.value)),
    0,
  );
}

const BAND_ORDER: SuitabilityBand[] = ["Conservative", "Balanced", "Growth"];

/* ------------------------------------------------------------------ employee */

export const employeeApi = {
  async overview(employeeId: string): Promise<EmployeeOverview> {
    const employee = employeeById(employeeId);
    syncEmployeeFromPayroll(employeeId);
    const accrual = accrualFor(employeeId);
    const requests = db.bridgeRequests
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return delay({
      employee,
      accrual,
      payrollRecord: payrollRecordFor(employeeId),
      remainingAvailable: accrual.availableToBridge,
      monthProgressPct: accrual.eligibleWorkingDays
        ? Math.round((accrual.daysCompleted / accrual.eligibleWorkingDays) * 100)
        : 0,
      daysToPayday: daysBetween(new Date().toISOString(), employee.nextPayday),
      recentRequests: requests.slice(0, 5),
      wellbeing: seed.wellbeingMetrics,
      savings: db.savings,
      savingsBalance: savingsTotal(),
      investedValue: investedTotal(),
      wellbeingScore: wellbeingScore(employee),
      pillars: pillarScores(employee),
      topRecommendation:
        db.recommendations.filter((r) => !r.dismissed).sort(byBridgeReduction)[0] ?? null,
    });
  },

  async requests(employeeId: string): Promise<BridgeRequest[]> {
    return delay(
      db.bridgeRequests
        .filter((r) => r.employeeId === employeeId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },

  async request(reference: string): Promise<BridgeRequest> {
    const found = db.bridgeRequests.find((r) => r.reference === reference);
    if (!found) fail("We could not find that transaction");
    return delay(found);
  },

  async createBridge(input: {
    employeeId: string;
    amount: number;
    bankAccountId: string;
  }): Promise<BridgeRequest> {
    const employee = employeeById(input.employeeId);
    /** Availability comes from confirmed net earnings — never from gross salary. */
    const accrual = accrualFor(input.employeeId);
    if (accrual.paused) fail(accrual.pauseReason ?? "Your Bridge availability is paused");
    if (input.amount <= 0) fail("Enter an amount to bridge");
    if (input.amount > accrual.availableToBridge) {
      fail("That is more than your remaining available amount");
    }
    const account =
      employee.bankAccounts.find((a) => a.id === input.bankAccountId) ?? employee.bankAccounts[0];
    const fee = seed.bridgeFee(input.amount);
    const now = new Date().toISOString();
    const request: BridgeRequest = {
      id: `br_${Date.now()}`,
      reference: makeReference("PB-BR"),
      employeeId: employee.id,
      employeeName: employee.fullName,
      employerId: employee.employerId,
      employerName: employee.employerName,
      amount: input.amount,
      fee,
      netAmount: input.amount,
      settlementAmount: input.amount + fee,
      status: "Processing",
      bankAccountId: account.id,
      destination: `${account.bankName} ${account.accountNumberMasked}`,
      createdAt: now,
      settlementDate: employee.nextPayday,
      timeline: [
        { label: "Request initiated", at: now, state: "done" },
        { label: "Approved against earned pay", at: now, state: "done" },
        { label: "Sent to disbursement partner", at: now, state: "current" },
        { label: "Disbursed to your bank", at: now, state: "pending" },
        { label: "Settled from payroll", at: employee.nextPayday, state: "pending", note: "On payday" },
      ],
    };
    db.bridgeRequests.unshift(request);
    syncEmployeeFromPayroll(employee.id);
    db.transactions.unshift({
      id: `tx_${request.id}`,
      reference: request.reference,
      type: "Bridge",
      counterparty: employee.fullName,
      employerName: employee.employerName,
      amount: request.amount,
      fee: request.fee,
      status: request.status,
      channel: "NIP transfer",
      createdAt: now,
      reconciliation: "Unmatched",
    });
    db.notifications.unshift({
      id: `nt_${Date.now()}`,
      portal: "employee",
      tone: "success",
      title: `${new Intl.NumberFormat("en-NG").format(request.netAmount)} on the way`,
      body: `Your Bridge is being sent to ${request.destination}.`,
      at: now,
      read: false,
    });
    logAudit(employee.fullName, "Employee", `Created Bridge request ${request.reference}`, "Bridge request");
    return delay(request, 900);
  },

  /** Moves a request one step along the flow — powers "Track transaction". */
  async advanceStatus(reference: string): Promise<BridgeRequest> {
    const request = db.bridgeRequests.find((r) => r.reference === reference) ?? fail("Not found");
    const index = STATUS_FLOW.indexOf(request.status);
    if (index >= 0 && index < STATUS_FLOW.length - 1) {
      request.status = STATUS_FLOW[index + 1];
      if (request.status === "Disbursed") request.disbursedAt = new Date().toISOString();
      rebuildTimeline(request);
      const tx = db.transactions.find((t) => t.reference === reference);
      if (tx) tx.status = request.status;
    }
    return delay(request, 700);
  },

  /**
   * "My Pay" — the employee's own payslip view. Employees always see their own
   * gross-to-net working; employers never see the Bridge side of it.
   */
  async pay(employeeId: string): Promise<EmployeePayView> {
    syncEmployeeFromPayroll(employeeId);
    const employee = employeeById(employeeId);
    const record = payrollRecordFor(employeeId);
    const accrual = accrualFor(employeeId);
    const period = periodFor(record.employerId);
    const policy = policyFor(record.employerId);

    const settlements = openRequests(employeeId)
      .map((r) => ({
        reference: r.reference,
        bridged: r.amount,
        fee: r.fee,
        settlementAmount: r.settlementAmount,
        settlementDate: r.settlementDate,
        status: r.status,
      }))
      .sort((a, b) => +new Date(a.settlementDate) - +new Date(b.settlementDate));

    const settlementTotal = settlements.reduce((sum, s) => sum + s.settlementAmount, 0);

    const changes = db.payrollExceptions
      .filter((e) => e.employeeId === employeeId)
      .slice(0, 6)
      .map((e) => ({
        reference: e.reference,
        type: e.type,
        detectedAt: e.detectedAt,
        effectiveDate: e.effectiveDate,
        status: e.status,
        severity: e.severity,
        /** Employee-facing wording — never blames, never exposes internal notes. */
        message:
          e.status === "Accepted" || e.status === "Resolved"
            ? `${e.type} confirmed by your employer. Your figures are up to date.`
            : `${e.type} is with your employer for confirmation.`,
      }));

    return delay({
      employee,
      record,
      accrual,
      period,
      maxBridgePct: policy.maxBridgePct,
      settlements,
      settlementTotal,
      expectedTakeHome: Math.max(0, accrual.breakdown.netSalary - settlementTotal),
      changes,
    });
  },

  async verifyOtp(code: string): Promise<true> {
    if (!/^\d{6}$/.test(code)) fail("Enter the 6-digit code");
    return delay(true, 700);
  },

  async banks(employeeId: string): Promise<BankAccount[]> {
    return delay(employeeById(employeeId).bankAccounts);
  },

  async addBank(employeeId: string, input: { bankName: string; accountNumber: string; accountName: string }): Promise<BankAccount> {
    const employee = employeeById(employeeId);
    const account: BankAccount = {
      id: `ba_${Date.now()}`,
      bankName: input.bankName,
      accountName: input.accountName,
      accountNumberMasked: `•••• ${input.accountNumber.slice(-4)}`,
      isPrimary: false,
    };
    employee.bankAccounts.push(account);
    return delay(account, 700);
  },

  async setPrimaryBank(employeeId: string, accountId: string): Promise<BankAccount[]> {
    const employee = employeeById(employeeId);
    employee.bankAccounts = employee.bankAccounts.map((a) => ({ ...a, isPrimary: a.id === accountId }));
    return delay(employee.bankAccounts, 500);
  },

  async savings(employeeId: string): Promise<SavingsGoal[]> {
    void employeeId;
    return delay(db.savings);
  },

  async updateSavings(employeeId: string, goalId: string, allocationPct: number): Promise<SavingsGoal[]> {
    const goal = db.savings.find((g) => g.id === goalId) ?? fail("Savings goal not found");
    goal.allocationPct = allocationPct;
    const employee = employeeById(employeeId);
    employee.savingsAllocationPct = db.savings.reduce((sum, g) => sum + g.allocationPct, 0);
    return delay(db.savings, 500);
  },

  async addSavingsGoal(input: {
    name: string;
    target: number;
    allocationPct: number;
    productId: string;
  }): Promise<SavingsGoal> {
    const product =
      db.savingsProducts.find((p) => p.id === input.productId) ?? fail("Savings plan not found");
    if (product.status !== "Available") {
      fail(`${product.name} is not open for new plans yet.`);
    }
    if (input.target < product.minimumAmount) {
      fail(`${product.name} starts from ${naira(product.minimumAmount)}.`);
    }
    const goal: SavingsGoal = {
      id: `sg_${Date.now()}`,
      name: input.name,
      allocationPct: input.allocationPct,
      balance: 0,
      target: input.target,
      nextDeduction: seed.NEXT_PAYDAY,
      productId: product.id,
      productName: product.name,
      interestEarned: 0,
      maturesAt: product.tenorDays
        ? new Date(Date.now() + product.tenorDays * 86_400_000).toISOString()
        : undefined,
      startedAt: new Date().toISOString(),
    };
    db.savings.push(goal);
    return delay(goal, 600);
  },

  /* --------------------------------------------------------------- Save */

  async savingsProducts(): Promise<SavingsProduct[]> {
    return delay(db.savingsProducts);
  },

  async topUpSavings(goalId: string, amount: number): Promise<SavingsGoal[]> {
    const goal = db.savings.find((g) => g.id === goalId) ?? fail("Savings plan not found");
    if (amount <= 0) fail("Enter an amount to add.");
    goal.balance += amount;
    db.notifications.unshift({
      id: `nt_${Date.now()}`,
      portal: "employee",
      tone: "success",
      title: `${naira(amount)} added to ${goal.name}`,
      body: `Your cushion is now ${naira(goal.balance)}.`,
      at: new Date().toISOString(),
      read: false,
    });
    return delay(db.savings, 600);
  },

  async withdrawSavings(goalId: string, amount: number): Promise<SavingsGoal[]> {
    const goal = db.savings.find((g) => g.id === goalId) ?? fail("Savings plan not found");
    if (amount <= 0) fail("Enter an amount to withdraw.");
    if (amount > goal.balance) fail(`${goal.name} holds ${naira(goal.balance)}.`);
    const product = db.savingsProducts.find((p) => p.id === goal.productId);
    if (product && product.liquidity !== "Instant" && goal.maturesAt && new Date(goal.maturesAt) > new Date()) {
      fail(`${goal.name} is locked until ${new Date(goal.maturesAt).toLocaleDateString("en-NG")}.`);
    }
    goal.balance -= amount;
    return delay(db.savings, 700);
  },

  /**
   * Bridge against savings held 30+ days — up to 50% of that goal's balance,
   * paid out immediately since it is the employee's own money, not an advance
   * against unearned payroll (so it does not touch `accrual.availableToBridge`).
   */
  async bridgeFromSavings(input: {
    employeeId: string;
    goalId: string;
    amount: number;
    bankAccountId: string;
  }): Promise<{ savings: SavingsGoal[]; request: BridgeRequest }> {
    const employee = employeeById(input.employeeId);
    const goal = db.savings.find((g) => g.id === input.goalId) ?? fail("Savings plan not found");
    const eligible = savingsBridgeEligible(goal);
    if (eligible <= 0) fail(`${goal.name} becomes Bridge-eligible 30 days after you start saving.`);
    if (input.amount <= 0) fail("Enter an amount to bridge");
    if (input.amount > eligible) {
      fail(`You can Bridge up to ${naira(eligible)} of ${goal.name} today.`);
    }
    const account =
      employee.bankAccounts.find((a) => a.id === input.bankAccountId) ?? employee.bankAccounts[0];
    goal.balance -= input.amount;
    const now = new Date().toISOString();
    const request: BridgeRequest = {
      id: `br_${Date.now()}`,
      reference: makeReference("PB-SV"),
      employeeId: employee.id,
      employeeName: employee.fullName,
      employerId: employee.employerId,
      employerName: employee.employerName,
      amount: input.amount,
      fee: 0,
      netAmount: input.amount,
      settlementAmount: input.amount,
      status: "Disbursed",
      bankAccountId: account.id,
      destination: `${account.bankName} ${account.accountNumberMasked}`,
      createdAt: now,
      disbursedAt: now,
      settlementDate: now,
      timeline: [
        { label: "Request initiated", at: now, state: "done" },
        { label: `Released from ${goal.name}`, at: now, state: "done" },
        { label: "Disbursed to your bank", at: now, state: "done" },
      ],
    };
    db.bridgeRequests.unshift(request);
    db.transactions.unshift({
      id: `tx_${request.id}`,
      reference: request.reference,
      type: "Bridge",
      counterparty: employee.fullName,
      employerName: employee.employerName,
      amount: request.amount,
      fee: 0,
      status: request.status,
      channel: "NIP transfer",
      createdAt: now,
      reconciliation: "Unmatched",
    });
    db.notifications.unshift({
      id: `nt_${Date.now()}`,
      portal: "employee",
      tone: "success",
      title: `${naira(request.netAmount)} on the way`,
      body: `Bridged from ${goal.name} to ${request.destination}.`,
      at: now,
      read: false,
    });
    logAudit(employee.fullName, "Employee", `Bridged ${naira(input.amount)} from savings (${goal.name})`, "Bridge request");
    return delay({ savings: db.savings, request }, 800);
  },

  /* --------------------------------------------------------------- Refer */

  async referrals(employeeId: string): Promise<Referral[]> {
    return delay(
      db.referrals
        .filter((r) => r.employeeId === employeeId)
        .sort((a, b) => +new Date(b.invitedAt) - +new Date(a.invitedAt)),
    );
  },

  async sendReferral(input: { employeeId: string; name: string; email: string }): Promise<Referral> {
    const employee = employeeById(input.employeeId);
    if (!input.name.trim()) fail("Enter their name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fail("Enter a valid email address");
    if (db.referrals.some((r) => r.employeeId === input.employeeId && r.referredEmail === input.email)) {
      fail("You have already referred this person");
    }
    const referral: Referral = {
      id: `rf_${Date.now()}`,
      employeeId: employee.id,
      referredName: input.name.trim(),
      referredEmail: input.email.trim(),
      status: "Invited",
      invitedAt: new Date().toISOString(),
      rewardAmount: 2_000,
    };
    db.referrals.unshift(referral);
    return delay(referral, 600);
  },

  /* ------------------------------------------------------------- Invest */

  async investProducts(): Promise<InvestmentProduct[]> {
    return delay(db.investmentProducts);
  },

  async suitabilityQuestions(): Promise<SuitabilityQuestion[]> {
    return delay(seed.suitabilityQuestions, 260);
  },

  async suitability(employeeId: string): Promise<SuitabilityProfile> {
    void employeeId;
    return delay(db.suitability);
  },

  async submitSuitability(
    answers: { questionId: string; value: string }[],
  ): Promise<SuitabilityProfile> {
    const scored = answers.map((answer) => {
      const question =
        seed.suitabilityQuestions.find((q) => q.id === answer.questionId) ??
        fail("Assessment question not found");
      const option =
        question.options.find((o) => o.value === answer.value) ?? fail("Answer not recognised");
      return { questionId: question.id, value: option.value, score: option.score };
    });
    if (scored.length < seed.suitabilityQuestions.length) {
      fail("Please answer every question so we can assess suitability.");
    }
    const score = scored.reduce((sum, a) => sum + a.score, 0);
    const max = seed.suitabilityQuestions.length * 3;
    const share = score / max;
    const band: SuitabilityBand = share <= 0.5 ? "Conservative" : share <= 0.75 ? "Balanced" : "Growth";
    db.suitability = {
      completed: true,
      band,
      score,
      reviewedAt: new Date().toISOString(),
      answers: scored,
      needsReview: false,
    };
    return delay(db.suitability, 700);
  },

  async holdings(employeeId: string): Promise<Holding[]> {
    void employeeId;
    return delay(db.holdings);
  },

  async invest(input: { productId: string; amount: number }): Promise<Holding> {
    const product =
      db.investmentProducts.find((p) => p.id === input.productId) ?? fail("Product not found");
    if (product.status !== "Available") {
      fail(`${product.name} is awaiting regulatory approval and is not open for investment.`);
    }
    if (!db.suitability.completed || !db.suitability.band) {
      fail("Complete the suitability assessment before investing.");
    }
    if (BAND_ORDER.indexOf(product.band) > BAND_ORDER.indexOf(db.suitability.band)) {
      fail(
        `${product.name} sits outside your ${db.suitability.band} profile. Review your assessment if your circumstances have changed.`,
      );
    }
    if (input.amount < product.minimumAmount) {
      fail(`${product.name} starts from ${naira(product.minimumAmount)}.`);
    }
    const asOf = new Date().toISOString();
    const existing = db.holdings.find((h) => h.productId === product.id);
    if (existing) {
      existing.contributed += input.amount;
      existing.value += input.amount;
      existing.asOf = asOf;
    }
    const holding: Holding =
      existing ??
      {
        id: `hd_${Date.now()}`,
        productId: product.id,
        productName: product.name,
        assetClass: product.assetClass,
        manager: product.manager,
        band: product.band,
        contributed: input.amount,
        value: input.amount,
        asOf,
      };
    if (!existing) db.holdings.push(holding);
    db.notifications.unshift({
      id: `nt_${Date.now()}`,
      portal: "employee",
      tone: "success",
      title: `${naira(input.amount)} placed in ${product.name}`,
      body: `Managed by ${product.manager}. Returns are not guaranteed.`,
      at: asOf,
      read: false,
    });
    return delay(holding, 900);
  },

  async redeem(holdingId: string, amount: number): Promise<Holding[]> {
    const holding = db.holdings.find((h) => h.id === holdingId) ?? fail("Holding not found");
    if (amount <= 0) fail("Enter an amount to redeem.");
    if (amount > holding.value) fail(`${holding.productName} is worth ${naira(holding.value)} today.`);
    holding.value -= amount;
    holding.contributed = Math.min(holding.contributed, holding.value);
    holding.asOf = new Date().toISOString();
    if (holding.value <= 0) {
      db.holdings = db.holdings.filter((h) => h.id !== holding.id);
    }
    return delay(db.holdings, 800);
  },

  /* --------------------------------------------------------------- Grow */

  async wellbeing(employeeId: string): Promise<WellbeingReport> {
    const employee = employeeById(employeeId);
    const score = wellbeingScore(employee);
    return delay({
      score,
      band: wellbeingBand(score),
      pillars: pillarScores(employee),
      insights: seed.wellbeingInsights,
      recommendations: db.recommendations.filter((r) => !r.dismissed).sort(byBridgeReduction),
      learning: db.learning,
      feesAvoided: feesAvoided(),
      bridgeTrend: seed.employeeBridgeTrend,
    });
  },

  async completeLesson(moduleId: string): Promise<LearningModule[]> {
    const module = db.learning.find((m) => m.id === moduleId) ?? fail("Lesson not found");
    module.progressPct = 100;
    return delay(db.learning, 500);
  },

  async dismissRecommendation(recommendationId: string): Promise<Recommendation[]> {
    const recommendation =
      db.recommendations.find((r) => r.id === recommendationId) ?? fail("Recommendation not found");
    recommendation.dismissed = true;
    return delay(
      db.recommendations.filter((r) => !r.dismissed).sort(byBridgeReduction),
      400,
    );
  },

  async statements(employeeId: string): Promise<Statement[]> {
    return delay(db.statements.filter((s) => s.ownerId === employeeId));
  },

  async spendPattern() {
    return delay(seed.employeeSpendPattern);
  },
};

/* ------------------------------------------------------------------ employer */

export const employerApi = {
  async overview(employerId: string): Promise<EmployerOverview> {
    const employer = employerById(employerId);
    const buffer = db.buffers.find(
      (b) => b.employerId === employerId && ["Funded", "Accepted", "Repaying"].includes(b.status),
    );
    return delay({
      employer,
      projectedShortfall: Math.max(0, employer.payrollObligation - employer.payrollFundsConfirmed),
      approvedBuffer: buffer?.approvedAmount ?? 0,
      utilisationPct: employer.approvedLimit
        ? (employer.utilisedLimit / employer.approvedLimit) * 100
        : 0,
      bridgeActivity: seed.employerBridgeActivity,
      upcomingRepayments: db.repayments.filter((r) => r.employerId === employerId),
      summary: bridgeSummaryFor(employerId),
      salaryAccountsPending: db.salaryAccountRequests.filter((r) => {
        const owner = db.employees.find((e) => e.id === r.employeeId);
        return owner?.employerId === employerId && r.status === "pending_review";
      }).length,
    });
  },

  /**
   * PRIVACY BOUNDARY. Employers receive payroll and eligibility fields only.
   * Bridge amounts, frequency, savings, investments and wellbeing never leave
   * this function — the return type cannot even carry them.
   */
  async employees(employerId: string): Promise<EmployerEmployeeRecord[]> {
    const rows: EmployerEmployeeRecord[] = db.employees
      .filter((e) => e.employerId === employerId)
      .map((employee) => {
        const record = db.payrollRecords.find((r) => r.employeeId === employee.id);
        const accrual = record ? accrualFor(employee.id) : undefined;
        return {
          id: employee.id,
          fullName: employee.fullName,
          staffId: employee.staffId,
          department: employee.department,
          jobTitle: employee.jobTitle,
          payrollId: record?.payrollId ?? employee.staffId,
          monthlySalary: employee.monthlySalary,
          netSalary: accrual ? Math.max(0, accrual.breakdown.netSalary) : employee.netSalary,
          employmentStatus: record?.employmentStatus ?? "Active",
          accrualActive: employee.eligible && !(accrual?.paused ?? false),
          accrualNote: accrual?.pauseReason ?? employee.eligibilityNote,
          dataSource: record?.dataSource ?? "Manual entry",
          lastUpdatedAt: record?.lastUpdatedAt ?? employee.joinedAt,
          eligible: employee.eligible,
          eligibilityNote: employee.eligibilityNote,
          kycStatus: employee.kycStatus,
          nextPayday: record?.payday ?? employee.nextPayday,
          joinedAt: employee.joinedAt,
        };
      });
    return delay(rows);
  },

  async setEligibility(employeeIds: string[], eligible: boolean): Promise<number> {
    db.employees.forEach((e) => {
      if (employeeIds.includes(e.id)) {
        e.eligible = eligible;
        e.eligibilityNote = eligible ? undefined : "Deactivated by employer";
      }
    });
    return delay(employeeIds.length, 600);
  },

  /** Which of the two payroll participation models this employer runs today. */
  async setPayrollModel(employerId: string, model: Employer["payrollModel"]): Promise<Employer> {
    const employer = employerById(employerId);
    employer.payrollModel = model;
    return delay(employer, 500);
  },

  /**
   * Salary Account requests for Option A ("keep your payroll, add
   * PayBridge"). Employer-scoped by matching the requesting employee's
   * `employerId` — the same narrow, masked-only exception documented on
   * `SalaryAccountRequest` in models.ts.
   */
  async salaryAccountRequests(employerId: string): Promise<SalaryAccountRequest[]> {
    const employeeIds = new Set(db.employees.filter((e) => e.employerId === employerId).map((e) => e.id));
    return delay(
      db.salaryAccountRequests
        .filter((r) => employeeIds.has(r.employeeId))
        .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)),
    );
  },

  async salaryAccountRequest(employerId: string, id: string): Promise<SalaryAccountRequest> {
    const employeeIds = new Set(db.employees.filter((e) => e.employerId === employerId).map((e) => e.id));
    const request = db.salaryAccountRequests.find((r) => r.id === id && employeeIds.has(r.employeeId));
    if (!request) return fail("Salary Account request not found");
    return delay(request);
  },

  /**
   * HR's whole action, per the brief: change one payroll field, nothing
   * else. Approving does not move money or touch payroll calculation — it
   * only updates the destination account this mock roster shows for this
   * employee, exactly as a real payroll system's bank-detail field would be.
   */
  async decideSalaryAccountRequest(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
  ): Promise<SalaryAccountRequest> {
    const request = db.salaryAccountRequests.find((r) => r.id === id);
    if (!request) return fail("Salary Account request not found");
    request.status = decision === "approved" ? "active" : "rejected";
    request.decidedAt = new Date().toISOString();
    request.decidedBy = decidedBy;
    if (decision === "approved") {
      const employer = db.employers.find((e) =>
        db.employees.some((emp) => emp.id === request.employeeId && emp.employerId === e.id),
      );
      if (employer) employer.salaryAccountsActive += 1;
    }
    return delay(request, 700);
  },

  async payrollRuns(employerId: string): Promise<PayrollRun[]> {
    return delay(
      db.payrollRuns
        .filter((p) => p.employerId === employerId)
        .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)),
    );
  },

  async uploadPayroll(input: {
    employerId: string;
    period: string;
    fileName: string;
    headcount: number;
    grossAmount: number;
    uploadedBy: string;
    kind: "Payroll" | "Accrued salary";
  }): Promise<PayrollRun> {
    const flagged = Math.max(0, Math.round(input.headcount * 0.01));
    const run: PayrollRun = {
      id: `pr_${Date.now()}`,
      employerId: input.employerId,
      period: input.period,
      headcount: input.headcount,
      grossAmount: input.grossAmount,
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date().toISOString(),
      status: flagged ? "Validated" : "Validated",
      matchedRecords: input.headcount - flagged,
      flaggedRecords: flagged,
    };
    db.payrollRuns.unshift(run);
    const employer = employerById(input.employerId);
    if (input.kind === "Payroll") {
      employer.payrollObligation = input.grossAmount;
    }
    logAudit(input.uploadedBy, "Employer", `Uploaded ${input.kind.toLowerCase()} file ${input.fileName}`, `Employer · ${employer.name}`);
    return delay(run, 1100);
  },

  async confirmPayrollFunds(employerId: string, amount: number): Promise<Employer> {
    const employer = employerById(employerId);
    employer.payrollFundsConfirmed = amount;
    return delay(employer, 600);
  },

  async buffers(employerId: string): Promise<SalaryBufferRequest[]> {
    return delay(
      db.buffers
        .filter((b) => b.employerId === employerId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  },

  async createBuffer(input: {
    employerId: string;
    payrollObligation: number;
    fundsConfirmed: number;
    requestedAmount: number;
    tenorDays: number;
    documents: { name: string; sizeKb: number; category: string }[];
    createdBy: string;
  }): Promise<SalaryBufferRequest> {
    const employer = employerById(input.employerId);
    if (input.requestedAmount <= 0) fail("Enter the buffer amount you need");
    const shortfall = Math.max(0, input.payrollObligation - input.fundsConfirmed);
    const now = new Date().toISOString();
    const request: SalaryBufferRequest = {
      id: `sbr_${Date.now()}`,
      reference: makeReference("PB-SB"),
      employerId: employer.id,
      employerName: employer.name,
      payrollObligation: input.payrollObligation,
      fundsConfirmed: input.fundsConfirmed,
      shortfall,
      requestedAmount: input.requestedAmount,
      approvedAmount: input.requestedAmount,
      pricingRatePct: 3.5,
      tenorDays: input.tenorDays,
      status: "Offer issued",
      documents: input.documents.map((doc, i) => ({
        id: `doc_${Date.now()}_${i}`,
        name: doc.name,
        sizeKb: doc.sizeKb,
        category: doc.category,
        uploadedAt: now,
      })),
      createdAt: now,
      repaymentDate: employer.nextPayrollDate,
    };
    db.buffers.unshift(request);
    employer.payrollObligation = input.payrollObligation;
    employer.payrollFundsConfirmed = input.fundsConfirmed;
    logAudit(input.createdBy, "Employer", `Requested Salary Buffer ${request.reference}`, `Employer · ${employer.name}`);
    return delay(request, 1200);
  },

  async acceptBufferOffer(reference: string, acceptedBy: string): Promise<SalaryBufferRequest> {
    const buffer = db.buffers.find((b) => b.reference === reference) ?? fail("Request not found");
    buffer.status = "Accepted";
    logAudit(acceptedBy, "Employer", `Accepted Salary Buffer terms ${reference}`, `Employer · ${buffer.employerName}`);
    return delay(buffer, 800);
  },

  /**
   * Company aggregates plus the settlement lines payroll must deduct.
   * No individual request rows, amounts bridged, dates or frequencies.
   */
  /**
   * PRIVACY BOUNDARY. Company aggregates plus the single settlement instruction.
   *
   * This used to return `settlements: SettlementLine[]` — every participating
   * employee by name, with their payroll ID and their exact deduction — and the
   * employer's page rendered them in a sortable, exportable table underneath a
   * panel promising that none of it was visible. The promise was the accurate
   * description of the intent; the table was the bug.
   */
  async bridgeActivity(
    employerId: string,
  ): Promise<{ summary: EmployerBridgeSummary; settlements: EmployerSettlementInstruction[] }> {
    return delay({
      summary: bridgeSummaryFor(employerId),
      settlements: settlementInstructionFor(employerId),
    });
  },

  async repayments(employerId: string): Promise<Repayment[]> {
    return delay(db.repayments.filter((r) => r.employerId === employerId));
  },

  async reports(employerId: string): Promise<Statement[]> {
    return delay(db.statements.filter((s) => s.ownerId === employerId));
  },
};


/* --------------------------------------------------------- paybridge payroll */

/** Money embedded in an exception value string, e.g. "₦520,000" → 520000. */
function parseAmount(value: string): number | undefined {
  const digits = value.replace(/[^0-9.]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function parseDays(value: string): number | undefined {
  const match = value.match(/(\d+(?:\.\d+)?)\s*day/i);
  return match ? Number(match[1]) : undefined;
}

/**
 * Applies an accepted exception to the payroll record.
 *
 * This only ever changes future accrual. Bridge transactions that have already
 * been disbursed are never altered, reversed or re-priced here — a shortfall
 * becomes an operations reconciliation item instead.
 */
function applyException(exception: PayrollException): void {
  if (!exception.employeeId) return;
  const record = db.payrollRecords.find((r) => r.employeeId === exception.employeeId);
  if (!record) return;

  switch (exception.type) {
    case "Salary increase":
    case "Salary decrease":
    case "Promotion":
    case "Retroactive adjustment": {
      const amount = parseAmount(exception.newValue);
      if (amount) {
        record.grossSalary = amount;
        record.salaryEffectiveDate = exception.effectiveDate;
        record.adjustmentReason = `${exception.type} accepted ${exception.reference}`;
      }
      break;
    }
    case "Unpaid leave":
    case "Absence affecting payroll": {
      const days = parseDays(exception.newValue);
      if (days !== undefined) record.unpaidLeaveDays = days;
      break;
    }
    case "New deduction":
    case "Loan deduction changed":
    case "Cooperative deduction changed":
    case "Court-ordered deduction": {
      record.deductions.forEach((line) => {
        if (!line.approved) line.approved = true;
      });
      break;
    }
    case "Suspension":
      record.employmentStatus = "Suspended";
      break;
    case "Termination":
      record.employmentStatus = "Terminated";
      record.employmentEndDate = exception.effectiveDate;
      break;
    case "Resignation":
      record.employmentStatus = "Notice period";
      break;
    case "Bank account changed":
      record.bankVerified = true;
      break;
    default:
      break;
  }
  record.approvalStatus = "Confirmed";
  record.lastUpdatedAt = new Date().toISOString();
}

const LOW_RISK: ExceptionSeverity = "Informational";

export type ExceptionAction =
  | "accept"
  | "reject"
  | "edit"
  | "request-info"
  | "pause-accrual"
  | "resume-accrual"
  | "mark-resolved"
  | "escalate";

let syncCounter = 900;

export const payrollApi = {
  /* ---------------------------------------------------------- command centre */

  async commandCentre(employerId: string): Promise<PayrollCommandCentre> {
    const employer = employerById(employerId);
    const period = periodFor(employerId);
    const records = db.payrollRecords.filter((r) => r.employerId === employerId);
    const totals = summarisePayroll(records);
    /** Seeded headcount is larger than the sample of records we hold. */
    const scale = records.length ? Math.max(1, employer.activeEmployees / records.length) : 1;
    period.headcount = employer.activeEmployees;
    period.grossPayroll = Math.round(totals.gross * scale);
    period.totalDeductions = Math.round(totals.deductions * scale);
    period.netPayroll = Math.round(totals.net * scale);
    period.statutoryLiability = Math.round(totals.statutory * scale);
    period.settlementObligation = records.reduce(
      (sum, r) => sum + settlementDueThisCycle(r.employeeId),
      0,
    );
    period.fundsConfirmed = employer.payrollFundsConfirmed;

    const buffer = db.buffers.find(
      (b) => b.employerId === employerId && ["Funded", "Accepted", "Repaying"].includes(b.status),
    );
    return delay({
      period,
      health: payrollHealthFor(employerId),
      policy: policyFor(employerId),
      activeEmployees: employer.activeEmployees,
      fundingGap: Math.max(0, period.netPayroll - period.fundsConfirmed),
      bufferAvailable: buffer?.approvedAmount ?? 0,
      settlementObligation: period.settlementObligation,
      statutoryStatus: "Scheduled",
      disbursementStatus: period.stage === "Disbursement" ? "Processing" : "Not started",
      netPayrollTrend: seed.employerBridgeActivity.map((point) => ({
        label: point.label,
        value: Math.round(period.netPayroll * (0.94 + (point.value % 7) / 100)),
      })),
    });
  },

  async health(employerId: string): Promise<PayrollHealth> {
    return delay(payrollHealthFor(employerId));
  },

  async period(employerId: string): Promise<PayrollPeriod> {
    return delay(periodFor(employerId));
  },

  /** Moves the cycle to the next stage. Approval is a policy-level sign-off. */
  async advanceStage(employerId: string, actor: string): Promise<PayrollPeriod> {
    const period = periodFor(employerId);
    const index = PAYROLL_STAGES.indexOf(period.stage);
    const open = db.payrollExceptions.filter(
      (e) => e.employerId === employerId && e.severity === "Critical" && OPEN_EXCEPTION_STATUSES.includes(e.status),
    ).length;
    if (period.stage === "Exceptions review" && open > 0) {
      fail(`${open} critical exception${open > 1 ? "s" : ""} must be resolved before payroll calculation`);
    }
    if (index >= 0 && index < PAYROLL_STAGES.length - 1) {
      period.stage = PAYROLL_STAGES[index + 1];
      period.status =
        period.stage === "Approval"
          ? "Approval pending"
          : period.stage === "Funding"
            ? "Funding required"
            : period.stage === "Payroll closed"
              ? "Completed"
              : "On track";
      if (period.stage === "Funding") period.approvalStatus = "Approved";
      if (period.stage === "Funding") {
        period.approvedBy = actor;
        period.approvedAt = new Date().toISOString();
      }
    }
    logAudit(actor, "Payroll administrator", `Moved payroll cycle to ${period.stage}`, `Payroll · ${period.label}`);
    return delay(period, 700);
  },

  /* ----------------------------------------------------------------- policy */

  async policy(employerId: string): Promise<PayrollPolicy> {
    return delay(policyFor(employerId));
  },

  async updatePolicy(employerId: string, patch: Partial<PayrollPolicy>, actor: string): Promise<PayrollPolicy> {
    const policy = policyFor(employerId);
    const before = `Max ${policy.maxBridgePct}% · grace ${policy.gracePeriodDays}d · ${policy.fallbackRule}`;
    Object.assign(policy, patch);
    policy.version += 1;
    policy.approvedBy = actor;
    policy.approvedAt = new Date().toISOString();
    db.payrollRecords
      .filter((r) => r.employerId === employerId)
      .forEach((r) => syncEmployeeFromPayroll(r.employeeId));
    logAudit(
      actor,
      "Payroll administrator",
      `Updated payroll rules to version ${policy.version} — was ${before}`,
      "Payroll policy",
    );
    return delay(policy, 800);
  },

  /* ---------------------------------------------------------------- records */

  async records(employerId: string): Promise<PayrollEmployeeRecord[]> {
    return delay(db.payrollRecords.filter((r) => r.employerId === employerId));
  },

  async record(employeeId: string): Promise<PayrollEmployeeRecord> {
    return delay(payrollRecordFor(employeeId));
  },

  /** The full gross-to-net-to-bridgeable calculation for one employee. */
  async accrual(employeeId: string): Promise<AccrualResult> {
    return delay(accrualFor(employeeId));
  },

  /* ------------------------------------------------------------- exceptions */

  async exceptions(employerId: string): Promise<PayrollException[]> {
    return delay(
      db.payrollExceptions
        .filter((e) => e.employerId === employerId)
        .sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt)),
    );
  },

  /**
   * The one place exceptions change state. Accepting applies the payroll
   * change; nothing here touches money already sent to an employee.
   */
  async resolveException(input: {
    id: string;
    action: ExceptionAction;
    actor: string;
    note?: string;
    newValue?: string;
  }): Promise<PayrollException> {
    const exception = db.payrollExceptions.find((e) => e.id === input.id) ?? fail("Exception not found");
    const record = exception.employeeId
      ? db.payrollRecords.find((r) => r.employeeId === exception.employeeId)
      : undefined;
    const now = new Date().toISOString();
    const previous = exception.newValue;

    switch (input.action) {
      case "accept":
        if (input.newValue) exception.newValue = input.newValue;
        applyException(exception);
        exception.status = "Accepted";
        exception.pausesAccrual = false;
        exception.resolvedAt = now;
        exception.resolvedBy = input.actor;
        break;
      case "edit":
        if (!input.newValue) fail("Enter the corrected value");
        exception.newValue = input.newValue;
        exception.status = "In review";
        break;
      case "reject":
        exception.status = "Rejected";
        exception.pausesAccrual = false;
        exception.resolvedAt = now;
        exception.resolvedBy = input.actor;
        break;
      case "request-info":
        exception.status = "Information requested";
        break;
      case "pause-accrual":
        if (record) {
          record.accrualPaused = true;
          record.accrualPauseReason = input.note ?? `Paused during review of ${exception.type.toLowerCase()}`;
        }
        exception.pausesAccrual = true;
        exception.status = "In review";
        break;
      case "resume-accrual":
        if (record) {
          record.accrualPaused = false;
          record.accrualPauseReason = undefined;
          record.approvalStatus = "Confirmed";
        }
        exception.pausesAccrual = false;
        exception.status = "In review";
        break;
      case "mark-resolved":
        exception.status = "Resolved";
        exception.pausesAccrual = false;
        exception.resolvedAt = now;
        exception.resolvedBy = input.actor;
        if (record) {
          record.accrualPaused = false;
          record.accrualPauseReason = undefined;
        }
        break;
      case "escalate":
        exception.status = "Escalated";
        exception.assignedReviewer = "PayBridge operations";
        db.notifications.unshift({
          id: `nt_ops_${Date.now()}`,
          portal: "operations",
          tone: "attention",
          title: `Escalated: ${exception.type}`,
          body: `${exception.employeeRef} · ${exception.reference} needs reconciliation review.`,
          at: now,
          read: false,
        });
        break;
    }
    if (input.note) exception.resolutionNote = input.note;
    if (exception.employeeId) syncEmployeeFromPayroll(exception.employeeId);
    logAudit(
      input.actor,
      "Payroll administrator",
      `${input.action.replace("-", " ")} — ${exception.type} (${exception.reference}) · was "${exception.previousValue}" → "${previous}"`,
      `Exception · ${exception.employeeRef}`,
    );
    return delay(exception, 650);
  },

  async assignException(id: string, reviewer: string, actor: string): Promise<PayrollException> {
    const exception = db.payrollExceptions.find((e) => e.id === id) ?? fail("Exception not found");
    exception.assignedReviewer = reviewer;
    if (exception.status === "Open") exception.status = "In review";
    logAudit(actor, "Payroll administrator", `Assigned ${exception.reference} to ${reviewer}`, "Exception");
    return delay(exception, 500);
  },

  /** Bulk accept only ever touches informational, non-blocking exceptions. */
  async bulkAcceptLowRisk(employerId: string, actor: string): Promise<number> {
    const policy = policyFor(employerId);
    if (!policy.allowBulkAcceptLowRisk) fail("Bulk accept is switched off in your payroll rules");
    const targets = db.payrollExceptions.filter(
      (e) =>
        e.employerId === employerId &&
        e.severity === LOW_RISK &&
        !e.pausesAccrual &&
        OPEN_EXCEPTION_STATUSES.includes(e.status),
    );
    const now = new Date().toISOString();
    targets.forEach((exception) => {
      applyException(exception);
      exception.status = "Accepted";
      exception.resolvedAt = now;
      exception.resolvedBy = actor;
      if (exception.employeeId) syncEmployeeFromPayroll(exception.employeeId);
    });
    logAudit(actor, "Payroll administrator", `Bulk accepted ${targets.length} low-risk exceptions`, "Exceptions");
    return delay(targets.length, 900);
  },

  /* ----------------------------------------------------------- integrations */

  async integrations(employerId: string): Promise<PayrollIntegration[]> {
    return delay(db.payrollIntegrations.filter((i) => i.employerId === employerId));
  },

  async connectors(): Promise<typeof payrollSeed.AVAILABLE_CONNECTORS> {
    return delay(payrollSeed.AVAILABLE_CONNECTORS);
  },

  async syncEvents(employerId: string): Promise<PayrollSyncEvent[]> {
    return delay(
      db.payrollSyncEvents
        .filter((e) => e.employerId === employerId)
        .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    );
  },

  /** Runs a connector. Failures raise an exception and apply the fallback rule. */
  async runSync(integrationId: string, actor: string): Promise<PayrollSyncEvent> {
    const integration =
      db.payrollIntegrations.find((i) => i.id === integrationId) ?? fail("Integration not found");
    const records = db.payrollRecords.filter((r) => r.employerId === integration.employerId);
    const now = new Date().toISOString();
    syncCounter += 1;
    const recovered = integration.status === "Failed";
    const event: PayrollSyncEvent = {
      id: `sync_${syncCounter}`,
      employerId: integration.employerId,
      integrationId: integration.id,
      integrationName: integration.name,
      at: now,
      method: integration.method,
      status: "Success",
      records: records.length,
      exceptionsRaised: 0,
      message: recovered
        ? `Connection restored. ${records.length} records received.`
        : `${records.length} records received and matched.`,
    };
    integration.status = integration.demo && integration.status !== "Connected" ? "Sandbox" : "Connected";
    integration.errorMessage = undefined;
    integration.lastSyncAt = now;
    integration.recordsLastSync = records.length;
    db.payrollSyncEvents.unshift(event);
    records.forEach((r) => {
      r.lastUpdatedAt = now;
      syncEmployeeFromPayroll(r.employeeId);
    });
    logAudit(actor, "Payroll administrator", `Ran ${integration.name} sync`, `Integration · ${integration.name}`);
    return delay(event, 1200);
  },

  async setIntegrationStatus(
    integrationId: string,
    status: PayrollIntegration["status"],
    actor: string,
  ): Promise<PayrollIntegration> {
    const integration =
      db.payrollIntegrations.find((i) => i.id === integrationId) ?? fail("Integration not found");
    const before = integration.status;
    integration.status = status;
    logAudit(actor, "Payroll administrator", `${integration.name}: ${before} → ${status}`, "Integration");
    return delay(integration, 600);
  },

  /* ------------------------------------------------- inbound payroll events */

  /**
   * Mock inbound endpoints. In production these are the REST, CSV, SFTP and
   * webhook handlers — here they mutate the normalised record and raise the
   * matching exception, so every demo scenario is reachable from the UI.
   */
  async attendanceUpdate(input: {
    employeeId: string;
    unpaidLeaveDays: number;
    daysWorked?: number;
    source?: PayrollDataSource;
    actor: string;
  }): Promise<PayrollException> {
    const record = payrollRecordFor(input.employeeId);
    const before = record.unpaidLeaveDays;
    record.unpaidLeaveDays = input.unpaidLeaveDays;
    if (input.daysWorked !== undefined) record.daysWorked = input.daysWorked;
    record.dataSource = input.source ?? "Attendance system";
    record.lastUpdatedAt = new Date().toISOString();
    const exception = raiseException({
      employerId: record.employerId,
      employeeId: record.employeeId,
      employeeRef: record.payrollId,
      employeeName: record.fullName,
      type: "Unpaid leave",
      severity: input.unpaidLeaveDays > 5 ? "Critical" : "Review required",
      previousValue: `${before} days unpaid leave`,
      newValue: `${input.unpaidLeaveDays} days unpaid leave`,
      effectiveDate: new Date().toISOString(),
      source: record.dataSource,
      recommendedAction: "Confirm the leave days so accrual is recalculated",
      deadline: record.payday,
      assignedReviewer: input.actor,
      pausesAccrual: input.unpaidLeaveDays > 5,
    });
    return delay(exception, 800);
  },

  async salaryAdjustment(input: {
    employeeId: string;
    newGross: number;
    reason: string;
    source?: PayrollDataSource;
    actor: string;
  }): Promise<PayrollException> {
    const record = payrollRecordFor(input.employeeId);
    const before = record.grossSalary;
    const changePct = before ? Math.abs((input.newGross - before) / before) * 100 : 0;
    record.approvalStatus = "Pending review";
    record.adjustmentReason = input.reason;
    record.lastUpdatedAt = new Date().toISOString();
    const exception = raiseException({
      employerId: record.employerId,
      employeeId: record.employeeId,
      employeeRef: record.payrollId,
      employeeName: record.fullName,
      type: input.newGross >= before ? "Salary increase" : "Salary decrease",
      severity: changePct > 30 ? "Critical" : "Review required",
      previousValue: naira(before),
      newValue: naira(input.newGross),
      effectiveDate: new Date().toISOString(),
      source: input.source ?? "Payroll connector",
      recommendedAction:
        input.newGross >= before
          ? "Confirm the new salary so accrual uses it from the effective date"
          : "Confirm the reduction before accrual continues",
      deadline: record.payday,
      assignedReviewer: input.actor,
      pausesAccrual: input.newGross < before,
    });
    return delay(exception, 800);
  },

  async deductionUpdate(input: {
    employeeId: string;
    label: string;
    kind: DeductionKind;
    amount: number;
    protectedCommitment?: boolean;
    actor: string;
  }): Promise<PayrollException> {
    const record = payrollRecordFor(input.employeeId);
    record.deductions.push({
      id: `ded_${Date.now()}`,
      label: input.label,
      kind: input.protectedCommitment ? "Commitment" : input.kind,
      amount: input.amount,
      approved: false,
      effectiveDate: new Date().toISOString(),
      source: "Payroll connector",
    });
    record.lastUpdatedAt = new Date().toISOString();
    const exception = raiseException({
      employerId: record.employerId,
      employeeId: record.employeeId,
      employeeRef: record.payrollId,
      employeeName: record.fullName,
      type: "New deduction",
      severity: "Review required",
      previousValue: "No such deduction",
      newValue: `${input.label} · ${naira(input.amount)}`,
      effectiveDate: new Date().toISOString(),
      source: "Payroll connector",
      recommendedAction: "Approve the deduction so net pay and accrual are recalculated",
      deadline: record.payday,
      assignedReviewer: input.actor,
      pausesAccrual: false,
    });
    return delay(exception, 800);
  },

  async employmentStatusChange(input: {
    employeeId: string;
    status: EmploymentStatus;
    effectiveDate?: string;
    actor: string;
  }): Promise<PayrollException> {
    const record = payrollRecordFor(input.employeeId);
    const before = record.employmentStatus;
    record.employmentStatus = input.status;
    record.lastUpdatedAt = new Date().toISOString();
    const stopping = !ACCRUING_STATUSES.includes(input.status);
    if (stopping) {
      record.accrualPaused = true;
      record.accrualPauseReason = `Employment status: ${input.status.toLowerCase()}`;
      record.approvalStatus = "On hold";
    }
    const type: ExceptionType =
      input.status === "Terminated"
        ? "Termination"
        : input.status === "Suspended"
          ? "Suspension"
          : input.status === "Notice period"
            ? "Resignation"
            : "Payroll hold";
    const exception = raiseException({
      employerId: record.employerId,
      employeeId: record.employeeId,
      employeeRef: record.payrollId,
      employeeName: record.fullName,
      type,
      severity: stopping ? "Critical" : "Review required",
      previousValue: before,
      newValue: input.status,
      effectiveDate: input.effectiveDate ?? new Date().toISOString(),
      source: "HRIS connector",
      recommendedAction: stopping
        ? "Confirm the status change. New availability is paused; disbursed Bridges settle as scheduled."
        : "Confirm the status change",
      deadline: record.payday,
      assignedReviewer: input.actor,
      pausesAccrual: stopping,
    });
    return delay(exception, 800);
  },

  /** Simulates a payroll file that never arrived. Applies the fallback rule. */
  async reportLateFile(employerId: string, actor: string): Promise<PayrollException> {
    const policy = policyFor(employerId);
    const period = periodFor(employerId);
    const exception = raiseException({
      employerId,
      employeeRef: "All employees",
      type: "Payroll file late",
      severity: "Review required",
      previousValue: `Expected ${policy.submissionDeadline.toLowerCase()}`,
      newValue: "Not received",
      effectiveDate: new Date().toISOString(),
      source: "SFTP",
      recommendedAction: `${policy.fallbackRule} for up to ${policy.gracePeriodDays} days, then confirm manually`,
      deadline: period.payday,
      assignedReviewer: actor,
      pausesAccrual: policy.fallbackRule === "Suspend new Bridge availability",
    });
    return delay(exception, 800);
  },

  /* --------------------------------------------------------------- ops view */

  async opsRows(): Promise<PayrollOpsRow[]> {
    const rows: PayrollOpsRow[] = db.employers
      .filter((employer) => employer.applicationStatus === "Approved")
      .map((employer) => {
        const health = payrollHealthFor(employer.id);
        const period = periodFor(employer.id);
        const integrations = db.payrollIntegrations.filter((i) => i.employerId === employer.id);
        const uptime = integrations.length
          ? integrations.reduce((sum, i) => sum + i.uptimePct, 0) / integrations.length
          : 100;
        const settlement = db.payrollRecords
          .filter((r) => r.employerId === employer.id)
          .reduce((sum, r) => sum + settlementDueThisCycle(r.employeeId), 0);
        return {
          employerId: employer.id,
          employerName: employer.name,
          mode: integrations.some((i) => i.method !== "Manual entry")
            ? ("Integration" as const)
            : ("Manual" as const),
          periodLabel: period.label,
          payday: period.payday,
          syncStatus: health.syncStatus,
          lastSyncAt: health.lastSyncAt,
          nextSyncAt: health.nextSyncAt,
          openExceptions: health.exceptionsOpen,
          criticalExceptions: health.criticalExceptions,
          accrualsPaused: health.accrualsPaused,
          fundingGap: Math.max(0, period.netPayroll - period.fundsConfirmed),
          settlementObligation: settlement,
          uptimePct: Math.round(uptime * 10) / 10,
          stage: period.stage,
        };
      });
    return delay(rows);
  },

  /** Every sync event across all employers — the operations monitoring feed. */
  async opsSyncEvents(): Promise<(PayrollSyncEvent & { employerName: string })[]> {
    const rows = db.payrollSyncEvents
      .map((event) => ({
        ...event,
        employerName:
          db.employers.find((e) => e.id === event.employerId)?.name ?? "Unknown employer",
      }))
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return delay(rows);
  },

  /** Exceptions across all employers, oldest deadline first — SLA monitoring. */
  async opsExceptions(): Promise<(PayrollException & { employerName: string })[]> {
    const rows = db.payrollExceptions
      .filter((e) => OPEN_EXCEPTION_STATUSES.includes(e.status))
      .map((e) => ({
        ...e,
        employerName: db.employers.find((emp) => emp.id === e.employerId)?.name ?? "Unknown employer",
      }))
      .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline));
    return delay(rows);
  },

  /** Immutable audit entries for payroll actions only. */
  async payrollAudit(): Promise<AuditLog[]> {
    const rows = db.auditLogs.filter((log) =>
      /payroll|exception|accrual|integration|settlement|sync/i.test(`${log.action} ${log.entity}`),
    );
    return delay(rows);
  },

  async compliancePack(): Promise<typeof payrollSeed.NIGERIA_PACK> {
    return delay(payrollSeed.NIGERIA_PACK);
  },
};

/* ------------------------------------------------------------------ investor */

export const investorApi = {
  async overview(investorId: string): Promise<InvestorOverview> {
    const investor = investorById(investorId);
    const allocation: AllocationSlice[] = [
      { label: "Liquidity Portfolio", value: 60_000_000, tone: "primary" },
      { label: "Salary Buffer Portfolio", value: 45_000_000, tone: "available" },
      { label: "Awaiting deployment", value: investor.undeployedCapital, tone: "muted" },
    ];
    return delay({
      investor,
      performance: seed.investorPerformance,
      allocation,
      investments: db.investments.filter((i) => i.investorId === investorId),
    });
  },

  async portfolios(): Promise<Portfolio[]> {
    return delay(db.portfolios);
  },

  async invest(input: { investorId: string; portfolioId: string; amount: number }): Promise<Investment> {
    const investor = investorById(input.investorId);
    const portfolio = db.portfolios.find((p) => p.id === input.portfolioId) ?? fail("Mandate not found");
    if (investor.kybStatus !== "Verified") fail("Your KYB verification must be approved before you can commit capital");
    if (input.amount < portfolio.minimumInvestment) fail("Amount is below the minimum for this mandate");
    const now = new Date().toISOString();
    const maturity = new Date();
    maturity.setMonth(maturity.getMonth() + portfolio.tenorMonths);
    const investment: Investment = {
      id: `ivt_${Date.now()}`,
      reference: makeReference("PB-IV"),
      investorId: investor.id,
      investorName: investor.name,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      amount: input.amount,
      incomeEarned: 0,
      feesCharged: 0,
      status: "Pending funding",
      startDate: now,
      maturityDate: maturity.toISOString(),
      distributionFrequency: portfolio.distributionFrequency,
    };
    db.investments.unshift(investment);
    investor.capitalCommitted += input.amount;
    investor.undeployedCapital += input.amount;
    investor.portfolioValue += input.amount;
    db.transactions.unshift({
      id: `tx_${investment.id}`,
      reference: investment.reference,
      type: "Investor inflow",
      counterparty: investor.name,
      amount: input.amount,
      fee: 0,
      status: "Initiated",
      channel: "Bank transfer",
      createdAt: now,
      reconciliation: "Unmatched",
    });
    logAudit(investor.name, "Investor", `Committed ${input.amount} to ${portfolio.name}`, `Portfolio · ${portfolio.name}`);
    return delay(investment, 1100);
  },

  async investments(investorId: string): Promise<Investment[]> {
    return delay(db.investments.filter((i) => i.investorId === investorId));
  },

  async transactions(investorId: string): Promise<Transaction[]> {
    const investor = investorById(investorId);
    return delay(db.transactions.filter((t) => t.counterparty === investor.name));
  },

  async withdrawals(investorId: string): Promise<Withdrawal[]> {
    return delay(
      db.withdrawals
        .filter((w) => w.investorId === investorId)
        .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)),
    );
  },

  async requestWithdrawal(input: { investorId: string; amount: number; bankAccountId: string }): Promise<Withdrawal> {
    const investor = investorById(input.investorId);
    if (input.amount <= 0) fail("Enter an amount to withdraw");
    if (input.amount > investor.availableForWithdrawal) fail("Amount exceeds the balance available for withdrawal");
    const account = investor.bankAccounts.find((a) => a.id === input.bankAccountId) ?? investor.bankAccounts[0];
    const valueDate = new Date();
    valueDate.setDate(valueDate.getDate() + 3);
    const withdrawal: Withdrawal = {
      id: `wd_${Date.now()}`,
      reference: makeReference("PB-WD"),
      investorId: investor.id,
      investorName: investor.name,
      amount: input.amount,
      bankAccountId: account.id,
      destination: `${account.bankName} ${account.accountNumberMasked}`,
      status: "Requested",
      requestedAt: new Date().toISOString(),
      valueDate: valueDate.toISOString(),
    };
    db.withdrawals.unshift(withdrawal);
    investor.availableForWithdrawal -= input.amount;
    logAudit(investor.name, "Investor", `Requested withdrawal ${withdrawal.reference}`, "Withdrawal");
    return delay(withdrawal, 900);
  },

  async statements(investorId: string): Promise<Statement[]> {
    return delay(db.statements.filter((s) => s.ownerId === investorId));
  },

  async submitKyb(investorId: string, documents: { name: string; category: string }[]): Promise<Investor> {
    const investor = investorById(investorId);
    investor.kybStatus = documents.length ? "Submitted" : investor.kybStatus;
    return delay(investor, 900);
  },
};

/* ---------------------------------------------------------------- operations */

export const opsApi = {
  /**
   * Per-employee settlement lines for one employer — names, payroll IDs and
   * exact deductions.
   *
   * Lives on `opsApi` rather than `payrollApi` deliberately. It used to sit on
   * `payrollApi`, which the employer's own payroll pages import; nothing called
   * it, but it was one autocomplete away from re-opening the leak that
   * `employerApi.bridgeActivity` was just closed against. PayBridge operations
   * need these rows to reconcile a remittance against the allocation. An
   * employer surface must never import `opsApi`.
   */
  async settlements(employerId: string): Promise<SettlementLine[]> {
    return delay(settlementLinesFor(employerId));
  },

  async overview(): Promise<OperationsOverview> {
    const approvedEmployers = db.employers.filter((e) => e.applicationStatus === "Approved");
    const today = new Date().toDateString();
    const todayRequests = db.bridgeRequests.filter((r) => new Date(r.createdAt).toDateString() === today);
    const deployed = db.portfolios.reduce((sum, p) => sum + p.capitalDeployed, 0);
    const cum = db.portfolios.reduce((sum, p) => sum + p.capitalUnderManagement, 0);
    const capitalSplit: AllocationSlice[] = [
      { label: "Deployed — Bridge", value: 1_190_000_000, tone: "primary" },
      { label: "Deployed — Salary Buffer", value: 1_820_000_000, tone: "available" },
      { label: "Deployed — Institutional", value: 3_450_000_000, tone: "protected" },
      { label: "Available capital", value: cum - deployed, tone: "muted" },
    ];
    return delay({
      activeEmployers: approvedEmployers.length,
      activeEmployees: db.employees.filter((e) => e.eligible).length * 43,
      approvedInvestors: db.investors.filter((i) => i.kybStatus === "Verified").length,
      availableCapital: cum - deployed,
      deployedCapital: deployed,
      bridgeTransactionsToday: todayRequests.length + 128,
      bridgeValueToday: todayRequests.reduce((s, r) => s + r.amount, 0) + 18_450_000,
      salaryBufferExposure: db.buffers
        .filter((b) => ["Funded", "Repaying", "Accepted"].includes(b.status))
        .reduce((s, b) => s + (b.approvedAmount ?? 0), 0),
      repaymentsDue: db.repayments
        .filter((r) => r.status !== "Paid")
        .reduce((s, r) => s + (r.amountDue - r.amountPaid), 0),
      failedTransactions: db.transactions.filter((t) => t.status === "Failed" || t.status === "Reversed").length,
      riskAlerts: db.riskAlerts.filter((a) => a.status === "Open").length,
      complianceAlerts: db.complianceCases.filter((c) => ["Open", "In review", "Escalated"].includes(c.status)).length,
      volume: seed.opsVolume,
      capitalSplit,
    });
  },

  async employers(): Promise<Employer[]> {
    return delay(db.employers);
  },

  async setEmployerStatus(employerId: string, status: Employer["applicationStatus"], actor: string): Promise<Employer> {
    const employer = employerById(employerId);
    employer.applicationStatus = status;
    logAudit(actor, "Operations", `Set employer status to ${status}`, `Employer · ${employer.name}`);
    return delay(employer, 700);
  },

  async setEmployerLimit(employerId: string, limit: number, actor: string): Promise<Employer> {
    const employer = employerById(employerId);
    employer.approvedLimit = limit;
    logAudit(actor, "Operations", `Updated employer limit to ${limit}`, `Employer · ${employer.name}`);
    return delay(employer, 700);
  },

  async employees(): Promise<Employee[]> {
    return delay(db.employees);
  },

  async investors(): Promise<Investor[]> {
    return delay(db.investors);
  },

  async setInvestorKyb(investorId: string, status: Investor["kybStatus"], actor: string): Promise<Investor> {
    const investor = investorById(investorId);
    investor.kybStatus = status;
    logAudit(actor, "Compliance", `Set investor KYB to ${status}`, `Investor · ${investor.name}`);
    return delay(investor, 700);
  },

  async transactions(): Promise<Transaction[]> {
    return delay(db.transactions);
  },

  async setTransactionStatus(reference: string, status: TransactionStatus, actor: string): Promise<Transaction> {
    const tx = db.transactions.find((t) => t.reference === reference) ?? fail("Transaction not found");
    tx.status = status;
    const request = db.bridgeRequests.find((r) => r.reference === reference);
    if (request) {
      request.status = status;
      rebuildTimeline(request);
    }
    logAudit(actor, "Operations", `Set ${reference} to ${status}`, "Transaction");
    return delay(tx, 700);
  },

  async funding(): Promise<{ buffers: SalaryBufferRequest[]; bridge: BridgeRequest[]; repayments: Repayment[] }> {
    return delay({
      buffers: db.buffers,
      bridge: db.bridgeRequests.filter((r) => ["Initiated", "Processing"].includes(r.status)).slice(0, 20),
      repayments: db.repayments,
    });
  },

  async setBufferStatus(reference: string, status: SalaryBufferRequest["status"], actor: string): Promise<SalaryBufferRequest> {
    const buffer = db.buffers.find((b) => b.reference === reference) ?? fail("Request not found");
    buffer.status = status;
    if (status === "Funded") buffer.fundedAt = new Date().toISOString();
    logAudit(actor, "Operations", `Set Salary Buffer ${reference} to ${status}`, `Employer · ${buffer.employerName}`);
    return delay(buffer, 800);
  },

  async portfolios(): Promise<{ portfolios: Portfolio[]; investments: Investment[] }> {
    return delay({ portfolios: db.portfolios, investments: db.investments });
  },

  async reconciliation(): Promise<Transaction[]> {
    return delay(db.transactions.slice(0, 40));
  },

  async setReconciliation(reference: string, status: Transaction["reconciliation"], actor: string): Promise<Transaction> {
    const tx = db.transactions.find((t) => t.reference === reference) ?? fail("Transaction not found");
    tx.reconciliation = status;
    logAudit(actor, "Finance", `Marked ${reference} as ${status}`, "Reconciliation");
    return delay(tx, 600);
  },

  async riskAlerts(): Promise<RiskAlert[]> {
    return delay(db.riskAlerts);
  },

  async setRiskStatus(id: string, status: RiskAlert["status"], actor: string): Promise<RiskAlert> {
    const alert = db.riskAlerts.find((a) => a.id === id) ?? fail("Alert not found");
    alert.status = status;
    logAudit(actor, "Risk", `Set ${alert.reference} to ${status}`, "Risk alert");
    return delay(alert, 600);
  },

  async complianceCases(): Promise<ComplianceCase[]> {
    return delay(db.complianceCases);
  },

  async setComplianceStatus(id: string, status: ComplianceCase["status"], actor: string): Promise<ComplianceCase> {
    const item = db.complianceCases.find((c) => c.id === id) ?? fail("Case not found");
    item.status = status;
    logAudit(actor, "Compliance", `Set ${item.reference} to ${status}`, "Compliance case");
    return delay(item, 600);
  },

  async tickets(): Promise<SupportTicket[]> {
    return delay(db.tickets);
  },

  async replyToTicket(id: string, body: string, author: string): Promise<SupportTicket> {
    const ticket = db.tickets.find((t) => t.id === id) ?? fail("Ticket not found");
    ticket.messages.push({
      id: `m_${Date.now()}`,
      author,
      authorType: "PayBridge",
      body,
      at: new Date().toISOString(),
    });
    ticket.updatedAt = new Date().toISOString();
    return delay(ticket, 700);
  },

  async setTicketStatus(id: string, status: SupportTicket["status"]): Promise<SupportTicket> {
    const ticket = db.tickets.find((t) => t.id === id) ?? fail("Ticket not found");
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    return delay(ticket, 500);
  },

  async auditLogs(): Promise<AuditLog[]> {
    return delay(db.auditLogs);
  },

  async reports(): Promise<Statement[]> {
    return delay(db.statements);
  },
};

/* -------------------------------------------------------------- shared bits */

export const platformApi = {
  async notifications(portal: Portal): Promise<Notification[]> {
    return delay(db.notifications.filter((n) => n.portal === portal));
  },
  async markNotificationsRead(portal: Portal): Promise<Notification[]> {
    db.notifications.forEach((n) => {
      if (n.portal === portal) n.read = true;
    });
    return delay(db.notifications.filter((n) => n.portal === portal), 200);
  },
  /** Simulated file/CSV upload — resolves with parsed-row metadata. */
  async uploadFile(file: { name: string; size: number }, rows?: number): Promise<{ name: string; sizeKb: number; rows: number }> {
    return delay(
      {
        name: file.name,
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        rows: rows ?? Math.max(1, Math.round(file.size / 180)),
      },
      1200,
    );
  },
};

export const support = {
  async createTicket(input: {
    subject: string;
    body: string;
    requester: string;
    requesterType: SupportTicket["requesterType"];
  }): Promise<SupportTicket> {
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: `st_${Date.now()}`,
      reference: makeReference("SUP"),
      subject: input.subject,
      requester: input.requester,
      requesterType: input.requesterType,
      channel: "In-app",
      priority: "Normal",
      status: "Open",
      createdAt: now,
      updatedAt: now,
      messages: [{ id: `m_${Date.now()}`, author: input.requester, authorType: "Customer", body: input.body, at: now }],
    };
    db.tickets.unshift(ticket);
    return delay(ticket, 900);
  },
  async myTickets(requester: string): Promise<SupportTicket[]> {
    return delay(db.tickets.filter((t) => t.requester.startsWith(requester.split(" ")[0])));
  },
};
