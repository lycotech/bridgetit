/**
 * Seed data for the PayBridge prototype.
 *
 * Everything is generated from a deterministic PRNG so the dashboards look the
 * same on every load, while dates stay relative to today. Replace this module
 * with real queries (Supabase/Postgres) and the dashboards keep working.
 */

import { initialsOf, makeReference } from "./format";
import type {
  AuditLog,
  BankAccount,
  BridgeRequest,
  ComplianceCase,
  ComplianceStatus,
  Employee,
  Employer,
  EmployerApplicationStatus,
  Holding,
  Investment,
  InvestmentProduct,
  Investor,
  KycStatus,
  LearningModule,
  Notification,
  PayrollRun,
  PillarScore,
  Portfolio,
  Recommendation,
  ReconciliationStatus,
  Repayment,
  RiskAlert,
  RiskLevel,
  SalaryAccountRequest,
  SalaryAccountRequestStatus,
  SalaryBufferRequest,
  SavingsGoal,
  SavingsProduct,
  Statement,
  SuitabilityQuestion,
  WellbeingInsight,
  SupportTicket,
  Transaction,
  TransactionStatus,
  User,
  WellbeingMetric,
  Withdrawal,
} from "./models";
import type { Role } from "./models";

/* ------------------------------------------------------------------- utils */

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rng = makeRng(20260725);

const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const int = (min: number, max: number): number => Math.floor(min + rng() * (max - min + 1));
const round = (value: number, to: number): number => Math.round(value / to) * to;

const NOW = new Date();
export const TODAY_ISO = NOW.toISOString();

function iso(daysFromNow: number, hour = 9, minute = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function hoursAgo(h: number): string {
  const d = new Date(NOW.getTime() - h * 3_600_000);
  return d.toISOString();
}

/** Next payday used across the prototype: 28 August 2026 in the brief. */
export const NEXT_PAYDAY = "2026-08-28T09:00:00.000Z";

/* ------------------------------------------------------------------- names */

const FIRST = [
  "Adaeze", "Chidi", "Ngozi", "Tunde", "Fatima", "Emeka", "Bola", "Yusuf", "Ifeoma", "Segun",
  "Amina", "Kelechi", "Zainab", "Obinna", "Halima", "Femi", "Chiamaka", "Sadiq", "Temi", "Uche",
  "Blessing", "Ibrahim", "Nkem", "Damilola", "Aisha", "Ekene", "Kunle", "Rukayat", "Tobi", "Grace",
];
const LAST = [
  "Okonkwo", "Adeyemi", "Balogun", "Eze", "Ibrahim", "Nwosu", "Ogundipe", "Bello", "Chukwu",
  "Adebayo", "Musa", "Okafor", "Lawal", "Ojo", "Danjuma", "Obi", "Akande", "Yakubu", "Umeh", "Sani",
];
const DEPARTMENTS = ["Operations", "Customer Care", "Engineering", "Logistics", "Sales", "Finance", "People"];
const TITLES = ["Associate", "Officer", "Analyst", "Team Lead", "Specialist", "Supervisor", "Coordinator"];
const BANKS = ["GTBank", "Access Bank", "Zenith Bank", "First Bank", "UBA", "Kuda", "Providus Bank"];

function fullName(i: number): string {
  return `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + 3) % LAST.length]}`;
}

function bankAccounts(seedName: string, count = 2): BankAccount[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `ba_${seedName.toLowerCase().replace(/\W+/g, "")}_${i}`,
    bankName: pick(BANKS),
    accountName: seedName,
    accountNumberMasked: `•••• ${int(1000, 9999)}`,
    isPrimary: i === 0,
  }));
}

/* --------------------------------------------------------------- employers */

const EMPLOYER_SEEDS: Array<{
  name: string;
  industry: string;
  status: EmployerApplicationStatus;
  headcount: number;
  risk: RiskLevel;
}> = [
  { name: "Kaduna Foods Limited", industry: "Manufacturing", status: "Approved", headcount: 312, risk: "Low" },
  { name: "Lagos Retail Group", industry: "Retail", status: "Approved", headcount: 486, risk: "Moderate" },
  { name: "Sahel Logistics Plc", industry: "Logistics", status: "Approved", headcount: 208, risk: "Moderate" },
  { name: "Bluewater Hospitality", industry: "Hospitality", status: "Credit assessment", headcount: 144, risk: "High" },
  { name: "Meridian Health Partners", industry: "Healthcare", status: "Under review", headcount: 96, risk: "Low" },
  { name: "Northgate Security Services", industry: "Facilities", status: "Documents pending", headcount: 260, risk: "Moderate" },
  { name: "Trident Energy Services", industry: "Energy", status: "New application", headcount: 78, risk: "Moderate" },
  { name: "Palmview Agro Industries", industry: "Agriculture", status: "Suspended", headcount: 130, risk: "Critical" },
  { name: "Cedarline Financial Services", industry: "Financial services", status: "Rejected", headcount: 54, risk: "High" },
];

export const employers: Employer[] = EMPLOYER_SEEDS.map((seed, i) => {
  const approved = seed.status === "Approved";
  const activeEmployees = approved ? Math.round(seed.headcount * 0.91) : Math.round(seed.headcount * 0.2);
  const obligation = round(seed.headcount * int(140_000, 195_000), 50_000);
  const confirmedRatio = approved ? (i === 0 ? 0.72 : 0.62 + rng() * 0.3) : 0.5;
  const contact = fullName(i * 3);
  return {
    id: `emp_${String(i + 1).padStart(3, "0")}`,
    name: seed.name,
    rcNumber: `RC-${int(400000, 1999999)}`,
    industry: seed.industry,
    contactName: contact,
    contactEmail: `${contact.split(" ")[0].toLowerCase()}@${seed.name.split(" ")[0].toLowerCase()}.com`,
    employeeCount: seed.headcount,
    activeEmployees,
    employeesUsingBridge: approved ? Math.round(activeEmployees * (0.28 + rng() * 0.14)) : 0,
    applicationStatus: seed.status,
    approvedLimit: approved ? round(obligation * 0.45, 1_000_000) : 0,
    utilisedLimit: approved ? round(obligation * (0.12 + rng() * 0.18), 500_000) : 0,
    riskLevel: seed.risk,
    onboardingStep: approved ? 5 : int(1, 4),
    payrollDay: 28,
    nextPayrollDate: NEXT_PAYDAY,
    payrollObligation: obligation,
    payrollFundsConfirmed: round(obligation * confirmedRatio, 500_000),
    createdAt: iso(-int(40, 420)),
    payrollModel: "existing_payroll",
    eligibleEmployees: activeEmployees,
    salaryAccountsActive: approved ? Math.round(activeEmployees * (0.2 + rng() * 0.1)) : 0,
  };
});

/** The employer signed in during the prototype (matches the brief's figures). */
export const DEMO_EMPLOYER_ID = "emp_001";
const demoEmployer = employers[0];
demoEmployer.employeeCount = 312;
demoEmployer.activeEmployees = 284;
demoEmployer.employeesUsingBridge = 96;
demoEmployer.payrollObligation = 48_500_000;
demoEmployer.payrollFundsConfirmed = 35_000_000;
demoEmployer.approvedLimit = 24_000_000;
demoEmployer.utilisedLimit = 9_400_000;
demoEmployer.eligibleEmployees = 284;
demoEmployer.salaryAccountsActive = 68;

/* --------------------------------------------------------------- employees */

export const DEMO_EMPLOYEE_ID = "stf_0001";

function makeEmployee(i: number): Employee {
  const employer = i < 22 ? demoEmployer : employers[1 + (i % 3)];
  const name = fullName(i + 1);
  const salary = round(int(120_000, 520_000), 10_000);
  const accrued = round(salary * (0.4 + rng() * 0.45), 5_000);
  const available = round(accrued * 0.5, 5_000);
  const bridged = rng() > 0.55 ? round(available * (0.15 + rng() * 0.5), 5_000) : 0;
  const eligible = rng() > 0.12;
  return {
    id: `stf_${String(i + 1).padStart(4, "0")}`,
    fullName: name,
    email: `${name.split(" ")[0].toLowerCase()}.${name.split(" ")[1].toLowerCase()}@${employer.name
      .split(" ")[0]
      .toLowerCase()}.com`,
    staffId: `${employer.name.slice(0, 2).toUpperCase()}-${int(1000, 9999)}`,
    employerId: employer.id,
    employerName: employer.name,
    department: pick(DEPARTMENTS),
    jobTitle: pick(TITLES),
    monthlySalary: salary,
    /** Overwritten by the payroll bootstrap with the confirmed net figure. */
    netSalary: round(salary * 0.77, 1_000),
    accruedSalary: accrued,
    availableToBridge: available,
    alreadyBridged: bridged,
    eligible,
    eligibilityNote: eligible ? undefined : pick([
      "Awaiting first full payroll cycle",
      "Bank account verification pending",
      "Employer eligibility review",
    ]),
    kycStatus: pick(["Verified", "Verified", "Verified", "Submitted", "In progress"] as KycStatus[]),
    nextPayday: NEXT_PAYDAY,
    joinedAt: iso(-int(30, 900)),
    wellbeingScore: int(48, 92),
    savingsAllocationPct: pick([0, 0, 5, 5, 10, 15]),
    bankAccounts: bankAccounts(name, 2),
  };
}

