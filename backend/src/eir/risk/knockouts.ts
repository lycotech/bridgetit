/**
 * KNOCKOUT ENGINE — deterministic, no AI.
 *
 * The specification is explicit: an employer must not be approved on total score
 * alone. This module is what enforces that. It runs every enabled rule in the
 * active policy version against the assembled evidence and returns, for each
 * one, whether it fired and what that means.
 *
 * THREE PROPERTIES THAT MATTER MORE THAN THE RULES THEMSELVES:
 *
 *  1. EVERY rule is recorded, including the ones that passed. A file that shows
 *     "14 rules evaluated, 14 passed" is auditable evidence that the screen ran.
 *     A file that only stores failures is indistinguishable from a file where the
 *     engine never executed, which is exactly the question a regulator asks.
 *
 *  2. A rule that fires is NEVER silently absorbed. It produces a consequence —
 *     blocked, enhanced due diligence, committee referral or decline — and the
 *     decision service refuses to write an approval while any blocking
 *     consequence stands. That refusal lives in code, not in a procedure note.
 *
 *  3. Non-overridable means non-overridable. There is no role, no seniority and
 *     no dual-approval path that clears a confirmed sanctions match. The override
 *     API rejects it rather than the UI hiding the button, because a control that
 *     depends on the front end is not a control.
 */

import type { CreditPolicy, KnockoutConsequence, KnockoutRule } from "./policy";

/* ------------------------------------------------------------------- INPUTS */

/**
 * Everything the rules read, assembled by the caller from the module results.
 *
 * Flat and primitive on purpose: the knockout engine must be trivially testable
 * and must not be able to reach back into the database, where a lazy join could
 * change a rule's answer depending on what happened to be loaded.
 */
export interface KnockoutContext {
  /* From the compliance module. */
  sanctionsConfirmed: boolean;
  sanctionsPotential: boolean;
  sanctionsNotScreened: boolean;
  consentMissing: boolean;
  insolvencyProceedings: boolean;
  licenceRequired: boolean;
  licenceLapsed: boolean;
  /** Set by a Compliance Officer only. Credit staff cannot set this. */
  complianceCleared: boolean;

  /* From the identity module. */
  identityUnverifiable: boolean;
  /** A reviewer marked a document forged, altered or belonging to another entity. */
  falseDocumentationFound: boolean;

  /* From case management. */
  openFraudFlag: boolean;

  /* From the payroll module. */
  missedPayrollCycles: number;
  payrollBankMismatchCycles: number;
  verifiedPayrollMonths: number;

  /* From the data service and bureau adapter. */
  undisclosedBorrowingFound: boolean;
  bureauSeriousDelinquency: boolean;
  bureauWrittenOffFacility: boolean;

  /* From the employer profile. */
  industry: string | null;
  industryProhibited: boolean;
}

/** An override already recorded against this application. */
export interface KnockoutOverrideInput {
  ruleKey: string;
  approvedBy: string;
  approvedByRole: string;
  approvedAt: Date;
  reason: string;
  secondApproverId: string | null;
}

/* ------------------------------------------------------------------ OUTPUTS */

export interface KnockoutOutcome {
  ruleKey: string;
  label: string;
  /** True where the condition is present in the evidence. */
  triggered: boolean;
  consequence: KnockoutConsequence | null;
  overridable: boolean;
  overrideRole: string | null;
  overrideDualApproval: boolean;
  /** True where a valid override is in force, neutralising the consequence. */
  overridden: boolean;
  /** Present where an override was attempted but is not valid. */
  overrideRejectedReason: string | null;
  /** The specific evidence that fired the rule, or why it passed. */
  evidence: string;
  description: string;
}

export interface KnockoutSummary {
  policyVersion: string;
  evaluations: KnockoutOutcome[];
  /** Rules that fired and are not overridden. */
  active: KnockoutOutcome[];
  triggeredCount: number;
  overriddenCount: number;
  /** No decision of any kind may be recorded while true. */
  blocked: boolean;
  /** Decline is the mandated outcome. */
  declineMandated: boolean;
  /** Must go to the Credit Committee irrespective of exposure. */
  committeeReferralRequired: boolean;
  /** Enhanced due diligence must complete before a decision. */
  enhancedDueDiligenceRequired: boolean;
  /** Convenience for the UI banner. */
  worstConsequence: KnockoutConsequence | null;
  /** Plain-language list for the credit memorandum. */
  reasons: string[];
}

/* ---------------------------------------------------------------- SEVERITY */

/*
 * Ordering for "worst consequence". `blocked` outranks `decline` because a block
 * means the file cannot be adjudicated at all — declining an employer we are not
 * permitted to process would itself be a decision taken without lawful basis.
 */
const SEVERITY: Record<KnockoutConsequence, number> = {
  blocked: 4,
  decline: 3,
  committee_referral: 2,
  enhanced_due_diligence: 1,
};

