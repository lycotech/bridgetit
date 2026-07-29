/**
 * COMPLIANCE MODULE — deterministic, no AI.
 *
 * Two jobs, and it is important they stay separate.
 *
 *  1. Produce a Compliance Score from 0 to 100 for the composite.
 *  2. Report the BINARY facts the knockout engine needs — a sanctions hit is not
 *     a score input, it is a stop. Averaging a sanctions match into a weighted
 *     total would let a strong payroll record buy it down, which is precisely
 *     the failure mode that ends in a regulatory finding.
 *
 * UNVERIFIED NEGATIVE NEWS DOES NOT COUNT. The specification is explicit that
 * negative news must not be treated as fact. This module therefore reads
 * external intelligence rows ONLY where a risk analyst has validated them
 * (`analystValidation === "confirmed"` and `affectsScore === true`). Unvalidated
 * items are surfaced to the analyst as work to do and are visible in the file,
 * but they cannot move a number. An AI summary of a news article has no standing
 * here at all.
 */

import type { Classification } from "./policy";

/* ------------------------------------------------------------------- INPUTS */

export const SCREENING_RESULTS = ["clear", "potential_match", "confirmed_match", "not_screened"] as const;
export type ScreeningResult = (typeof SCREENING_RESULTS)[number];

export interface ScreeningInput {
  /** Who or what was screened — entity name or director name, for the audit trail. */
  subject: string;
  kind: "entity" | "director" | "beneficial_owner";
  sanctions: ScreeningResult;
  pep: ScreeningResult;
  /** Screening date; a stale screen is treated as not screened. */
  screenedAt: Date | null;
}

/** Only analyst-validated external findings reach this module. */
export interface ValidatedFindingInput {
  category: string;
  severity: "low" | "medium" | "high";
  summary: string;
  validatedAt: Date;
}

export interface ComplianceInput {
  screenings: ScreeningInput[];

  /** Tax clearance / filing status as evidenced, not as declared. */
  taxFilingsCurrent: boolean | null;
  taxArrearsDeclared: boolean;
  /** Pension remittance evidence for the recent period. */
  pensionCompliant: boolean | null;
  /** Statutory returns to the corporate registry filed up to date. */
  annualReturnsCurrent: boolean | null;

  licenceRequired: boolean;
  licenceCurrent: boolean | null;
  licenceExpiryDate: Date | null;

  /** Litigation and enforcement recorded against the entity. */
  materialLitigationCount: number;
  enforcementActionCount: number;
  insolvencyProceedings: boolean;

  /** Consent and data-protection posture. */
  consentCurrent: boolean;
  consentWordingVersion: string | null;
  employeeDataConsentBasis: string | null;

  /** Analyst-validated adverse findings only. */
  validatedFindings: ValidatedFindingInput[];
  /** Count of unvalidated external items, reported but never scored. */
  unvalidatedFindings: number;