export const employees: Employee[] = Array.from({ length: 34 }).map((_, i) => makeEmployee(i));

/** Signed-in employee — exactly the brief's overview figures. */
const demoEmployee = employees[0];
demoEmployee.id = DEMO_EMPLOYEE_ID;
demoEmployee.fullName = "Adaeze Okonkwo";
demoEmployee.email = "adaeze.okonkwo@kadunafoods.com";
demoEmployee.staffId = "KF-1042";
demoEmployee.department = "Operations";
demoEmployee.jobTitle = "Team Lead";
demoEmployee.monthlySalary = 520_000;
demoEmployee.netSalary = 400_000;
demoEmployee.accruedSalary = 200_000;
demoEmployee.availableToBridge = 100_000;
demoEmployee.alreadyBridged = 20_000;
demoEmployee.eligible = true;
demoEmployee.eligibilityNote = undefined;
demoEmployee.kycStatus = "Verified";
demoEmployee.wellbeingScore = 74;
demoEmployee.savingsAllocationPct = 5;
demoEmployee.bankAccounts = [
  {
    id: "ba_demo_primary",
    bankName: "GTBank",
    accountName: "Adaeze Okonkwo",
    accountNumberMasked: "•••• 4417",
    isPrimary: true,
  },
  {
    id: "ba_demo_secondary",
    bankName: "Kuda",
    accountName: "Adaeze Okonkwo",
    accountNumberMasked: "•••• 8820",
    isPrimary: false,
  },
];

/* ------------------------------------------------------ salary accounts */

const SALARY_ACCOUNT_PARTNER_BANK = "Providus Bank";

/**
 * Demo requests for the demo employer only (indices 0-21 in `employees`,
 * per makeEmployee above). Eight pending — matching the dashboard's "Salary
 * Accounts Pending" figure exactly — plus a few already decided, for table
 * variety across every status the review screen needs to demonstrate.
 */
const SALARY_ACCOUNT_STATUSES: SalaryAccountRequestStatus[] = [
  "pending_review",
  "pending_review",
  "pending_review",
  "pending_review",
  "pending_review",
  "pending_review",
  "pending_review",
  "pending_review",
  "active",
  "active",
  "rejected",
  "suspended",
];

export const salaryAccountRequests: SalaryAccountRequest[] = SALARY_ACCOUNT_STATUSES.map((status, i) => {
  const employee = employees[i];
  const requestedAt = iso(-int(1, 21));
  const decided = status !== "pending_review";
  return {
    id: `sar_${String(i + 1).padStart(3, "0")}`,
    employeeId: employee.id,
    employeeName: employee.fullName,
    staffId: employee.staffId,
    currentBank: employee.bankAccounts[0]?.bankName ?? pick(BANKS),
    currentAccountMasked: employee.bankAccounts[0]?.accountNumberMasked ?? `•••• ${int(1000, 9999)}`,
    newPartnerBank: SALARY_ACCOUNT_PARTNER_BANK,
    newAccountMasked: `•••• ${int(1000, 9999)}`,
    requestedAt,
    status,
    decidedAt: decided ? iso(-int(0, 6)) : undefined,
    decidedBy: decided ? "HR administrator" : undefined,
    consent: {
      signedAt: requestedAt,
      deviceRef: `iOS · Safari · ${pick(["Lagos", "Abuja", "Kaduna", "Port Harcourt"])}, NG`,
      consentReferenceId: `CNS-${makeReference()}`,
    },
  };
});

/* ---------------------------------------------------------- bridge history */

const FEE_RATE = 0.03;
export function bridgeFee(amount: number): number {
  return Math.max(100, round(amount * FEE_RATE, 50));
}

function timelineFor(status: TransactionStatus, createdAt: string): BridgeRequest["timeline"] {
  const base = [
    { label: "Request initiated", at: createdAt, state: "done" as const },
    { label: "Approved against earned pay", at: createdAt, state: "done" as const },
    { label: "Sent to disbursement partner", at: createdAt, state: "done" as const },
    { label: "Disbursed to your bank", at: createdAt, state: "done" as const },
    { label: "Settled from payroll", at: NEXT_PAYDAY, state: "pending" as const, note: "On payday" },
  ];
  switch (status) {
    case "Initiated":
      return base.map((e, i) => ({ ...e, state: i === 0 ? "current" : i > 0 ? "pending" : "done" }));
    case "Processing":
      return base.map((e, i) => ({ ...e, state: i < 2 ? "done" : i === 2 ? "current" : "pending" }));
    case "Disbursed":
      return base.map((e, i) => ({ ...e, state: i < 4 ? "done" : "pending" }));
    case "Settled":
      return base.map((e) => ({ ...e, state: "done" }));
    case "Failed":
      return base.map((e, i) => ({
        ...e,
        state: i < 2 ? "done" : i === 2 ? "failed" : "pending",
        note: i === 2 ? "Bank rejected the transfer — funds were not deducted" : e.note,
      }));
    case "Reversed":
      return base.map((e, i) => ({
        ...e,
        state: i < 3 ? "done" : i === 3 ? "failed" : "pending",
        note: i === 3 ? "Reversed to PayBridge — no payroll deduction applies" : e.note,
      }));
    default:
      return base.map((e, i) => ({ ...e, state: i < 3 ? "done" : "pending" }));
  }
}

function makeBridgeRequest(employee: Employee, amount: number, status: TransactionStatus, daysAgo: number): BridgeRequest {
  const fee = bridgeFee(amount);
  const createdAt = iso(-daysAgo, int(8, 19), int(0, 59));
  const account = employee.bankAccounts[0];
  return {
    id: `br_${employee.id}_${daysAgo}_${amount}`,
    reference: makeReference("PB-BR"),
    employeeId: employee.id,
    employeeName: employee.fullName,
    employerId: employee.employerId,
    employerName: employee.employerName,
    amount,
    fee,
    netAmount: amount,
    settlementAmount: amount + fee,
    status,
    bankAccountId: account.id,
    destination: `${account.bankName} ${account.accountNumberMasked}`,
    createdAt,
    disbursedAt: ["Disbursed", "Settled"].includes(status) ? createdAt : undefined,
    settlementDate: NEXT_PAYDAY,
    timeline: timelineFor(status, createdAt),
  };
}

export const bridgeRequests: BridgeRequest[] = [
  makeBridgeRequest(demoEmployee, 20_000, "Disbursed", 4),
  makeBridgeRequest(demoEmployee, 15_000, "Settled", 38),
  makeBridgeRequest(demoEmployee, 30_000, "Settled", 41),
  makeBridgeRequest(demoEmployee, 10_000, "Settled", 68),
  makeBridgeRequest(demoEmployee, 25_000, "Reversed", 72),
  makeBridgeRequest(demoEmployee, 12_500, "Settled", 96),
  ...employees.slice(1, 26).flatMap((employee, i) => {
    const count = 1 + (i % 3);
    return Array.from({ length: count }).map((_, k) =>
      makeBridgeRequest(
        employee,
        round(Math.max(5_000, employee.availableToBridge * (0.2 + rng() * 0.7)), 5_000),
        pick(["Initiated", "Processing", "Disbursed", "Settled", "Settled", "Disbursed", "Failed"] as TransactionStatus[]),
        int(0, 90) + k,
      ),
    );
  }),
];

/* ----------------------------------------------------------------- payroll */

export const payrollRuns: PayrollRun[] = [
  { period: "July 2026", status: "Processing", offset: 0 },
  { period: "June 2026", status: "Reconciled", offset: 1 },
  { period: "May 2026", status: "Reconciled", offset: 2 },
  { period: "April 2026", status: "Reconciled", offset: 3 },
  { period: "March 2026", status: "Failed", offset: 4 },
  { period: "February 2026", status: "Reconciled", offset: 5 },
].map(({ period, status, offset }, i) => ({
  id: `pr_${String(i + 1).padStart(3, "0")}`,
  employerId: DEMO_EMPLOYER_ID,
  period,
  headcount: 284 - offset * int(2, 6),
  grossAmount: 48_500_000 - offset * int(200_000, 900_000),
  uploadedBy: "Chidi Balogun",
  uploadedAt: iso(-(offset * 30 + 3), 11, 24),
  status: status as PayrollRun["status"],
  matchedRecords: 284 - offset * 3 - (status === "Failed" ? 26 : int(0, 3)),
  flaggedRecords: status === "Failed" ? 26 : int(0, 4),
}));