/* ----------------------------------------------------------------- MATCHING */

/** Returns the triggering evidence string, or null where the rule passes. */
function evaluateRule(rule: KnockoutRule, ctx: KnockoutContext, policy: CreditPolicy): string | null {
  switch (rule.key) {
    case "sanctions_failed":
      return ctx.sanctionsConfirmed ? "A confirmed sanctions match is recorded against the entity or a related person." : null;

    case "identity_unverifiable":
      return ctx.identityUnverifiable
        ? "Neither the corporate register nor an accepted incorporation document establishes this entity."
        : null;

    case "false_documentation":
      return ctx.falseDocumentationFound
        ? "A reviewer recorded a submitted document as forged, altered or belonging to another entity."
        : null;

    case "missing_consent":
      return ctx.consentMissing ? "No current, versioned consent is on file for verification, credit checks or monitoring." : null;

    case "insolvency_proceedings":
      return ctx.insolvencyProceedings
        ? "Insolvency, winding-up or receivership proceedings are recorded against the entity."
        : null;

    case "unresolved_fraud_flag":
      return ctx.openFraudFlag ? "An open fraud investigation or flag is recorded against this employer." : null;

    case "undisclosed_borrowing":
      return ctx.undisclosedBorrowingFound
        ? "Bureau or bank evidence shows credit obligations the employer did not declare."
        : null;

    case "repeated_salary_non_payment":
      return ctx.missedPayrollCycles >= 2
        ? `${ctx.missedPayrollCycles} payroll cycles in the observed history have no evidenced payment.`
        : null;

    case "payroll_bank_inconsistent":
      return ctx.payrollBankMismatchCycles > 0
        ? `${ctx.payrollBankMismatchCycles} payroll cycle${ctx.payrollBankMismatchCycles === 1 ? "" : "s"} claim payments the bank statement does not corroborate.`
        : null;

    case "prohibited_industry":
      return ctx.industryProhibited
        ? `The employer operates in ${ctx.industry ?? "a sector"}, which PayBridge policy excludes.`
        : null;

    case "regulatory_status_unacceptable":
      return ctx.licenceRequired && ctx.licenceLapsed
        ? "A licence required to operate is expired, suspended or has not been sighted."
        : null;

    case "materially_adverse_bureau":
      if (ctx.bureauWrittenOffFacility) return "Bureau data shows a written-off facility.";
      if (ctx.bureauSeriousDelinquency) return "Bureau data shows serious delinquency on an existing obligation.";
      return null;

    case "insufficient_payroll_history":
      return ctx.verifiedPayrollMonths < policy.portfolioCaps.minPayrollMonths
        ? `${ctx.verifiedPayrollMonths} verified payroll cycle${ctx.verifiedPayrollMonths === 1 ? "" : "s"} against a policy minimum of ${policy.portfolioCaps.minPayrollMonths}.`
        : null;

    case "compliance_clearance_missing":
      return !ctx.complianceCleared ? "A Compliance Officer has not recorded clearance for this employer." : null;

    default:
      /*
       * An unrecognised rule key means the policy was extended without the
       * engine being taught to evaluate it. Failing open would let an
       * administrator add a rule that quietly never fires, so it fires and says
       * why instead — visible, and safe in the direction that matters.
       */
      return `Rule "${rule.key}" is configured in the active policy but has no evaluator. Referred for manual assessment.`;
  }
}

/** Human-readable "why this passed", for the audit record. */
function passEvidence(rule: KnockoutRule, ctx: KnockoutContext, policy: CreditPolicy): string {
  switch (rule.key) {
    case "sanctions_failed":
      return ctx.sanctionsPotential
        ? "No confirmed match. A potential match is under adjudication and is reported separately."
        : ctx.sanctionsNotScreened
          ? "No confirmed match, but screening is incomplete or stale — the compliance score reflects this."
          : "All subjects screened clear within the validity window.";
    case "identity_unverifiable":
      return "The entity is established by register confirmation or an accepted incorporation document.";
    case "false_documentation":
      return "No document has been recorded as false or altered.";
    case "missing_consent":
      return "Current versioned consent is on file.";
    case "insolvency_proceedings":
      return "No insolvency proceedings identified.";
    case "unresolved_fraud_flag":
      return "No open fraud flag.";
    case "undisclosed_borrowing":
      return "No undeclared credit obligations identified.";
    case "repeated_salary_non_payment":
      return ctx.missedPayrollCycles === 1
        ? "One missed cycle, below the two-cycle rule threshold. Recorded as a payroll finding rather than a knockout."
        : "No missed payroll cycles in the observed history.";
    case "payroll_bank_inconsistent":
      return "Payroll files reconcile to bank evidence.";
    case "prohibited_industry":
      return `${ctx.industry ?? "The stated sector"} is not on the exclusion list.`;
    case "regulatory_status_unacceptable":
      return ctx.licenceRequired ? "The required sector licence is current." : "No sector licence is required.";
    case "materially_adverse_bureau":
      return "No written-off facility or serious delinquency in bureau data.";
    case "insufficient_payroll_history":
      return `${ctx.verifiedPayrollMonths} verified payroll cycles, meeting the policy minimum of ${policy.portfolioCaps.minPayrollMonths}.`;
    case "compliance_clearance_missing":
      return "Compliance clearance recorded by a Compliance Officer.";
    default:
      return "Passed.";
  }
}

