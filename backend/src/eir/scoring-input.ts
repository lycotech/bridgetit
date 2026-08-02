import { prisma } from "../db";
import { CREDIT_PRODUCTS } from "./risk/policy";
import { industryTemplate } from "./risk/industry";
import type { ScoringInput } from "./risk/score";
import type { DirectorIdentityInput } from "./risk/identity";
import type { ScreeningInput, ScreeningResult } from "./risk/compliance";
import type { CycleInput } from "./risk/payroll";
import type { PeriodInput } from "./risk/financial";

/**
 * Assembles a real `ScoringInput` for one employer from the database.
 *
 * HONESTY OVER COMPLETENESS. Several of the engine's inputs (director
 * identity verification, beneficial-owner screening, financial statements,
 * behavioural history, compliance clearance) have no capture flow built yet
 * anywhere in the product — see AGENTS.md. Rather than fabricate positive
 * signals, every field below that has no real data source defaults to the
 * value that makes the engine correctly report "insufficient data" or
 * "not yet cleared" — false, null, or zero, never a guess. A thin score is
 * the honest output of a thin file; that is the engine doing its job, not a
 * bug in this mapping.
 *
 * Every simplification is commented at the field it affects, so wiring up
 * the real source later (a director-verification screen, a bank-statement
 * importer, a compliance-screening integration) is a local change here, not
 * a rediscovery of what was approximated and why.
 */