/* ----------------------------------------------------------- salary buffer */

export const salaryBufferRequests: SalaryBufferRequest[] = [
  {
    id: "sbr_001",
    reference: "PB-SB-4KD92",
    employerId: DEMO_EMPLOYER_ID,
    employerName: demoEmployer.name,
    payrollObligation: 48_500_000,
    fundsConfirmed: 35_000_000,
    shortfall: 13_500_000,
    requestedAmount: 20_000_000,
    approvedAmount: 20_000_000,
    pricingRatePct: 3.5,
    tenorDays: 30,
    status: "Funded",
    documents: [
      { id: "doc_1", name: "July-payroll-schedule.xlsx", sizeKb: 412, uploadedAt: iso(-12, 10, 12), category: "Payroll schedule" },
      { id: "doc_2", name: "Bank-statement-Jun-2026.pdf", sizeKb: 1880, uploadedAt: iso(-12, 10, 14), category: "Bank statement" },
    ],
    createdAt: iso(-12, 10, 5),
    fundedAt: iso(-9, 15, 30),
    repaymentDate: NEXT_PAYDAY,
  },
  {
    id: "sbr_002",
    reference: "PB-SB-3JX18",
    employerId: DEMO_EMPLOYER_ID,
    employerName: demoEmployer.name,
    payrollObligation: 47_100_000,
    fundsConfirmed: 41_000_000,
    shortfall: 6_100_000,
    requestedAmount: 6_000_000,
    approvedAmount: 6_000_000,
    pricingRatePct: 3.2,
    tenorDays: 30,
    status: "Repaid",
    documents: [
      { id: "doc_3", name: "June-payroll-schedule.xlsx", sizeKb: 388, uploadedAt: iso(-44, 9, 40), category: "Payroll schedule" },
    ],
    createdAt: iso(-45, 9, 20),
    fundedAt: iso(-43, 12, 0),
    repaymentDate: iso(-16, 9, 0),
  },
  ...employers.slice(1, 6).map((employer, i) => {
    const shortfall = round(employer.payrollObligation - employer.payrollFundsConfirmed, 100_000);
    const status = pick(["Submitted", "Under review", "Offer issued", "Accepted", "Funded", "Declined"] as SalaryBufferRequest["status"][]);
    return {
      id: `sbr_${String(i + 3).padStart(3, "0")}`,
      reference: makeReference("PB-SB"),
      employerId: employer.id,
      employerName: employer.name,
      payrollObligation: employer.payrollObligation,
      fundsConfirmed: employer.payrollFundsConfirmed,
      shortfall,
      requestedAmount: round(shortfall * (0.7 + rng() * 0.5), 500_000),
      approvedAmount: status === "Declined" ? undefined : round(shortfall * 0.8, 500_000),
      pricingRatePct: 3 + Math.round(rng() * 15) / 10,
      tenorDays: pick([30, 30, 45, 60]),
      status,
      documents: [],
      createdAt: iso(-int(2, 30), 10, 0),
      repaymentDate: NEXT_PAYDAY,
    } satisfies SalaryBufferRequest;
  }),
];

/* -------------------------------------------------------------- portfolios */

export const portfolios: Portfolio[] = [
  {
    id: "pf_liquidity",
    name: "PayBridge Liquidity Portfolio",
    summary: "Short-tenor capital supporting employee Bridge requests against verified earned pay.",
    detail:
      "Capital is deployed through a diversified pool of short-duration receivables created when eligible employees access earned salary. Positions self-liquidate at employer payroll settlement, giving the portfolio a naturally short cycle. Employer concentration limits, employee-level caps and payroll verification form the primary credit controls.",
    minimumInvestment: 5_000_000,
    indicativeReturnPct: 18.5,
    tenorMonths: 6,
    liquidity: "Monthly redemption window, 14 days' notice",
    riskLevel: "Moderate",
    distributionFrequency: "Monthly",
    capitalUnderManagement: 1_480_000_000,
    capitalDeployed: 1_190_000_000,
    investorCount: 68,
    status: "Open",
  },
  {
    id: "pf_buffer",
    name: "Employer Salary Buffer Portfolio",
    summary: "Payroll continuity facilities extended to reviewed employers ahead of payday.",
    detail:
      "The portfolio funds Salary Buffer facilities that close short-term payroll funding gaps for employers who pass credit assessment. Facilities are typically 30 days, secured against payroll accounts and repaid at the next payroll cycle. Exposure is monitored per employer with graduated limits.",
    minimumInvestment: 25_000_000,
    indicativeReturnPct: 21,
    tenorMonths: 12,
    liquidity: "Quarterly redemption window, 30 days' notice",
    riskLevel: "Moderate",
    distributionFrequency: "Quarterly",
    capitalUnderManagement: 2_260_000_000,
    capitalDeployed: 1_820_000_000,
    investorCount: 24,
    status: "Open",
  },
  {
    id: "pf_institutional",
    name: "Institutional Funding Mandate",
    summary: "Bespoke mandate for institutions funding PayBridge portfolios at scale.",
    detail:
      "A negotiated mandate for institutional allocators, with tailored reporting, agreed concentration limits and structured drawdown schedules across both the Liquidity and Salary Buffer portfolios. Terms, pricing and covenants are documented per mandate.",
    minimumInvestment: 250_000_000,
    indicativeReturnPct: 23.5,
    tenorMonths: 24,
    liquidity: "At maturity, secondary transfer by agreement",
    riskLevel: "High",
    distributionFrequency: "At maturity",
    capitalUnderManagement: 4_100_000_000,
    capitalDeployed: 3_450_000_000,
    investorCount: 7,
    status: "Closing soon",
  },
];

/* ---------------------------------------------------------------- investor */

export const DEMO_INVESTOR_ID = "inv_001";

const INVESTOR_SEEDS: Array<{ name: string; type: Investor["type"]; kyb: KycStatus }> = [
  { name: "Ardent Capital Partners", type: "Institution", kyb: "Verified" },
  { name: "Olumide Ashiru", type: "Individual", kyb: "Verified" },
  { name: "Harmattan Pension Trust", type: "Institution", kyb: "Verified" },
  { name: "Ifeoma Nwachukwu", type: "Individual", kyb: "Submitted" },
  { name: "Silverline Family Office", type: "Institution", kyb: "In progress" },
  { name: "Abdulrahman Yakubu", type: "Individual", kyb: "Verified" },
  { name: "Corvus Alternative Assets", type: "Institution", kyb: "Rejected" },
];

export const investors: Investor[] = INVESTOR_SEEDS.map((seed, i) => {
  const committed = round(int(20, 400) * 1_000_000, 5_000_000);
  const deployed = round(committed * (0.6 + rng() * 0.3), 500_000);
  const income = round(committed * (0.03 + rng() * 0.04), 50_000);
  return {
    id: `inv_${String(i + 1).padStart(3, "0")}`,
    name: seed.name,
    type: seed.type,
    email: `${seed.name.split(" ")[0].toLowerCase()}@${seed.type === "Institution" ? "fund.ng" : "gmail.com"}`,
    kybStatus: seed.kyb,
    accreditation: seed.type === "Institution" ? "Qualified institutional investor" : "High-net-worth individual",
    portfolioValue: committed + income,
    capitalCommitted: committed,
    capitalDeployed: deployed,
    undeployedCapital: committed - deployed,
    netIncomeEarned: income,
    availableForWithdrawal: round(income + (committed - deployed) * 0.4, 500_000),
    feesToDate: round(income * 0.18, 10_000),
    riskProfile: pick(["Low", "Moderate", "Moderate", "High"] as RiskLevel[]),
    joinedAt: iso(-int(60, 700)),
    bankAccounts: bankAccounts(seed.name, 1),
  };
});

/** Signed-in investor — the brief's figures. */
const demoInvestor = investors[0];
demoInvestor.name = "Ardent Capital Partners";
demoInvestor.portfolioValue = 125_850_000;
demoInvestor.capitalCommitted = 120_000_000;
demoInvestor.capitalDeployed = 89_500_000;
demoInvestor.undeployedCapital = 30_500_000;
demoInvestor.netIncomeEarned = 5_850_000;
demoInvestor.availableForWithdrawal = 18_000_000;
demoInvestor.feesToDate = 1_050_000;
demoInvestor.kybStatus = "Verified";
demoInvestor.riskProfile = "Moderate";
demoInvestor.bankAccounts = [
  {
    id: "ba_inv_primary",
    bankName: "Providus Bank",
    accountName: "Ardent Capital Partners",
    accountNumberMasked: "•••• 9031",
    isPrimary: true,
  },
];