/* --------------------------------------------------------------- THE ENGINE */

export function evaluateKnockouts(
  ctx: KnockoutContext,
  policy: CreditPolicy,
  overrides: KnockoutOverrideInput[] = [],
): KnockoutSummary {
  const overrideByKey = new Map(overrides.map((o) => [o.ruleKey, o]));
  const evaluations: KnockoutOutcome[] = [];

  for (const rule of policy.knockoutRules) {
    if (!rule.enabled) continue;

    const trigger = evaluateRule(rule, ctx, policy);
    const triggered = trigger !== null;
    const override = overrideByKey.get(rule.key);

    let overridden = false;
    let overrideRejectedReason: string | null = null;

    if (triggered && override) {
      if (!rule.overridable) {
        /*
         * Belt and braces. The override API refuses to create these, but if one
         * ever exists — a migration, a direct database edit, a bug — the engine
         * declines to honour it rather than trusting the stored row.
         */
        overrideRejectedReason = `"${rule.label}" is non-overridable. The recorded override has no effect and should be investigated.`;
      } else if (rule.overrideDualApproval && !override.secondApproverId) {
        overrideRejectedReason = "This override requires a second authoriser and only one approval is recorded.";
      } else if (rule.overrideRole && override.approvedByRole !== rule.overrideRole && override.approvedByRole !== "super_admin") {
        overrideRejectedReason = `This override may only be granted by ${rule.overrideRole}; it was recorded by ${override.approvedByRole}.`;
      } else if (!override.reason.trim()) {
        overrideRejectedReason = "An override must carry a documented reason.";
      } else {
        overridden = true;
      }
    }

    evaluations.push({
      ruleKey: rule.key,
      label: rule.label,
      triggered,
      consequence: triggered ? rule.consequence : null,
      overridable: rule.overridable,
      overrideRole: rule.overrideRole ?? null,
      overrideDualApproval: rule.overrideDualApproval,
      overridden,
      overrideRejectedReason,
      evidence: trigger ?? passEvidence(rule, ctx, policy),
      description: rule.description,
    });
  }

  const active = evaluations.filter((e) => e.triggered && !e.overridden);

  const worstConsequence =
    active.length === 0
      ? null
      : active
          .map((e) => e.consequence as KnockoutConsequence)
          .reduce((worst, c) => (SEVERITY[c] > SEVERITY[worst] ? c : worst));

  const summary: KnockoutSummary = {
    policyVersion: policy.version,
    evaluations,
    active,
    triggeredCount: evaluations.filter((e) => e.triggered).length,
    overriddenCount: evaluations.filter((e) => e.overridden).length,
    blocked: active.some((e) => e.consequence === "blocked"),
    declineMandated: active.some((e) => e.consequence === "decline"),
    committeeReferralRequired: active.some((e) => e.consequence === "committee_referral"),
    enhancedDueDiligenceRequired: active.some((e) => e.consequence === "enhanced_due_diligence"),
    worstConsequence,
    reasons: active.map((e) => `${e.label}: ${e.evidence}`),
  };

  return summary;
}

/**
 * Whether an override is permitted BEFORE one is written.
 *
 * The route layer calls this; `evaluateKnockouts` then re-checks the stored row.
 * Two checks of the same condition at different layers is deliberate: the first
 * gives the user a clear error, the second guarantees the rule holds even if the
 * first is ever bypassed.
 */
export function overridePermitted(
  rule: KnockoutRule,
  actorRole: string,
  hasSecondApprover: boolean,
): { permitted: boolean; reason: string } {
  if (!rule.overridable) {
    return {
      permitted: false,
      reason: `"${rule.label}" cannot be overridden by any user at any authority level. Resolve the underlying finding instead.`,
    };
  }
  if (rule.overrideRole && actorRole !== rule.overrideRole && actorRole !== "super_admin") {
    return {
      permitted: false,
      reason: `Only ${rule.overrideRole} may override "${rule.label}".`,
    };
  }
  if (rule.overrideDualApproval && !hasSecondApprover) {
    return {
      permitted: false,
      reason: `Overriding "${rule.label}" requires a second authoriser.`,
    };
  }
  return { permitted: true, reason: "" };
}

/** Everything an approval is waiting on, for the workflow banner. */
export function blockingReasons(summary: KnockoutSummary): string[] {
  return summary.active
    .filter((e) => e.consequence === "blocked" || e.consequence === "decline")
    .map((e) => `${e.label} — ${e.evidence}`);
}