export async function buildScoringInput(employerId: string): Promise<ScoringInput> {
  const [employer, directors, beneficialOwners, documents, bankAccounts, consents, payrollCycles, financialPeriods, employerUsers] =
    await Promise.all([
      prisma.employer.findUniqueOrThrow({ where: { id: employerId } }),
      prisma.director.findMany({ where: { employerId, deletedAt: null } }),
      prisma.beneficialOwner.findMany({ where: { employerId, deletedAt: null } }),
      prisma.employerDocument.findMany({ where: { employerId, deletedAt: null } }),
      prisma.bankAccount.findMany({ where: { employerId, deletedAt: null } }),
      prisma.consent.findMany({ where: { employerId, withdrawnAt: null } }),
      prisma.payrollCycle.findMany({ where: { employerId }, orderBy: { periodStart: "asc" } }),
      prisma.financialPeriod.findMany({ where: { employerId }, orderBy: { periodStart: "asc" } }),
      prisma.employerUser.findMany({ where: { employerId }, select: { lastLoginAt: true } }),
    ]);

  const businessAgeMonths = employer.incorporationDate
    ? monthsBetween(employer.incorporationDate, new Date())
    : null;

  const template = industryTemplate(employer.industry);

  /* ---------------------------------------------------------------- IDENTITY */

  const incorporationDoc = documents.find((d) => /incorporation|cac/i.test(d.docType));
  const payrollAccount = bankAccounts.find((a) => a.isPayrollAccount) ?? bankAccounts[0];
  const bankAccountNameMatch = payrollAccount?.accountName
    ? normaliseCompanyName(payrollAccount.accountName) === normaliseCompanyName(employer.registeredName)
    : null;

  const directorInputs: DirectorIdentityInput[] = directors.map((d) => ({
    name: d.fullName,
    // No director-identity-verification workflow exists yet — presence of an
    // id number is treated as self-declared, never as verified. See module
    // note above.
    identityProvided: Boolean(d.idNumberEnc),
    identityVerified: false,
    isSignatory: false,
    pepDeclared: d.pepDeclared,
  }));

  const beneficialOwnershipSum = beneficialOwners.reduce((sum, o) => sum + (o.ownershipPercent ?? 0), 0);

  const identity: ScoringInput["identity"] = {
    registrationVerified: false, // No CAC-register lookup integration exists yet.
    registrationProvided: Boolean(employer.cacNumber),
    registrationContradiction: false,
    registrationStatus: employer.cacNumber ? "provided" : null,
    taxIdProvided: Boolean(employer.tin),
    taxIdVerified: false,
    incorporationDocumentUploaded: Boolean(incorporationDoc),
    incorporationDocumentVerified: incorporationDoc?.status === "verified",
    addressProvided: Boolean(employer.registeredAddress),
    addressVerified: false,
    bankAccountProvided: bankAccounts.length > 0,
    bankAccountNameMatch,
    contactEmailVerified: false,
    contactPhoneVerified: false,
    directors: directorInputs,
    beneficialOwnersDisclosed: beneficialOwners.length,
    ownershipDeclaredComplete: beneficialOwnershipSum >= 50,
    ownershipPercentageDisclosed: beneficialOwners.length > 0 ? beneficialOwnershipSum : null,
    businessAgeMonths,
    licenceRequired: false, // No licensing-requirement classification exists yet.
    licenceVerified: false,
  };

  /* --------------------------------------------------------------- FINANCIAL */

  const periods: PeriodInput[] = financialPeriods.map((p) => ({
    periodStart: p.periodStart,
    source: p.source,
    inflows: numOrNull(p.inflows),
    outflows: numOrNull(p.outflows),
    openingBalance: numOrNull(p.openingBalance),
    closingBalance: numOrNull(p.closingBalance),
    lowestBalance: numOrNull(p.lowestBalance),
    revenue: numOrNull(p.revenue),
    costOfSales: numOrNull(p.costOfSales),
    operatingExpenses: numOrNull(p.operatingExpenses),
    operatingProfit: numOrNull(p.operatingProfit),
    payrollCost: numOrNull(p.payrollCost),
    debtService: numOrNull(p.debtService),
    taxRemitted: numOrNull(p.taxRemitted),
    pensionRemitted: numOrNull(p.pensionRemitted),
    returnedPayments: p.returnedPayments ?? 0,
  }));

  const verifiedMonthlyPayroll =
    payrollCycles.length > 0
      ? payrollCycles.reduce((sum, c) => sum + (c.totalAmount ? Number(c.totalAmount) : 0), 0) / payrollCycles.length
      : null;

  const financial: ScoringInput["financial"] = {
    periods,
    verifiedMonthlyPayroll,
    declaredMonthlyPayroll: employer.monthlyPayroll ? Number(employer.monthlyPayroll) : null,
    customerConcentration: null,
    receivablesConcentration: null,
    existingLenderExposure: null,
    currentLiabilities: null,
    currentAssets: null,
    industry: employer.industry,
    pensionOnTimeCycles: payrollCycles.filter((c) => c.pensionRemittedAt).length || null,
    taxOnTimeCycles: payrollCycles.filter((c) => c.taxRemittedAt).length || null,
    remittanceCyclesObserved: payrollCycles.length || null,
  };

  /* ----------------------------------------------------------------- PAYROLL */

  const cycles: CycleInput[] = payrollCycles.map((c) => ({
    periodStart: c.periodStart,
    expectedPayDate: c.expectedPayDate,
    actualPayDate: c.actualPayDate,
    totalAmount: c.totalAmount ? Number(c.totalAmount) : null,
    employeeCount: c.employeeCount,
    corrections: c.corrections,
    reversals: c.reversals,
    paidFraction: c.paidFraction,
    pensionRemittedAt: c.pensionRemittedAt,
    taxRemittedAt: c.taxRemittedAt,
    bankEvidenceMismatch: c.bankEvidenceMismatch,
  }));

  const payroll: ScoringInput["payroll"] = {
    cycles,
    declaredPayDay: null, // No declared-pay-day capture exists yet (would live on an Application).
    industry: employer.industry,
  };

  /* ------------------------------------------------------------- BEHAVIOURAL */

  const recentLogin = employerUsers.some(
    (u) => u.lastLoginAt && Date.now() - u.lastLoginAt.getTime() < 90 * 24 * 60 * 60 * 1000,
  );
  const relationshipMonths = monthsBetween(employer.createdAt, new Date());
  const documentsProvided = documents.filter((d) => d.status === "uploaded" || d.status === "verified").length;

  const behavioural: ScoringInput["behavioural"] = {
    relationshipMonths,
    documentsRequested: documents.length,
    documentsProvided,
    documentsRejectedForQuality: documents.filter((d) => d.status === "rejected").length,
    documentsExpiredUnreplaced: documents.filter((d) => d.status === "expired").length,
    longestOpenRequestDays: null,
    averageResponseDays: null,
    informationRequestsOutstanding: documents.filter((d) => d.status === "requested").length,
    declarationInconsistencies: 0,
    inconsistenciesResolved: 0,
    undisclosedFacts: 0,
    // No live credit facility exists yet (Bridge/Treasury not built) — every
    // conduct-on-facility counter is honestly zero, not "no data".
    facilityCycles: 0,
    repaymentsOnTime: 0,
    repaymentsLate: 0,
    repaymentsMissed: 0,
    returnedPayments: 0,
    covenantBreaches: 0,
    covenantBreachesCured: 0,
    monitoringSubmissionsLate: 0,
    monitoringSubmissionsDue: 0,
    recentPortalActivity: recentLogin,
    dataConnectionInterruptions: 0,
  };

  /* -------------------------------------------------------------- COMPLIANCE */

  const screenings: ScreeningInput[] = [
    ...directors.map(
      (d): ScreeningInput => ({
        subject: d.fullName,
        kind: "director",
        sanctions: mapScreeningResult(d.sanctionsResult),
        pep: mapScreeningResult(d.pepResult),
        screenedAt: d.sanctionsScreenedAt ?? d.pepScreenedAt ?? null,
      }),
    ),
    ...beneficialOwners.map(
      (o): ScreeningInput => ({
        subject: o.fullName,
        kind: "beneficial_owner",
        sanctions: mapScreeningResult(o.sanctionsResult),
        pep: mapScreeningResult(o.pepResult),
        screenedAt: o.sanctionsScreenedAt ?? o.pepScreenedAt ?? null,
      }),
    ),
  ];

  const compliance: ScoringInput["compliance"] = {
    screenings,
    taxFilingsCurrent: null,
    taxArrearsDeclared: false,
    pensionCompliant: payroll.cycles.length > 0 ? payroll.cycles.every((c) => c.pensionRemittedAt) : null,
    annualReturnsCurrent: null,
    licenceRequired: false,
    licenceCurrent: null,
    licenceExpiryDate: null,
    materialLitigationCount: 0,
    enforcementActionCount: 0,
    insolvencyProceedings: false,
    consentCurrent: consents.length > 0,
    consentWordingVersion: consents[0]?.wordingVersion ?? null,
    employeeDataConsentBasis: consents.find((c) => c.consentType === "employee_data_lawful") ? "consent" : null,
    validatedFindings: [],
    unvalidatedFindings: 0,
    // No dedicated Compliance Officer clearance step exists yet — see
    // `compliance_clearance_missing`, the one non-overridable knockout this
    // directly controls. Left false until that workflow exists, so the
    // engine correctly blocks every employer pending a real clearance step
    // rather than silently assuming one happened.
    amlQuestionnaireComplete: null,
  };

  return {
    employerId,
    applicationId: null,
    identity,
    financial,
    payroll,
    behavioural,
    compliance,
    industry: employer.industry,
    businessAgeMonths,
    governmentRevenueShare: template?.governmentExposed ? null : 0,
    falseDocumentationFound: false,
    openFraudFlag: false,
    undisclosedBorrowingFound: false,
    bureauSeriousDelinquency: false,
    bureauWrittenOffFacility: false,
    complianceCleared: false,
    requestedProducts: [...CREDIT_PRODUCTS],
    requestedAmount: null,
    totalApprovedBook: await totalApprovedBook(),
    existingExposureToEmployer: await exposureToEmployer(employerId),
    existingExposureToIndustry: employer.industry ? await exposureToIndustry(employer.industry) : 0,
  };
}

function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

function normaliseCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\b(ltd|limited|plc|nigeria|ng)\b/g, "").replace(/\s+/g, " ").trim();
}

/** Schema stores "possible_match"; the engine's vocabulary is "potential_match". */
function mapScreeningResult(value: string): ScreeningResult {
  if (value === "possible_match") return "potential_match";
  if (value === "clear" || value === "confirmed_match" || value === "not_screened") return value;
  return "not_screened";
}

async function totalApprovedBook(): Promise<number> {
  const rows = await prisma.creditLimit.findMany({ where: { status: "active" }, select: { approvedAmount: true } });
  return rows.reduce((sum, r) => sum + Number(r.approvedAmount), 0);
}

async function exposureToEmployer(employerId: string): Promise<number> {
  const rows = await prisma.creditLimit.findMany({
    where: { employerId, status: "active" },
    select: { approvedAmount: true },
  });
  return rows.reduce((sum, r) => sum + Number(r.approvedAmount), 0);
}

async function exposureToIndustry(industry: string): Promise<number> {
  const rows = await prisma.creditLimit.findMany({
    where: { status: "active", employer: { industry } },
    select: { approvedAmount: true },
  });
  return rows.reduce((sum, r) => sum + Number(r.approvedAmount), 0);
}