export const investments: Investment[] = [
  {
    id: "ivt_001",
    reference: "PB-IV-7HK32",
    investorId: DEMO_INVESTOR_ID,
    investorName: demoInvestor.name,
    portfolioId: "pf_liquidity",
    portfolioName: "PayBridge Liquidity Portfolio",
    amount: 60_000_000,
    incomeEarned: 3_420_000,
    feesCharged: 615_000,
    status: "Active",
    startDate: iso(-140, 10, 0),
    maturityDate: iso(40, 10, 0),
    distributionFrequency: "Monthly",
  },
  {
    id: "ivt_002",
    reference: "PB-IV-7HK33",
    investorId: DEMO_INVESTOR_ID,
    investorName: demoInvestor.name,
    portfolioId: "pf_buffer",
    portfolioName: "Employer Salary Buffer Portfolio",
    amount: 45_000_000,
    incomeEarned: 2_180_000,
    feesCharged: 392_000,
    status: "Active",
    startDate: iso(-96, 10, 0),
    maturityDate: iso(270, 10, 0),
    distributionFrequency: "Quarterly",
  },
  {
    id: "ivt_003",
    reference: "PB-IV-7HK34",
    investorId: DEMO_INVESTOR_ID,
    investorName: demoInvestor.name,
    portfolioId: "pf_liquidity",
    portfolioName: "PayBridge Liquidity Portfolio",
    amount: 15_000_000,
    incomeEarned: 250_000,
    feesCharged: 43_000,
    status: "Pending funding",
    startDate: iso(-2, 10, 0),
    maturityDate: iso(178, 10, 0),
    distributionFrequency: "Monthly",
  },
  ...investors.slice(1, 6).map((investor, i) => {
    const portfolio = portfolios[i % portfolios.length];
    return {
      id: `ivt_${String(i + 4).padStart(3, "0")}`,
      reference: makeReference("PB-IV"),
      investorId: investor.id,
      investorName: investor.name,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      amount: round(investor.capitalDeployed * 0.5, 1_000_000),
      incomeEarned: round(investor.netIncomeEarned * 0.5, 50_000),
      feesCharged: round(investor.feesToDate * 0.5, 10_000),
      status: pick(["Active", "Active", "Maturing", "Matured"] as Investment["status"][]),
      startDate: iso(-int(60, 300), 10, 0),
      maturityDate: iso(int(20, 320), 10, 0),
      distributionFrequency: portfolio.distributionFrequency,
    } satisfies Investment;
  }),
];

export const withdrawals: Withdrawal[] = [
  {
    id: "wd_001",
    reference: "PB-WD-2LP41",
    investorId: DEMO_INVESTOR_ID,
    investorName: demoInvestor.name,
    amount: 8_000_000,
    bankAccountId: "ba_inv_primary",
    destination: "Providus Bank •••• 9031",
    status: "Paid",
    requestedAt: iso(-26, 11, 0),
    valueDate: iso(-22, 11, 0),
  },
  {
    id: "wd_002",
    reference: "PB-WD-2LP42",
    investorId: DEMO_INVESTOR_ID,
    investorName: demoInvestor.name,
    amount: 4_500_000,
    bankAccountId: "ba_inv_primary",
    destination: "Providus Bank •••• 9031",
    status: "Under review",
    requestedAt: hoursAgo(20),
    valueDate: iso(3, 11, 0),
  },
  ...investors.slice(1, 5).map((investor, i) => ({
    id: `wd_${String(i + 3).padStart(3, "0")}`,
    reference: makeReference("PB-WD"),
    investorId: investor.id,
    investorName: investor.name,
    amount: round(investor.availableForWithdrawal * 0.4, 500_000),
    bankAccountId: investor.bankAccounts[0].id,
    destination: `${investor.bankAccounts[0].bankName} ${investor.bankAccounts[0].accountNumberMasked}`,
    status: pick(["Requested", "Under review", "Approved", "Paid", "Declined"] as Withdrawal["status"][]),
    requestedAt: iso(-int(1, 30), 12, 0),
    valueDate: iso(int(1, 6), 12, 0),
  })),
];

/* -------------------------------------------------------------- repayments */

export const repayments: Repayment[] = [
  {
    id: "rp_001",
    reference: "PB-RP-9MC10",
    sourceType: "Salary Buffer",
    counterparty: demoEmployer.name,
    employerId: DEMO_EMPLOYER_ID,
    amountDue: 20_700_000,
    amountPaid: 0,
    dueDate: NEXT_PAYDAY,
    status: "Scheduled",
    reconciliation: "Unmatched",
  },
  {
    id: "rp_002",
    reference: "PB-RP-9MC11",
    sourceType: "Payroll settlement",
    counterparty: demoEmployer.name,
    employerId: DEMO_EMPLOYER_ID,
    amountDue: 9_400_000,
    amountPaid: 4_100_000,
    dueDate: NEXT_PAYDAY,
    status: "Part paid",
    reconciliation: "Partially matched",
  },
  {
    id: "rp_003",
    reference: "PB-RP-9MC12",
    sourceType: "Salary Buffer",
    counterparty: demoEmployer.name,
    employerId: DEMO_EMPLOYER_ID,
    amountDue: 6_192_000,
    amountPaid: 6_192_000,
    dueDate: iso(-16, 9, 0),
    status: "Paid",
    reconciliation: "Matched",
  },
  ...employers.slice(1, 7).map((employer, i) => {
    const due = round(employer.utilisedLimit || employer.payrollObligation * 0.1, 100_000);
    const status = pick(["Scheduled", "Part paid", "Paid", "Overdue"] as Repayment["status"][]);
    return {
      id: `rp_${String(i + 4).padStart(3, "0")}`,
      reference: makeReference("PB-RP"),
      sourceType: pick(["Salary Buffer", "Payroll settlement"] as Repayment["sourceType"][]),
      counterparty: employer.name,
      employerId: employer.id,
      amountDue: due,
      amountPaid: status === "Paid" ? due : status === "Part paid" ? round(due * 0.5, 100_000) : 0,
      dueDate: status === "Overdue" ? iso(-int(2, 20), 9, 0) : NEXT_PAYDAY,
      status,
      reconciliation: pick(["Matched", "Partially matched", "Unmatched", "Investigating", "Resolved"] as ReconciliationStatus[]),
    } satisfies Repayment;
  }),
];

/* ------------------------------------------------------------ transactions */

export const transactions: Transaction[] = [
  ...bridgeRequests.slice(0, 30).map((request) => ({
    id: `tx_${request.id}`,
    reference: request.reference,
    type: "Bridge" as const,
    counterparty: request.employeeName,
    employerName: request.employerName,
    amount: request.amount,
    fee: request.fee,
    status: request.status,
    channel: "NIP transfer",
    createdAt: request.createdAt,
    reconciliation: (request.status === "Settled" ? "Matched" : pick(["Unmatched", "Partially matched", "Investigating"])) as ReconciliationStatus,
  })),
  ...salaryBufferRequests.slice(0, 5).map((buffer, i) => ({
    id: `tx_sb_${i}`,
    reference: buffer.reference,
    type: "Salary Buffer" as const,
    counterparty: buffer.employerName,
    employerName: buffer.employerName,
    amount: buffer.approvedAmount ?? buffer.requestedAmount,
    fee: round((buffer.approvedAmount ?? buffer.requestedAmount) * (buffer.pricingRatePct / 100), 1_000),
    status: (buffer.status === "Funded" ? "Disbursed" : buffer.status === "Repaid" ? "Settled" : "Processing") as TransactionStatus,
    channel: "Bank transfer",
    createdAt: buffer.createdAt,
    reconciliation: (buffer.status === "Repaid" ? "Matched" : "Unmatched") as ReconciliationStatus,
  })),
  ...repayments.slice(0, 6).map((repayment, i) => ({
    id: `tx_rp_${i}`,
    reference: repayment.reference,
    type: "Repayment" as const,
    counterparty: repayment.counterparty,
    employerName: repayment.counterparty,
    amount: repayment.amountDue,
    fee: 0,
    status: (repayment.status === "Paid" ? "Settled" : repayment.status === "Overdue" ? "Overdue" : "Processing") as TransactionStatus,
    channel: "Direct debit",
    createdAt: repayment.dueDate,
    reconciliation: repayment.reconciliation,
  })),
  ...investments.slice(0, 6).map((investment, i) => ({
    id: `tx_iv_${i}`,
    reference: investment.reference,
    type: "Investor inflow" as const,
    counterparty: investment.investorName,
    amount: investment.amount,
    fee: investment.feesCharged,
    status: (investment.status === "Pending funding" ? "Initiated" : "Settled") as TransactionStatus,
    channel: "Bank transfer",
    createdAt: investment.startDate,
    reconciliation: (investment.status === "Pending funding" ? "Unmatched" : "Matched") as ReconciliationStatus,
  })),
  ...withdrawals.slice(0, 5).map((withdrawal, i) => ({
    id: `tx_wd_${i}`,
    reference: withdrawal.reference,
    type: "Withdrawal" as const,
    counterparty: withdrawal.investorName,
    amount: withdrawal.amount,
    fee: 0,
    status: (withdrawal.status === "Paid" ? "Settled" : withdrawal.status === "Declined" ? "Reversed" : "Processing") as TransactionStatus,
    channel: "Bank transfer",
    createdAt: withdrawal.requestedAt,
    reconciliation: (withdrawal.status === "Paid" ? "Matched" : "Unmatched") as ReconciliationStatus,
  })),
].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

