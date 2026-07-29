/**
 * IDENTITY CONFIDENCE MODULE — deterministic, no AI.
 *
 * Answers one question: are we certain this employer is who it says it is, and
 * that the people behind it are real and disclosed? Everything downstream is
 * worthless if this is weak — a perfect payroll record belonging to an entity
 * that cannot be identified is not an asset, it is an unresolved fraud risk.
 *
 * WHY A CHECKLIST AND NOT A RATIO. Financial health is continuous: a cash
 * reserve of 1.9 months is meaningfully different from 2.1. Identity is not.
 * Either the registration number was verified against the register or it was
 * not. Modelling that as a curve would invent precision that does not exist, so
 * this module is a weighted checklist where each item is verified, self-declared,
 * failed or absent, and the score is the proportion of available confidence
 * actually earned.
 *
 * WHAT NEVER LEAVES THIS MODULE. BVN and NIN values are read as verification
 * STATUS only. This module receives booleans and last-4 fragments, never the
 * identifiers themselves, so no route, log line or AI prompt built on its output
 * can leak them. See field-crypto.ts and docs/eir-security.md.
 */

import type { Classification } from "./policy";

/* ------------------------------------------------------------------- SHAPES */

export const CHECK_STATES = ["verified", "self_declared", "failed", "absent", "not_applicable"] as const;
export type CheckState = (typeof CHECK_STATES)[number];

export const CHECK_STATE_LABELS: Record<CheckState, string> = {
  verified: "Verified",
  self_declared: "Self-declared",
  failed: "Failed",
  absent: "Not provided",
  not_applicable: "Not applicable",
};

/** Fraction of an item's weight earned in each state. */
const STATE_CREDIT: Record<CheckState, number> = {
  verified: 1,
  /*
   * A self-declared fact earns a third of the credit, not half. The employer
   * typed it and we have not corroborated it; it is closer to nothing than to
   * evidence. It earns anything at all only because a complete, internally
   * consistent declaration is weak positive information about disclosure.
   */
  self_declared: 0.33,
  /* A failed check earns nothing AND is reported as a finding. */
  failed: 0,
  absent: 0,
  not_applicable: 0,
};

export interface IdentityCheck {
  key: string;
  label: string;
  state: CheckState;
  weight: number;
  /** What was actually checked, in plain language, for the explainability panel. */
  evidence: string;
  /** Set where the item must be resolved before a decision. */
  blocking: boolean;
}

export interface IdentityResult {
  score: number;
  classification: Classification;
  checks: IdentityCheck[];
  verifiedCount: number;
  failedCount: number;
  absentCount: number;
  /** Feeds the knockout evaluation: identity cannot be established at all. */
  identityUnverifiable: boolean;
  /** Feeds the knockout evaluation: a submitted document contradicted a register. */
  contradictionFound: boolean;
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
  explanation: string;
}

/* ------------------------------------------------------------------- INPUTS */

export interface DirectorIdentityInput {
  /** Display name only — used in factor text, never an identifier. */
  name: string;
  /** True where a BVN or NIN was captured and verified. The value itself is never passed. */
  identityVerified: boolean;
  identityProvided: boolean;
  isSignatory: boolean;
  pepDeclared: boolean;
}

export interface IdentityInput {
  /** Registration number present and matched against the corporate register. */
  registrationVerified: boolean;
  registrationProvided: boolean;
  /** Register lookup returned a name/status that contradicts the submission. */
  registrationContradiction: boolean;
  registrationStatus: string | null;

  taxIdProvided: boolean;
  taxIdVerified: boolean;

  /** Certificate of incorporation and status report seen and accepted by a reviewer. */
  incorporationDocumentVerified: boolean;
  incorporationDocumentUploaded: boolean;

  addressProvided: boolean;
  addressVerified: boolean;

  /** Settlement account name matches the registered entity name. */
  bankAccountProvided: boolean;
  bankAccountNameMatch: boolean | null;

  contactEmailVerified: boolean;
  contactPhoneVerified: boolean;