  /** AML programme questions where the employer is itself a regulated entity. */
  amlQuestionnaireComplete: boolean | null;
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface ComplianceCheckRow {
  key: string;
  label: string;
  status: "pass" | "attention" | "fail" | "not_assessed" | "not_applicable";
  detail: string;
  /** Points applied to the base. Zero for items that only inform. */
  points: number;
}

export interface ComplianceResult {
  score: number;
  classification: Classification;
  checks: ComplianceCheckRow[];
  /* Binary outputs consumed by the knockout engine. Never averaged. */
  sanctionsConfirmed: boolean;
  sanctionsPotential: boolean;
  sanctionsNotScreened: boolean;
  pepPresent: boolean;
  insolvencyProceedings: boolean;
  consentMissing: boolean;
  licenceLapsed: boolean;
  /** Items an analyst must clear before the file can progress. */
  outstandingForAnalyst: string[];
  unvalidatedFindingCount: number;
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
  explanation: string;
}

/* ------------------------------------------------------------------ HELPERS */

const SCREENING_VALIDITY_DAYS = 90;

function screeningStale(screenedAt: Date | null): boolean {
  if (screenedAt === null) return true;
  return (Date.now() - screenedAt.getTime()) / 86_400_000 > SCREENING_VALIDITY_DAYS;
}

/**
 * A stale screen is downgraded to `not_screened`.
 *
 * A sanctions check from eighteen months ago is not evidence about today's
 * lists, which change weekly. Carrying an old "clear" forward as current is how
 * a list addition gets missed, so the module refuses to count it and asks for a
 * re-screen instead.
 */
function effective(result: ScreeningResult, screenedAt: Date | null): ScreeningResult {
  if (result === "not_screened") return "not_screened";
  if (screeningStale(screenedAt)) return "not_screened";
  return result;
}

/* --------------------------------------------------------------- THE ENGINE */

/**
 * Compliance starts from 100 and is reduced by findings, the inverse of the
 * behavioural module.
 *
 * The reason is that compliance is a set of obligations that are either met or
 * not. There is no way to be better than compliant, so there is nothing to earn
 * upward — an employer that has filed everything, screened clear and holds a
 * current licence has a perfect compliance posture and should read as 100.
 */
export function assessCompliance(input: ComplianceInput): ComplianceResult {
  const checks: ComplianceCheckRow[] = [];
  const outstandingForAnalyst: string[] = [];

  const check = (
    key: string,
    label: string,
    status: ComplianceCheckRow["status"],
    detail: string,
    points = 0,
  ) => {
    checks.push({ key, label, status, detail, points });
  };

  /* -------------------------------------------------------- Screening ----- */

  const screened = input.screenings.map((s) => ({
    ...s,
    sanctionsEffective: effective(s.sanctions, s.screenedAt),
    pepEffective: effective(s.pep, s.screenedAt),
  }));

  const sanctionsConfirmed = screened.some((s) => s.sanctionsEffective === "confirmed_match");
  const sanctionsPotential = screened.some((s) => s.sanctionsEffective === "potential_match");
  const unscreened = screened.filter((s) => s.sanctionsEffective === "not_screened");
  const sanctionsNotScreened = screened.length === 0 || unscreened.length > 0;
  const pepPresent = screened.some(
    (s) => s.pepEffective === "confirmed_match" || s.pepEffective === "potential_match",
  );

  if (sanctionsConfirmed) {
    const hits = screened.filter((s) => s.sanctionsEffective === "confirmed_match").map((s) => s.subject);
    check(
      "sanctions",
      "Sanctions screening",
      "fail",
      `Confirmed sanctions match against ${hits.join(", ")}. This is a non-overridable stop.`,
      -100,
    );
    outstandingForAnalyst.push("Escalate the confirmed sanctions match to the Compliance Officer immediately.");
  } else if (sanctionsPotential) {
    const hits = screened.filter((s) => s.sanctionsEffective === "potential_match").map((s) => s.subject);
    check(
      "sanctions",
      "Sanctions screening",
      "attention",
      `Potential sanctions match requiring adjudication: ${hits.join(", ")}. Not treated as confirmed.`,
      -25,
    );
    outstandingForAnalyst.push("Adjudicate the potential sanctions match and record the conclusion with evidence.");
  } else if (sanctionsNotScreened) {
    check(
      "sanctions",
      "Sanctions screening",
      "not_assessed",
      screened.length === 0
        ? "No sanctions screening has been performed."
        : `Screening missing or older than ${SCREENING_VALIDITY_DAYS} days for: ${unscreened.map((s) => s.subject).join(", ")}.`,
      -30,
    );
    outstandingForAnalyst.push("Complete sanctions screening for the entity, all directors and all beneficial owners.");
  } else {
    check(
      "sanctions",
      "Sanctions screening",
      "pass",
      `${screened.length} subject${screened.length === 1 ? "" : "s"} screened clear within the last ${SCREENING_VALIDITY_DAYS} days.`,
    );
  }

  if (pepPresent) {
    const peps = screened
      .filter((s) => s.pepEffective === "confirmed_match" || s.pepEffective === "potential_match")
      .map((s) => s.subject);
    /*
     * A PEP is not adverse. It is a requirement to apply enhanced due diligence,
     * and the small deduction reflects the additional control burden rather than
     * any implication of wrongdoing.
     */
    check(
      "pep",
      "Politically exposed persons",
      "attention",
      `Politically exposed person identified: ${peps.join(", ")}. Enhanced due diligence applies; this is not itself an adverse finding.`,
      -5,
    );
    outstandingForAnalyst.push("Complete enhanced due diligence and source-of-wealth review for the identified PEP.");
  } else {
    check("pep", "Politically exposed persons", "pass", "No politically exposed persons identified.");
  }

  /* --------------------------------------------------------- Statutory ---- */

  if (input.taxFilingsCurrent === true) {
    check("tax_filings", "Tax filings", "pass", "Tax filings evidenced as current.");
  } else if (input.taxFilingsCurrent === false) {
    check("tax_filings", "Tax filings", "fail", "Tax filings are not current.", -15);
    outstandingForAnalyst.push("Obtain an explanation and remediation plan for outstanding tax filings.");
  } else {
    check("tax_filings", "Tax filings", "not_assessed", "Tax filing status has not been evidenced.", -8);
    outstandingForAnalyst.push("Obtain evidence of tax filing status (tax clearance certificate or filing receipts).");
  }

  if (input.taxArrearsDeclared) {
    check("tax_arrears", "Tax arrears", "attention", "The employer has declared outstanding tax arrears.", -10);
  }

  if (input.pensionCompliant === true) {
    check("pension", "Pension remittance", "pass", "Pension remittances evidenced for the recent period.");
  } else if (input.pensionCompliant === false) {
    /*
     * Weighted heavily for a payroll product. Unremitted pension is money
     * deducted from employees and not passed on, which is both a statutory
     * breach and a reliable early sign of a liquidity squeeze being managed by
     * withholding employee obligations.
     */
    check(
      "pension",
      "Pension remittance",
      "fail",
      "Pension deductions are not being remitted. Treated as both a statutory breach and a liquidity warning.",
      -20,
    );
    outstandingForAnalyst.push("Quantify the unremitted pension liability and confirm the remediation timetable.");
  } else {
    check("pension", "Pension remittance", "not_assessed", "Pension remittance has not been evidenced.", -8);
    outstandingForAnalyst.push("Obtain pension remittance schedules for the last six months.");
  }

  if (input.annualReturnsCurrent === true) {
    check("annual_returns", "Statutory annual returns", "pass", "Annual returns filed up to date.");
  } else if (input.annualReturnsCurrent === false) {
    check("annual_returns", "Statutory annual returns", "attention", "Annual returns are outstanding.", -8);
  } else {
    check("annual_returns", "Statutory annual returns", "not_assessed", "Annual return status not established.", -4);
  }

  /* ----------------------------------------------------------- Licence ---- */

  let licenceLapsed = false;
  if (!input.licenceRequired) {
    check("licence", "Sector licence", "not_applicable", "No sector licence is required for this industry.");
  } else if (input.licenceCurrent === true) {
    const expiring =
      input.licenceExpiryDate !== null &&
      (input.licenceExpiryDate.getTime() - Date.now()) / 86_400_000 < 60;
    check(
      "licence",
      "Sector licence",
      expiring ? "attention" : "pass",
      expiring
        ? `Licence is current but expires on ${input.licenceExpiryDate?.toISOString().slice(0, 10)}. Renewal should be a monitoring condition.`
        : "Sector licence current.",
      expiring ? -3 : 0,
    );
  } else if (input.licenceCurrent === false) {
    licenceLapsed = true;
    check("licence", "Sector licence", "fail", "A required sector licence is not current.", -25);
    outstandingForAnalyst.push("Obtain the current sector licence or confirm the entity is lawfully trading without it.");
  } else {
    licenceLapsed = true;
    check("licence", "Sector licence", "not_assessed", "A sector licence is required and has not been sighted.", -15);
    outstandingForAnalyst.push("Sight and record the required sector licence.");
  }

  /* ------------------------------------------- Litigation and insolvency -- */

  if (input.insolvencyProceedings) {
    check(
      "insolvency",
      "Insolvency proceedings",
      "fail",
      "Insolvency, winding-up or receivership proceedings are recorded. This is a non-overridable stop.",
      -100,
    );
  } else {
    check("insolvency", "Insolvency proceedings", "pass", "No insolvency proceedings identified.");
  }

  if (input.enforcementActionCount > 0) {
    check(
      "enforcement",
      "Regulatory enforcement",
      "fail",
      `${input.enforcementActionCount} regulatory enforcement action${input.enforcementActionCount === 1 ? "" : "s"} recorded.`,
      -12 * input.enforcementActionCount,
    );
    outstandingForAnalyst.push("Review each regulatory enforcement action and assess whether it affects repayment capacity.");
  }

  if (input.materialLitigationCount > 0) {
    check(
      "litigation",
      "Material litigation",
      "attention",
      `${input.materialLitigationCount} material matter${input.materialLitigationCount === 1 ? "" : "s"} recorded. Quantum and stage must be assessed.`,
      -5 * input.materialLitigationCount,
    );
    outstandingForAnalyst.push("Assess the quantum, stage and likely outcome of recorded litigation.");
  }

  /* ------------------------------------------------- Consent and privacy -- */

  const consentMissing = !input.consentCurrent;
  if (consentMissing) {
    check(
      "consent",
      "Data and credit-check consent",
      "fail",
      "There is no current, versioned consent on file. No data processing, screening or bureau enquiry may proceed. Non-overridable.",
      -100,
    );
  } else {
    check(
      "consent",
      "Data and credit-check consent",
      "pass",
      `Current consent recorded${input.consentWordingVersion ? ` against wording version ${input.consentWordingVersion}` : ""}.`,
    );
  }

  if (input.employeeDataConsentBasis) {
    check(
      "employee_data_basis",
      "Employee data lawful basis",
      "pass",
      `Employee data is processed on the basis: ${input.employeeDataConsentBasis}.`,
    );
  } else {
    check(
      "employee_data_basis",
      "Employee data lawful basis",
      "not_assessed",
      "The lawful basis for processing employee payroll data has not been recorded.",
      -10,
    );
    outstandingForAnalyst.push(
      "Record the lawful basis for processing employee payroll data under the Nigeria Data Protection Act.",
    );
  }

  if (input.amlQuestionnaireComplete === false) {
    check("aml_questionnaire", "AML programme questionnaire", "attention", "The AML questionnaire is incomplete.", -6);
    outstandingForAnalyst.push("Complete the AML programme questionnaire for this regulated employer.");
  } else if (input.amlQuestionnaireComplete === true) {
    check("aml_questionnaire", "AML programme questionnaire", "pass", "AML programme questionnaire completed.");
  }

  /* ------------------------------------- Analyst-validated adverse news --- */

  for (const finding of input.validatedFindings) {
    const points = finding.severity === "high" ? -20 : finding.severity === "medium" ? -10 : -4;
    check(
      `validated_${finding.category}`,
      `Validated finding: ${finding.category}`,
      finding.severity === "high" ? "fail" : "attention",
      `${finding.summary} (validated by a risk analyst on ${finding.validatedAt.toISOString().slice(0, 10)}).`,
      points,
    );
  }

  if (input.unvalidatedFindings > 0) {
    /*
     * Zero points, by design. These are recorded and shown so nothing is hidden
     * from the reviewer, but an unverified press mention cannot move a score.
     */
    check(
      "unvalidated_intelligence",
      "Unvalidated external intelligence",
      "not_assessed",
      `${input.unvalidatedFindings} external item${input.unvalidatedFindings === 1 ? "" : "s"} await analyst verification. These do not affect the score until verified.`,
      0,
    );
    outstandingForAnalyst.push(
      `Verify ${input.unvalidatedFindings} external intelligence item${input.unvalidatedFindings === 1 ? "" : "s"} and record whether each is material.`,
    );
  }

  /* ------------------------------------------------------------- Scoring --- */

  const deductions = checks.reduce((sum, c) => sum + c.points, 0);
  const score = Math.max(0, Math.min(100, 100 + deductions));

  const classification: Classification =
    sanctionsConfirmed || input.insolvencyProceedings || consentMissing
      ? "critical"
      : score >= 90
        ? "strong"
        : score >= 75
          ? "acceptable"
          : score >= 60
            ? "watch"
            : score >= 40
              ? "weak"
              : "critical";

  /* ------------------------------------------------------------ Factors --- */

  const factors: ComplianceResult["factors"] = [];

  const failures = checks.filter((c) => c.status === "fail");
  const attention = checks.filter((c) => c.status === "attention");
  const passes = checks.filter((c) => c.status === "pass");

  for (const c of failures) {
    factors.push({ factor: c.label, effect: "negative", detail: c.detail });
  }
  for (const c of attention.slice(0, 4)) {
    factors.push({ factor: c.label, effect: "neutral", detail: c.detail });
  }
  if (failures.length === 0 && attention.length === 0) {
    factors.push({
      factor: "Clean compliance posture",
      effect: "positive",
      detail: `All ${passes.length} compliance checks passed with current evidence.`,
    });
  }

  const explanation = `Starts at 100 and is reduced by recorded findings: ${failures.length} failure${failures.length === 1 ? "" : "s"}, ${attention.length} item${attention.length === 1 ? "" : "s"} requiring attention, ${checks.filter((c) => c.status === "not_assessed").length} not yet assessed. Unvalidated external intelligence is reported but never scored.`;

  return {
    score,
    classification,
    checks,
    sanctionsConfirmed,
    sanctionsPotential,
    sanctionsNotScreened,
    pepPresent,
    insolvencyProceedings: input.insolvencyProceedings,
    consentMissing,
    licenceLapsed,
    outstandingForAnalyst,
    unvalidatedFindingCount: input.unvalidatedFindings,
    factors,
    explanation,
  };
}