/* ----------------------------------------------------- risk and compliance */

export const riskAlerts: RiskAlert[] = [
  {
    id: "ra_001",
    reference: "RSK-1043",
    title: "Employer concentration above threshold",
    entity: "Lagos Retail Group",
    entityType: "Employer",
    level: "High",
    detail: "Single-employer exposure is 21.4% of deployed capital against a 20% policy limit.",
    status: "Open",
    raisedAt: hoursAgo(5),
    owner: "Risk desk",
  },
  {
    id: "ra_002",
    reference: "RSK-1044",
    title: "Payroll funding gap widening",
    entity: "Bluewater Hospitality",
    entityType: "Employer",
    level: "Critical",
    detail: "Confirmed payroll funds cover 54% of obligation with 4 days to payday.",
    status: "Monitoring",
    raisedAt: hoursAgo(14),
    owner: "Risk desk",
  },
  {
    id: "ra_003",
    reference: "RSK-1045",
    title: "Repeat failed disbursements",
    entity: "PB-BR-88KD2",
    entityType: "Transaction",
    level: "Moderate",
    detail: "Three consecutive NIP failures to the same destination account.",
    status: "Open",
    raisedAt: hoursAgo(28),
    owner: "Operations",
  },
  {
    id: "ra_004",
    reference: "RSK-1046",
    title: "Utilisation spike",
    entity: "Sahel Logistics Plc",
    entityType: "Employer",
    level: "Moderate",
    detail: "Bridge utilisation rose 34% week-on-week across 62 employees.",
    status: "Monitoring",
    raisedAt: hoursAgo(40),
    owner: "Risk desk",
  },
  {
    id: "ra_005",
    reference: "RSK-1047",
    title: "Undeployed capital ageing",
    entity: "PayBridge Liquidity Portfolio",
    entityType: "Portfolio",
    level: "Low",
    detail: "₦290m has been undeployed for more than 21 days, diluting portfolio yield.",
    status: "Mitigated",
    raisedAt: hoursAgo(72),
    owner: "Finance",
  },
  {
    id: "ra_006",
    reference: "RSK-1048",
    title: "Suspended employer with open exposure",
    entity: "Palmview Agro Industries",
    entityType: "Employer",
    level: "Critical",
    detail: "₦4.2m outstanding while the employer account is suspended.",
    status: "Open",
    raisedAt: hoursAgo(96),
    owner: "Risk desk",
  },
];

export const complianceCases: ComplianceCase[] = [
  {
    id: "cc_001",
    reference: "CMP-2081",
    subject: "KYB documents expired",
    entity: "Silverline Family Office",
    caseType: "KYB review",
    status: "In review",
    riskLevel: "Moderate",
    openedAt: hoursAgo(30),
    dueAt: iso(4, 17, 0),
    owner: "Compliance desk",
    notes: "Certificate of incorporation and directors' IDs require refresh before capital call.",
  },
  {
    id: "cc_002",
    reference: "CMP-2082",
    subject: "Sanctions screening hit — possible false positive",
    entity: "Corvus Alternative Assets",
    caseType: "Sanctions screening",
    status: "Escalated",
    riskLevel: "High",
    openedAt: hoursAgo(52),
    dueAt: iso(1, 17, 0),
    owner: "Head of Compliance",
    notes: "Name match on a watchlist entry; awaiting date-of-birth confirmation from the investor.",
  },
  {
    id: "cc_003",
    reference: "CMP-2083",
    subject: "Employee identity mismatch",
    entity: "Halima Danjuma · Sahel Logistics",
    caseType: "KYC review",
    status: "Open",
    riskLevel: "Moderate",
    openedAt: hoursAgo(9),
    dueAt: iso(3, 17, 0),
    owner: "Compliance desk",
    notes: "BVN name differs from payroll record; requesting employer confirmation.",
  },
  {
    id: "cc_004",
    reference: "CMP-2084",
    subject: "Unusual request pattern",
    entity: "Employee cluster · Lagos Retail Group",
    caseType: "Transaction monitoring",
    status: "In review",
    riskLevel: "Low",
    openedAt: hoursAgo(64),
    dueAt: iso(6, 17, 0),
    owner: "Compliance desk",
    notes: "Nine requests to the same destination account across different staff IDs.",
  },
  {
    id: "cc_005",
    reference: "CMP-2085",
    subject: "Customer complaint — fee clarity",
    entity: "Tunde Eze · Kaduna Foods",
    caseType: "Complaint",
    status: "Cleared",
    riskLevel: "Low",
    openedAt: hoursAgo(140),
    dueAt: iso(-2, 17, 0),
    owner: "Support",
    notes: "Fee breakdown re-sent and acknowledged. No further action.",
  },
  {
    id: "cc_006",
    reference: "CMP-2086",
    subject: "Regulatory report submitted",
    entity: "PayBridge",
    caseType: "Transaction monitoring",
    status: "Reported" as ComplianceStatus,
    riskLevel: "Low",
    openedAt: hoursAgo(200),
    dueAt: iso(-5, 17, 0),
    owner: "Head of Compliance",
    notes: "Monthly return filed. Reference NFIU-2026-07-114.",
  },
];

export const supportTickets: SupportTicket[] = [
  {
    id: "st_001",
    reference: "SUP-5521",
    subject: "Bridge disbursement not received",
    requester: "Ngozi Eze",
    requesterType: "Employee",
    channel: "In-app",
    priority: "High",
    status: "Open",
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(1),
    messages: [
      { id: "m1", author: "Ngozi Eze", authorType: "Customer", body: "My Bridge shows disbursed but my bank has not credited me.", at: hoursAgo(3) },
      { id: "m2", author: "PayBridge Support", authorType: "PayBridge", body: "Thank you — we are tracing the transfer with the bank and will update you within the hour.", at: hoursAgo(1) },
    ],
  },
  {
    id: "st_002",
    reference: "SUP-5522",
    subject: "Payroll upload rejected 26 rows",
    requester: "Chidi Balogun · Kaduna Foods",
    requesterType: "Employer",
    channel: "Email",
    priority: "Normal",
    status: "Waiting on customer",
    createdAt: hoursAgo(22),
    updatedAt: hoursAgo(6),
    messages: [
      { id: "m1", author: "Chidi Balogun", authorType: "Customer", body: "Our March upload failed validation. What is wrong with the file?", at: hoursAgo(22) },
      { id: "m2", author: "PayBridge Support", authorType: "PayBridge", body: "26 rows are missing staff IDs. We have attached the flagged rows for correction.", at: hoursAgo(6) },
    ],
  },
  {
    id: "st_003",
    reference: "SUP-5523",
    subject: "Statement request for Q2 2026",
    requester: "Ardent Capital Partners",
    requesterType: "Investor",
    channel: "Email",
    priority: "Low",
    status: "Resolved",
    createdAt: hoursAgo(70),
    updatedAt: hoursAgo(64),
    messages: [
      { id: "m1", author: "Ardent Capital Partners", authorType: "Customer", body: "Please send the Q2 portfolio statement.", at: hoursAgo(70) },
      { id: "m2", author: "PayBridge Support", authorType: "PayBridge", body: "Statement generated and available in your Documents tab.", at: hoursAgo(64) },
    ],
  },
  {
    id: "st_004",
    reference: "SUP-5524",
    subject: "Change salary account",
    requester: "Yusuf Musa",
    requesterType: "Employee",
    channel: "WhatsApp",
    priority: "Normal",
    status: "Escalated",
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(12),
    messages: [
      { id: "m1", author: "Yusuf Musa", authorType: "Customer", body: "I want to change the account my Bridge is paid into.", at: hoursAgo(48) },
    ],
  },
  {
    id: "st_005",
    reference: "SUP-5525",
    subject: "Salary Buffer offer clarification",
    requester: "Bluewater Hospitality",
    requesterType: "Employer",
    channel: "Phone",
    priority: "Urgent",
    status: "Open",
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
    messages: [
      { id: "m1", author: "Bluewater Hospitality", authorType: "Customer", body: "We need the buffer confirmed before Friday payroll.", at: hoursAgo(2) },
    ],
  },
];