  directors: DirectorIdentityInput[];
  /** Beneficial owners at or above the disclosure threshold, and whether the set is complete. */
  beneficialOwnersDisclosed: number;
  ownershipDeclaredComplete: boolean;
  /** Sum of disclosed shareholding percentages. */
  ownershipPercentageDisclosed: number | null;

  businessAgeMonths: number | null;
  /** A regulated sector requires a licence; null where the sector is unregulated. */
  licenceRequired: boolean;
  licenceVerified: boolean;
}

/* --------------------------------------------------------------- THE ENGINE */

export function assessIdentityConfidence(input: IdentityInput): IdentityResult {
  const checks: IdentityCheck[] = [];

  const add = (
    key: string,
    label: string,
    weight: number,
    state: CheckState,
    evidence: string,
    blocking = false,
  ) => {
    checks.push({ key, label, weight, state, evidence, blocking });
  };

  /* --- The entity itself. Heaviest weights: this is the counterparty. ----- */

  add(
    "corporate_registration",
    "Corporate registration",
    20,
    input.registrationContradiction
      ? "failed"
      : input.registrationVerified
        ? "verified"
        : input.registrationProvided
          ? "self_declared"
          : "absent",
    input.registrationContradiction
      ? "The corporate register returned details that contradict the submitted profile."
      : input.registrationVerified
        ? `Registration number confirmed against the corporate register${input.registrationStatus ? ` with status "${input.registrationStatus}"` : ""}.`
        : input.registrationProvided
          ? "Registration number supplied by the employer but not yet checked against the register."
          : "No registration number supplied.",
    true,
  );

  add(
    "incorporation_document",
    "Certificate of incorporation",
    12,
    input.incorporationDocumentVerified
      ? "verified"
      : input.incorporationDocumentUploaded
        ? "self_declared"
        : "absent",
    input.incorporationDocumentVerified
      ? "Incorporation document uploaded and accepted by a reviewer."
      : input.incorporationDocumentUploaded
        ? "Incorporation document uploaded and awaiting reviewer verification."
        : "Incorporation document not uploaded.",
    true,
  );

  add(
    "tax_identification",
    "Tax identification number",
    10,
    input.taxIdVerified ? "verified" : input.taxIdProvided ? "self_declared" : "absent",
    input.taxIdVerified
      ? "Tax identification number confirmed."
      : input.taxIdProvided
        ? "Tax identification number supplied but not independently confirmed."
        : "No tax identification number supplied.",
  );

  add(
    "registered_address",
    "Registered address",
    8,
    input.addressVerified ? "verified" : input.addressProvided ? "self_declared" : "absent",
    input.addressVerified
      ? "Address corroborated by a utility bill, tenancy evidence or a physical visit."
      : input.addressProvided
        ? "Address supplied but not corroborated."
        : "No registered address supplied.",
  );

  /* --- The settlement account. A name mismatch is a hard finding. -------- */

  add(
    "settlement_account",
    "Settlement account name match",
    12,
    input.bankAccountNameMatch === false
      ? "failed"
      : input.bankAccountNameMatch === true
        ? "verified"
        : input.bankAccountProvided
          ? "self_declared"
          : "absent",
    input.bankAccountNameMatch === false
      ? "The settlement account is held in a name that does not match the registered entity."
      : input.bankAccountNameMatch === true
        ? "Settlement account confirmed to be held in the registered entity name."
        : input.bankAccountProvided
          ? "Settlement account supplied; name match not yet confirmed."
          : "No settlement account supplied.",
    true,
  );

  /* --- The people. --------------------------------------------------------
   * Weighted on the SIGNATORIES first. A non-signatory director with no
   * identity evidence is a disclosure gap; an unverified signatory is the
   * person who can move money, and that is a different order of problem.
   */

  const signatories = input.directors.filter((d) => d.isSignatory);
  const signatoriesVerified = signatories.filter((d) => d.identityVerified).length;
  const directorsVerified = input.directors.filter((d) => d.identityVerified).length;

  add(
    "signatory_identity",
    "Signatory identity verification",
    15,
    input.directors.length === 0
      ? "absent"
      : signatories.length === 0
        ? "absent"
        : signatoriesVerified === signatories.length
          ? "verified"
          : signatoriesVerified > 0
            ? "self_declared"
            : "absent",
    signatories.length === 0
      ? "No authorised signatory has been identified."
      : `${signatoriesVerified} of ${signatories.length} signatories have verified identity records.`,
    true,
  );

  add(
    "director_identity",
    "Director identity verification",
    8,
    input.directors.length === 0
      ? "absent"
      : directorsVerified === input.directors.length
        ? "verified"
        : directorsVerified > 0
          ? "self_declared"
          : "absent",
    input.directors.length === 0
      ? "No directors have been recorded."
      : `${directorsVerified} of ${input.directors.length} directors have verified identity records.`,
  );

  /*
   * Ownership completeness. Disclosed shareholding that does not approach 100%
   * means someone material is missing, which is the classic route to an
   * undisclosed connected party or a sanctioned owner.
   */
  const pct = input.ownershipPercentageDisclosed;
  add(
    "ownership_disclosure",
    "Beneficial ownership disclosure",
    10,
    !input.ownershipDeclaredComplete
      ? "absent"
      : input.beneficialOwnersDisclosed === 0
        ? "absent"
        : pct !== null && pct < 75
          ? "failed"
          : pct !== null && pct >= 95
            ? "verified"
            : "self_declared",
    !input.ownershipDeclaredComplete
      ? "The employer has not confirmed that beneficial ownership disclosure is complete."
      : input.beneficialOwnersDisclosed === 0
        ? "No beneficial owners have been disclosed."
        : pct === null
          ? `${input.beneficialOwnersDisclosed} beneficial owner(s) disclosed without shareholding percentages.`
          : `${input.beneficialOwnersDisclosed} beneficial owner(s) disclosed, covering ${Math.round(pct)}% of shareholding.`,
    true,
  );

  /* --- Contactability and tenure. ---------------------------------------- */

  add(
    "contact_verification",
    "Contact verification",
    5,
    input.contactEmailVerified && input.contactPhoneVerified
      ? "verified"
      : input.contactEmailVerified || input.contactPhoneVerified
        ? "self_declared"
        : "absent",
    `Email ${input.contactEmailVerified ? "verified" : "unverified"}; phone ${input.contactPhoneVerified ? "verified" : "unverified"}.`,
  );

  const age = input.businessAgeMonths;
  add(
    "business_tenure",
    "Business tenure",
    5,
    age === null ? "absent" : age >= 24 ? "verified" : age >= 12 ? "self_declared" : "absent",
    age === null
      ? "Incorporation date not established."
      : `Trading for approximately ${age} month${age === 1 ? "" : "s"} since incorporation.`,
  );

  if (input.licenceRequired) {
    add(
      "regulatory_licence",
      "Sector licence",
      10,
      input.licenceVerified ? "verified" : "absent",
      input.licenceVerified
        ? "Sector licence sighted and recorded as current."
        : "This sector requires a licence and none has been verified.",
      true,
    );
  } else {
    add("regulatory_licence", "Sector licence", 0, "not_applicable", "No sector licence is required for this industry.");
  }

  /* ------------------------------------------------------------- Scoring --- */

  /*
   * Not-applicable items are removed from the denominator rather than scored as
   * zero. Penalising an unregulated employer for the absence of a licence it
   * cannot hold would be a bug that reads as a risk finding.
   */
  const applicable = checks.filter((c) => c.state !== "not_applicable" && c.weight > 0);
  const available = applicable.reduce((sum, c) => sum + c.weight, 0);
  const earned = applicable.reduce((sum, c) => sum + c.weight * STATE_CREDIT[c.state], 0);

  let score = available > 0 ? Math.round((earned / available) * 100) : 0;

  /*
   * A failed check is qualitatively worse than a missing one — it means an
   * assertion was tested and did not hold — so each carries an additional
   * deduction beyond simply earning no credit.
   */
  const failedCount = applicable.filter((c) => c.state === "failed").length;
  score -= failedCount * 12;
  score = Math.max(0, Math.min(100, score));

  const verifiedCount = applicable.filter((c) => c.state === "verified").length;
  const absentCount = applicable.filter((c) => c.state === "absent").length;

  /*
   * Unverifiable identity, for the knockout rule. Deliberately narrow: it is
   * not "identity is weak" but "the entity itself could not be established" —
   * no verified registration AND no accepted incorporation document. That is
   * the only condition under which no amount of senior sign-off should proceed,
   * and it is why the corresponding knockout is non-overridable.
   */
  const identityUnverifiable = !input.registrationVerified && !input.incorporationDocumentVerified;
  const contradictionFound = input.registrationContradiction || input.bankAccountNameMatch === false;

  const classification: Classification = identityUnverifiable
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

  const factors: IdentityResult["factors"] = [];

  if (identityUnverifiable) {
    factors.push({
      factor: "Entity identity not established",
      effect: "negative",
      detail:
        "Neither the corporate register nor an accepted incorporation document confirms this entity. No limit may be set until this is resolved.",
    });
  } else if (input.registrationVerified) {
    factors.push({
      factor: "Registration confirmed",
      effect: "positive",
      detail: `Entity confirmed against the corporate register${input.registrationStatus ? ` (status: ${input.registrationStatus})` : ""}.`,
    });
  }

  if (input.registrationContradiction) {
    factors.push({
      factor: "Register contradicts submission",
      effect: "negative",
      detail: "The corporate register does not agree with the details submitted. Treat as a documentation integrity issue.",
    });
  }
  if (input.bankAccountNameMatch === false) {
    factors.push({
      factor: "Settlement account name mismatch",
      effect: "negative",
      detail:
        "Funds would settle to an account not held in the registered entity name. Resolve before any disbursement is configured.",
    });
  }
  if (signatories.length > 0 && signatoriesVerified === signatories.length) {
    factors.push({
      factor: "Signatories verified",
      effect: "positive",
      detail: `All ${signatories.length} authorised signatories have verified identity records.`,
    });
  } else if (signatories.length > 0) {
    factors.push({
      factor: "Unverified signatories",
      effect: "negative",
      detail: `${signatories.length - signatoriesVerified} of ${signatories.length} authorised signatories lack verified identity records.`,
    });
  }
  if (input.directors.some((d) => d.pepDeclared)) {
    factors.push({
      factor: "Politically exposed person declared",
      effect: "neutral",
      detail:
        "A director or owner is declared as politically exposed. This is not adverse in itself; it routes the file to enhanced due diligence.",
    });
  }
  if (pct !== null && pct < 75 && input.ownershipDeclaredComplete) {
    factors.push({
      factor: "Incomplete ownership disclosure",
      effect: "negative",
      detail: `Only ${Math.round(pct)}% of shareholding is accounted for. A material owner appears to be undisclosed.`,
    });
  }
  if (age !== null && age < 12) {
    factors.push({
      factor: "Short trading history",
      effect: "negative",
      detail: `Approximately ${age} months since incorporation, below the tenure normally expected for an unsecured facility.`,
    });
  }
  if (absentCount > 0) {
    factors.push({
      factor: "Outstanding verification items",
      effect: "neutral",
      detail: `${absentCount} verification item${absentCount === 1 ? " is" : "s are"} still outstanding. Each is recoverable by supplying the evidence.`,
    });
  }

  const explanation = `${verifiedCount} of ${applicable.length} identity checks verified${failedCount > 0 ? `, ${failedCount} failed` : ""}${absentCount > 0 ? `, ${absentCount} outstanding` : ""}. Score is the weighted proportion of available verification confidence that has been earned.`;

  return {
    score,
    classification,
    checks,
    verifiedCount,
    failedCount,
    absentCount,
    identityUnverifiable,
    contradictionFound,
    factors,
    explanation,
  };
}