export const auditLogs: AuditLog[] = [
  { actor: "Chidi Balogun", actorRole: "Payroll administrator", action: "Accepted exception PB-EXC-3011 · Salary change confirmed", entity: "Payroll exception · Kaduna Foods Limited", ip: "102.89.20.14", at: hoursAgo(2) },
  { actor: "Tunde Ojo", actorRole: "HR administrator", action: "Paused accrual on exception PB-EXC-3008 · Employment status change", entity: "Payroll exception · Kaduna Foods Limited", ip: "102.89.20.31", at: hoursAgo(6) },
  { actor: "PayBridge system", actorRole: "Integration", action: "Payroll sync completed · 284 records, 3 exceptions raised", entity: "Payroll integration · Kaduna Foods Limited", ip: "10.0.0.4", at: hoursAgo(7) },
  { actor: "Ngozi Adeyemi", actorRole: "Finance authoriser", action: "Approved and processed payroll · August 2026", entity: "Payroll period · Kaduna Foods Limited", ip: "197.210.7.14", at: hoursAgo(20) },
  { actor: "Chidi Balogun", actorRole: "Payroll administrator", action: "Bulk accepted 6 low-risk exceptions", entity: "Payroll exceptions · Kaduna Foods Limited", ip: "102.89.20.14", at: hoursAgo(28) },
  { actor: "PayBridge system", actorRole: "Settlement engine", action: "Scheduled PayBridge settlement lines for payday", entity: "Payroll settlement · Kaduna Foods Limited", ip: "10.0.0.4", at: hoursAgo(31) },
  { actor: "Femi Akande", actorRole: "Operations officer", action: "Approved Bridge request PB-BR-19KD4", entity: "Bridge request", ip: "102.89.34.12", at: hoursAgo(1) },
  { actor: "Grace Umeh", actorRole: "Risk officer", action: "Raised risk alert RSK-1043", entity: "Employer · Lagos Retail Group", ip: "102.89.34.51", at: hoursAgo(5) },
  { actor: "Sadiq Bello", actorRole: "Finance officer", action: "Released ₦20,000,000 Salary Buffer funding", entity: "PB-SB-4KD92", ip: "197.210.7.88", at: hoursAgo(9) },
  { actor: "Compliance desk", actorRole: "Compliance officer", action: "Escalated case CMP-2082", entity: "Investor · Corvus Alternative Assets", ip: "102.89.34.77", at: hoursAgo(14) },
  { actor: "Super admin", actorRole: "Super administrator", action: "Updated employer limit to ₦24,000,000", entity: "Employer · Kaduna Foods Limited", ip: "102.89.34.9", at: hoursAgo(26) },
  { actor: "Femi Akande", actorRole: "Operations officer", action: "Retried failed disbursement", entity: "PB-BR-88KD2", ip: "102.89.34.12", at: hoursAgo(30) },
  { actor: "Grace Umeh", actorRole: "Risk officer", action: "Suspended employer account", entity: "Employer · Palmview Agro Industries", ip: "102.89.34.51", at: hoursAgo(44) },
  { actor: "Sadiq Bello", actorRole: "Finance officer", action: "Marked reconciliation batch as matched", entity: "Reconciliation · July 2026", ip: "197.210.7.88", at: hoursAgo(52) },
  { actor: "Compliance desk", actorRole: "Compliance officer", action: "Verified investor KYB", entity: "Investor · Harmattan Pension Trust", ip: "102.89.34.77", at: hoursAgo(66) },
  { actor: "Super admin", actorRole: "Super administrator", action: "Added operations staff account", entity: "User · risk@paybridge.africa", ip: "102.89.34.9", at: hoursAgo(80) },
].map((entry, i) => ({ id: `al_${String(i + 1).padStart(3, "0")}`, ...entry }));

/* ------------------------------------------------- wellbeing, savings, docs */

export const wellbeingMetrics: WellbeingMetric[] = [
  { label: "Pay stability", value: 78, target: 85, hint: "How evenly your pay is spread across the month." },
  { label: "Bridge usage", value: 27, target: 30, hint: "Share of available earned pay you typically access early." },
  { label: "Savings habit", value: 55, target: 70, hint: "Consistency of your monthly savings allocation." },
  { label: "Payday cushion", value: 64, target: 75, hint: "Funds left over in the last three days before payday." },
];

export const savingsGoals: SavingsGoal[] = [
  {
    id: "sg_1",
    name: "Rent fund",
    allocationPct: 5,
    balance: 96_000,
    target: 450_000,
    nextDeduction: NEXT_PAYDAY,
    productId: "sp_target",
    productName: "Goal Saver (Target)",
    interestEarned: 3_180,
  },
  {
    id: "sg_2",
    name: "School fees",
    allocationPct: 3,
    balance: 42_500,
    target: 200_000,
    nextDeduction: NEXT_PAYDAY,
    productId: "sp_target",
    productName: "Goal Saver (Target)",
    interestEarned: 1_240,
  },
  {
    id: "sg_3",
    name: "Emergency buffer",
    allocationPct: 2,
    balance: 18_200,
    target: 150_000,
    nextDeduction: NEXT_PAYDAY,
    productId: "sp_flex",
    productName: "Salary Buffer (Flexible)",
    interestEarned: 410,
  },
];

export const statements: Statement[] = [
  { id: "sm_1", ownerId: DEMO_INVESTOR_ID, title: "Portfolio statement", period: "June 2026", kind: "Statement", generatedAt: iso(-25, 8, 0), sizeKb: 214 },
  { id: "sm_2", ownerId: DEMO_INVESTOR_ID, title: "Portfolio statement", period: "May 2026", kind: "Statement", generatedAt: iso(-56, 8, 0), sizeKb: 208 },
  { id: "sm_3", ownerId: DEMO_INVESTOR_ID, title: "Quarterly portfolio report", period: "Q2 2026", kind: "Portfolio report", generatedAt: iso(-20, 8, 0), sizeKb: 986 },
  { id: "sm_4", ownerId: DEMO_INVESTOR_ID, title: "Withholding tax report", period: "H1 2026", kind: "Tax report", generatedAt: iso(-18, 8, 0), sizeKb: 132 },
  { id: "sm_5", ownerId: DEMO_EMPLOYER_ID, title: "Payroll reconciliation", period: "June 2026", kind: "Payroll report", generatedAt: iso(-24, 8, 0), sizeKb: 342 },
  { id: "sm_6", ownerId: DEMO_EMPLOYER_ID, title: "Bridge activity report", period: "June 2026", kind: "Settlement report", generatedAt: iso(-24, 8, 0), sizeKb: 288 },
  { id: "sm_7", ownerId: DEMO_EMPLOYEE_ID, title: "Bridge statement", period: "June 2026", kind: "Statement", generatedAt: iso(-24, 8, 0), sizeKb: 96 },
  { id: "sm_8", ownerId: DEMO_EMPLOYEE_ID, title: "Bridge statement", period: "May 2026", kind: "Statement", generatedAt: iso(-55, 8, 0), sizeKb: 94 },
];

export const notifications: Notification[] = [
  { id: "nt_1", portal: "employee", tone: "success", title: "₦20,000 disbursed", body: "Your Bridge was sent to GTBank •••• 4417.", at: hoursAgo(4), read: false },
  { id: "nt_2", portal: "employee", tone: "info", title: "Payday settlement scheduled", body: "₦20,000 will be settled from payroll on 28 August 2026.", at: hoursAgo(20), read: false },
  { id: "nt_3", portal: "employee", tone: "info", title: "New savings allocation active", body: "5% of your salary now moves to Rent fund.", at: hoursAgo(70), read: true },
  { id: "nt_4", portal: "employer", tone: "attention", title: "Projected payroll shortfall", body: "₦13,500,000 gap detected for the 28 August run.", at: hoursAgo(6), read: false },
  { id: "nt_5", portal: "employer", tone: "success", title: "Salary Buffer funded", body: "₦20,000,000 released to your payroll account.", at: hoursAgo(30), read: true },
  { id: "nt_6", portal: "investor", tone: "success", title: "Monthly distribution paid", body: "₦1,140,000 income distributed from the Liquidity Portfolio.", at: hoursAgo(48), read: false },
  { id: "nt_7", portal: "investor", tone: "info", title: "Statement available", body: "Your June 2026 portfolio statement is ready.", at: hoursAgo(96), read: true },
  { id: "nt_8", portal: "operations", tone: "attention", title: "2 critical risk alerts", body: "Bluewater Hospitality and Palmview Agro require review.", at: hoursAgo(2), read: false },
  { id: "nt_9", portal: "operations", tone: "info", title: "Reconciliation batch ready", body: "July settlement file uploaded by partner bank.", at: hoursAgo(12), read: true },
];

/* ------------------------------------------------------------------- users */

export const DEMO_USERS: Record<Role, User> = (() => {
  const base = (
    role: Role,
    fullName: string,
    email: string,
    organisation: string | undefined,
    accountId: string | undefined,
  ): User => ({
    id: `usr_${role}`,
    fullName,
    email,
    phone: "+234 803 000 0000",
    role,
    organisation,
    accountId,
    avatarInitials: initialsOf(fullName),
    twoFactorEnabled: role.startsWith("ops") || role === "super_admin",
    lastLoginAt: hoursAgo(int(2, 40)),
    createdAt: iso(-int(60, 500)),
  });
  return {
    employee: base("employee", "Adaeze Okonkwo", "adaeze.okonkwo@kadunafoods.com", "Kaduna Foods Limited", DEMO_EMPLOYEE_ID),
    employer_admin: base("employer_admin", "Chidi Balogun", "chidi.balogun@kadunafoods.com", "Kaduna Foods Limited", DEMO_EMPLOYER_ID),
    employer_finance: base("employer_finance", "Ngozi Adeyemi", "ngozi.adeyemi@kadunafoods.com", "Kaduna Foods Limited", DEMO_EMPLOYER_ID),
    employer_hr: base("employer_hr", "Tunde Ojo", "tunde.ojo@kadunafoods.com", "Kaduna Foods Limited", DEMO_EMPLOYER_ID),
    employer_viewer: base("employer_viewer", "Bola Adekunle", "bola.adekunle@kadunafoods.com", "Kaduna Foods Limited", DEMO_EMPLOYER_ID),
    investor: base("investor", "Ardent Capital Partners", "portfolio@ardentcapital.ng", "Ardent Capital Partners", DEMO_INVESTOR_ID),
    ops_officer: base("ops_officer", "Femi Akande", "femi.akande@paybridge.africa", "PayBridge", undefined),
    ops_risk: base("ops_risk", "Grace Umeh", "grace.umeh@paybridge.africa", "PayBridge", undefined),
    ops_compliance: base("ops_compliance", "Aisha Sani", "aisha.sani@paybridge.africa", "PayBridge", undefined),
    ops_finance: base("ops_finance", "Sadiq Bello", "sadiq.bello@paybridge.africa", "PayBridge", undefined),
    super_admin: base("super_admin", "Kelechi Obi", "kelechi.obi@paybridge.africa", "PayBridge", undefined),
  };
})();

/* ------------------------------------------------------------------ series */

const MONTH_LABELS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];

export const employerBridgeActivity = MONTH_LABELS.map((label, i) => ({
  label,
  value: round(5_200_000 + i * 620_000 + rng() * 900_000, 50_000),
  secondary: 62 + i * 6 + int(0, 5),
}));

export const investorPerformance = MONTH_LABELS.map((label, i) => ({
  label,
  value: round(96_000_000 + i * 5_200_000 + rng() * 2_000_000, 100_000),
  secondary: Number((1.2 + i * 0.08 + rng() * 0.2).toFixed(2)),
}));

export const opsVolume = MONTH_LABELS.map((label, i) => ({
  label,
  value: round(310_000_000 + i * 42_000_000 + rng() * 20_000_000, 1_000_000),
  secondary: round(96_000_000 + i * 12_000_000 + rng() * 8_000_000, 1_000_000),
}));

export const employeeSpendPattern = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"].map((label, i) => ({
  label,
  value: [42, 28, 18, 12][i],
}));

/* ------------------------------------------------- Save: structured products */

/** The regulated manager named on the public site. */
export const ASSET_MANAGER = "Invest-Trust Asset Management Limited";

export const savingsProducts: SavingsProduct[] = [
  {
    id: "sp_flex",
    name: "Salary Buffer (Flexible)",
    type: "Flexible",
    ratePct: 8,
    rateBasis: "per annum, accrued daily, before applicable taxes",
    minimumAmount: 1_000,
    liquidity: "Withdraw any time, same day",
    manager: ASSET_MANAGER,
    description:
      "A cushion that sits between paydays. A small share of each payday goes in automatically and you can take it out whenever you need it.",
    disclosure:
      "Rates are indicative, may change, and are shown in line with the approved offering. Not a guarantee of future returns.",
    status: "Available",
  },
  {
    id: "sp_target",
    name: "Goal Saver (Target)",
    type: "Target",
    ratePct: 10,
    rateBasis: "per annum on the average balance, before applicable taxes",
    minimumAmount: 2_500,
    liquidity: "Withdraw any time; the goal date is a reminder, not a lock",
    manager: ASSET_MANAGER,
    description:
      "Name a goal, set a target and a date. PayBridge works out what to set aside each payday and keeps you on pace.",
    disclosure:
      "Rates are indicative and may change. Reaching a goal depends on the amounts you actually set aside.",
    status: "Available",
  },
  {
    id: "sp_fixed",
    name: "Fixed Plan (90 days)",
    type: "Fixed",
    ratePct: 13.5,
    rateBasis: "per annum for the full tenor, before applicable taxes",
    tenorDays: 90,
    minimumAmount: 50_000,
    liquidity: "At maturity. Early exit reduces the rate applied.",
    manager: ASSET_MANAGER,
    description:
      "For money you know you will not need for three months. A fixed tenor in exchange for a higher published rate.",
    disclosure:
      "Rates are indicative, subject to the approved offering, and applied at maturity. Early liquidation terms apply.",
    status: "Available",
  },
  {
    id: "sp_group",
    name: "Workplace Group Save",
    type: "Target",
    minimumAmount: 5_000,
    liquidity: "At the end of each group cycle",
    manager: ASSET_MANAGER,
    description:
      "A structured group savings cycle run with your employer's wellbeing programme. Rates and terms are published when the offering is approved.",
    disclosure: "This product is not yet available. Terms remain subject to regulatory approval.",
    status: "Pending approval",
  },
];

/* --------------------------------------------------- Invest: products & data */

export const investmentProducts: InvestmentProduct[] = [
  {
    id: "ip_mmf",
    name: "PayBridge Money Market Fund",
    assetClass: "Money market fund",
    manager: ASSET_MANAGER,
    band: "Conservative",
    indicativeYieldPct: 18.4,
    yieldBasis: "30-day annualised yield as at last valuation, net of fund fees",
    horizon: "Any time from 30 days",
    minimumAmount: 5_000,
    liquidity: "Redeem in 1 business day",
    status: "Available",
    description:
      "Short-dated instruments held for stability and access. Most people start here while they build a cushion.",
    disclosure:
      "Yields fluctuate with market rates. Past performance does not guarantee future results.",
  },
  {
    id: "ip_tbills",
    name: "Treasury Bills (91 / 182 / 364 day)",
    assetClass: "Treasury bills",
    manager: ASSET_MANAGER,
    band: "Conservative",
    indicativeYieldPct: 19.1,
    yieldBasis: "indicative discount rate at last auction",
    horizon: "Hold to maturity",
    minimumAmount: 100_000,
    liquidity: "At maturity, or by sale on the secondary market",
    status: "Available",
    description:
      "Federal Government short-term instruments bought at auction on your behalf and held to maturity.",
    disclosure:
      "Auction rates vary. Secondary-market sales before maturity can return less than the amount invested.",
  },
  {
    id: "ip_bonds",
    name: "FGN Bond Ladder",
    assetClass: "Government bonds",
    manager: ASSET_MANAGER,
    band: "Balanced",
    indicativeYieldPct: 17.2,
    yieldBasis: "indicative yield to maturity across the ladder",
    horizon: "2 – 10 years",
    minimumAmount: 250_000,
    liquidity: "Secondary market; prices move with rates",
    status: "Available",
    description:
      "A spread of Federal Government bonds across maturities, so income arrives at intervals rather than all at once.",
    disclosure:
      "Bond prices move inversely to interest rates. Capital is at risk if sold before maturity.",
  },
  {
    id: "ip_balanced",
    name: "Balanced Mutual Fund",
    assetClass: "Mutual fund",
    manager: ASSET_MANAGER,
    band: "Balanced",
    indicativeYieldPct: 21.6,
    yieldBasis: "trailing 12-month total return, net of fund fees",
    horizon: "3 years or more",
    minimumAmount: 25_000,
    liquidity: "Redeem in 3 business days",
    status: "Available",
    description:
      "A professionally managed mix of fixed income and equities for people who want growth without picking instruments.",
    disclosure:
      "Returns are not guaranteed and the value of units can fall. Past performance does not guarantee future results.",
  },
  {
    id: "ip_equity",
    name: "Nigerian Equity Fund",
    assetClass: "Equity fund",
    manager: ASSET_MANAGER,
    band: "Growth",
    indicativeYieldPct: 27.8,
    yieldBasis: "trailing 12-month total return, net of fund fees",
    horizon: "5 years or more",
    minimumAmount: 25_000,
    liquidity: "Redeem in 3 business days",
    status: "Available",
    description:
      "Listed Nigerian companies held through a managed fund. Values move up and down, sometimes sharply.",
    disclosure:
      "Equity values fluctuate and you may get back less than you invested. Suitable only for longer horizons.",
  },
  {
    id: "ip_equities",
    name: "Listed Equities (direct)",
    assetClass: "Listed equities",
    manager: ASSET_MANAGER,
    band: "Growth",
    horizon: "5 years or more",
    minimumAmount: 50_000,
    liquidity: "Exchange trading days",
    status: "Pending approval",
    description:
      "Direct access to shares listed on the Nigerian Exchange, placed through the licensed dealing partner.",
    disclosure:
      "Not yet available. Launch remains subject to regulatory approval and a completed suitability assessment.",
  },
  {
    id: "ip_managed",
    name: "Managed Portfolio (discretionary)",
    assetClass: "Managed portfolio",
    manager: ASSET_MANAGER,
    band: "Balanced",
    indicativeYieldPct: 22.4,
    yieldBasis: "trailing 12-month composite return, net of management fees",
    horizon: "3 years or more",
    minimumAmount: 1_000_000,
    liquidity: "Monthly redemption window",
    status: "Pending approval",
    description:
      "A mandate managed on your behalf against an agreed risk profile, with quarterly reporting.",
    disclosure:
      "Not yet available. Offered only after a suitability assessment and subject to regulatory approval.",
  },
];

export const suitabilityQuestions: SuitabilityQuestion[] = [
  {
    id: "sq_horizon",
    question: "When would you most likely need this money back?",
    options: [
      { value: "short", label: "Within the next year", score: 1 },
      { value: "medium", label: "In one to three years", score: 2 },
      { value: "long", label: "In more than three years", score: 3 },
    ],
  },
  {
    id: "sq_buffer",
    question: "If an unexpected bill landed tomorrow, what would you do?",
    options: [
      { value: "bridge", label: "Bridge some of my earned pay", score: 1 },
      { value: "savings", label: "Use my savings cushion", score: 2 },
      { value: "either", label: "I have enough set aside either way", score: 3 },
    ],
  },
  {
    id: "sq_movement",
    question: "Your investment falls 10% in a month. What feels right?",
    options: [
      { value: "exit", label: "Move it somewhere steadier", score: 1 },
      { value: "hold", label: "Leave it and wait", score: 2 },
      { value: "add", label: "Add more while prices are lower", score: 3 },
    ],
  },
  {
    id: "sq_experience",
    question: "How much investing have you done before?",
    options: [
      { value: "none", label: "This would be my first time", score: 1 },
      { value: "some", label: "Savings products and funds", score: 2 },
      { value: "lots", label: "Funds, bonds and shares", score: 3 },
    ],
  },
  {
    id: "sq_share",
    question: "What share of your monthly salary could you invest without strain?",
    options: [
      { value: "small", label: "Under 5%", score: 1 },
      { value: "mid", label: "Between 5% and 15%", score: 2 },
      { value: "large", label: "More than 15%", score: 3 },
    ],
  },
];

export const employeeHoldings: Holding[] = [
  {
    id: "hd_1",
    productId: "ip_mmf",
    productName: "PayBridge Money Market Fund",
    assetClass: "Money market fund",
    manager: ASSET_MANAGER,
    band: "Conservative",
    contributed: 60_000,
    value: 64_820,
    asOf: iso(-1, 17, 30),
  },
  {
    id: "hd_2",
    productId: "ip_balanced",
    productName: "Balanced Mutual Fund",
    assetClass: "Mutual fund",
    manager: ASSET_MANAGER,
    band: "Balanced",
    contributed: 40_000,
    value: 43_150,
    asOf: iso(-1, 17, 30),
  },
];

/* ---------------------------------------------------- Grow: insights & plans */

export const wellbeingPillars: PillarScore[] = [
  {
    pillar: "Bridge",
    score: 74,
    summary: "You bridge less than most people on your salary band, and always before the 15th.",
  },
  {
    pillar: "Save",
    score: 58,
    summary: "You save every payday, but your cushion covers about 9 days of expenses.",
  },
  {
    pillar: "Invest",
    score: 46,
    summary: "You hold two funds. Nothing is set aside on a schedule yet.",
  },
  {
    pillar: "Grow",
    score: 67,
    summary: "You've finished two of five short lessons and set one plan.",
  },
];

export const wellbeingInsights: WellbeingInsight[] = [
  {
    id: "wi_1",
    pillar: "Bridge",
    title: "Your money gets tight around the 12th",
    body: "Three of your last four Bridge requests came between the 10th and the 14th, and each one was close to ₦20,000. That looks like one recurring bill rather than day-to-day spending.",
    observedAt: iso(-2, 9, 0),
  },
  {
    id: "wi_2",
    pillar: "Save",
    title: "Your savings habit is steady",
    body: "You have set aside something on each of the last six paydays. That consistency is the single strongest signal in your wellbeing score.",
    observedAt: iso(-4, 9, 0),
  },
  {
    id: "wi_3",
    pillar: "Grow",
    title: "Fees are falling",
    body: "You paid ₦2,050 in Bridge service fees over the last three months, down from ₦3,600 in the three months before.",
    observedAt: iso(-6, 9, 0),
  },
];

export const recommendations: Recommendation[] = [
  {
    id: "rc_1",
    pillar: "Save",
    title: "A ₦20,000 cushion could replace your usual mid-month Bridge",
    body: "Setting aside 5% of each payday would build that cushion in about two months. After that, the bill around the 12th could come from your own buffer instead of an early Bridge.",
    impact: "Around ₦6,000 of service fees saved over a year, and no mid-month decision to make.",
    actionLabel: "Set up the cushion",
    actionTo: "/employee/savings",
    reducesBridgeUse: true,
    dismissed: false,
  },
  {
    id: "rc_2",
    pillar: "Invest",
    title: "Your idle savings could sit in a money market fund instead",
    body: "About ₦96,000 in your Rent fund is not needed for five months. Held in a money market fund it would stay accessible while working harder than a flexible balance.",
    impact: "Better use of money you already have. Yields vary and are not guaranteed.",
    actionLabel: "Look at the fund",
    actionTo: "/employee/invest",
    reducesBridgeUse: false,
    dismissed: false,
  },
  {
    id: "rc_3",
    pillar: "Bridge",
    title: "Bridge a little less than the maximum",
    body: "You have left an average of ₦31,000 available each month. Keeping some of your earned pay unbridged is what stops the following month starting tight.",
    impact: "A calmer start to each new salary cycle.",
    actionLabel: "See how your month flows",
    actionTo: "/employee/grow",
    reducesBridgeUse: true,
    dismissed: false,
  },
  {
    id: "rc_4",
    pillar: "Grow",
    title: "Finish 'Planning around one payday'",
    body: "You are halfway through the eight-minute lesson on mapping bills to a single payday. People who finish it bridge about a fifth less in the following quarter.",
    impact: "A clearer plan for the two weeks after payday.",
    actionLabel: "Continue the lesson",
    actionTo: "/employee/grow",
    reducesBridgeUse: true,
    dismissed: false,
  },
];

export const learningModules: LearningModule[] = [
  {
    id: "lm_1",
    title: "Why payday feels like a finish line",
    category: "Money and the mind",
    minutes: 5,
    summary: "How monthly pay cycles create pressure, and why that is a structural problem rather than a personal failing.",
    takeaway: "Pressure peaks in week one. Planning for that week removes most of it.",
    progressPct: 100,
  },
  {
    id: "lm_2",
    title: "Planning around one payday",
    category: "Planning",
    minutes: 8,
    summary: "Map every fixed bill to the date it lands, then match it to the pay you will have by then.",
    takeaway: "Two thirds of mid-month gaps come from three predictable bills.",
    progressPct: 50,
  },
  {
    id: "lm_3",
    title: "Building a cushion that actually holds",
    category: "Saving",
    minutes: 6,
    summary: "Why a small automatic amount beats a large intention, and where to keep the money.",
    takeaway: "Nine days of cover is the point where most people stop needing early access.",
    progressPct: 100,
  },
  {
    id: "lm_4",
    title: "What a money market fund really is",
    category: "Investing",
    minutes: 7,
    summary: "Plain-language explanation of short-dated instruments, yields, fees and what can go wrong.",
    takeaway: "Yields move. Access and purpose matter more than chasing the highest number.",
    progressPct: 0,
  },
  {
    id: "lm_5",
    title: "Deciding between saving and investing",
    category: "Investing",
    minutes: 6,
    summary: "How to split money by when you will need it, before thinking about returns at all.",
    takeaway: "Money needed within a year does not belong in an equity fund.",
    progressPct: 0,
  },
];

/** Bridge amounts over the last six months — the number PayBridge wants to fall. */
export const employeeBridgeTrend = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((label, i) => ({
  label,
  value: [42_500, 38_000, 35_000, 30_000, 25_000, 20_000][i],
  secondary: [4_000, 6_500, 9_000, 12_000, 14_500, 18_000][i],
}));
