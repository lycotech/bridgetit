/**
 * CREDIT WORKFLOW STATE MACHINE — deterministic, no AI.
 *
 * The specification defines a fourteen-stage assessment workflow ending in
 * continuous monitoring. This module is the single authority on which stage an
 * application may move to next, who may move it, and what must be true first.
 *
 * WHY A STATE MACHINE RATHER THAN A STATUS COLUMN AND SOME BUTTONS. A status
 * column plus per-screen checks means the rules live in however many places
 * happen to write to it, and the fifteenth screen forgets one. Here every
 * transition is declared in one table with its own preconditions and permitted
 * roles, so "can this application be approved yet" has exactly one answer,
 * computed the same way for the API, the UI and the audit trail.
 *
 * THE ONE RULE THAT MATTERS MOST. `approval` cannot be entered while a blocking
 * knockout stands, and the AI assessment stage is NOT a precondition of anything.
 * An application can reach approval with no AI assessment at all — the analyst
 * simply does the reading themselves. The reverse is deliberately impossible:
 * there is no transition anywhere in this table that an AI service can trigger.
 */

/* -------------------------------------------------------------------- STAGES */

export const STAGES = [
  "draft",
  "submitted",
  "completeness_review",
  "identity_verification",
  "compliance_review",
  "financial_analysis",
  "payroll_analysis",
  "ai_assessment",
  "scoring",
  "proposed_terms",
  "analyst_recommendation",
  "approval",
  "offer_issued",
  "documentation",
  "activation",
  "monitoring",
  /* Terminal states, reachable from several points. */
  "declined",
  "withdrawn",
  "deferred",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  draft: "Draft",
  submitted: "Submitted",
  completeness_review: "Completeness review",
  identity_verification: "Identity verification",
  compliance_review: "Compliance review",
  financial_analysis: "Financial analysis",
  payroll_analysis: "Payroll analysis",
  ai_assessment: "Intelligence assessment",
  scoring: "Scoring",
  proposed_terms: "Proposed terms",
  analyst_recommendation: "Analyst recommendation",
  approval: "Approval",
  offer_issued: "Offer issued",
  documentation: "Documentation",
  activation: "Activation",
  monitoring: "Continuous monitoring",
  declined: "Declined",
  withdrawn: "Withdrawn",
  deferred: "Deferred",
};

/** What the stage is for, shown to the employer and in the workflow rail. */
export const STAGE_DESCRIPTIONS: Record<Stage, string> = {
  draft: "The employer is completing onboarding. Nothing is visible to the credit team yet.",
  submitted: "Submitted for assessment. Awaiting a completeness check.",
  completeness_review: "Checking that every mandatory document and data file is present and legible.",
  identity_verification: "Confirming the entity, its directors and its beneficial owners.",
  compliance_review: "Sanctions, PEP, licence, statutory and consent checks by a Compliance Officer.",
  financial_analysis: "Bank statements and financial statements normalised and ratios calculated.",
  payroll_analysis: "Payroll history reconciled against bank evidence and reliability assessed.",
  ai_assessment: "The PayBridge Employer Intelligence Analyst prepares advisory context for the analyst. Optional.",
  scoring: "Deterministic scoring, tiering and knockout evaluation under the active policy version.",
  proposed_terms: "The limit engine's recommended products, limits, pricing and conditions.",
  analyst_recommendation: "The risk analyst's written recommendation, with reasons.",
  approval: "Decision by the authorised approver or the Credit Committee.",
  offer_issued: "Terms issued to the employer for acceptance.",
  documentation: "Agreements, mandates and any required security completed.",
  activation: "Limits activated and the programme opened to employees.",
  monitoring: "Live. Continuously monitored against covenants and early-warning triggers.",
  declined: "Declined. The reasons and the policy version are recorded on the file.",
  withdrawn: "Withdrawn by the employer or closed by PayBridge without a decision.",
  deferred: "Deferred pending further information or a future review date.",
};

/** The stages that make up the assessment rail, in order, for progress display. */
export const RAIL: Stage[] = STAGES.filter(
  (s) => s !== "declined" && s !== "withdrawn" && s !== "deferred",
) as Stage[];

export function stageIndex(stage: Stage): number {
  return RAIL.indexOf(stage);
}

export function isTerminal(stage: Stage): boolean {
  return stage === "declined" || stage === "withdrawn";
}

/* --------------------------------------------------------------- CONDITIONS */

/**
 * Everything a transition can be gated on.
 *
 * Assembled by the route layer from the database and the score snapshot. The
 * state machine does no I/O for the same reason the scoring engine does none: a
 * transition decision must be reproducible from a recorded set of facts.
 */
export interface WorkflowContext {
  /* Onboarding completeness. */
  profileComplete: boolean;
  ownershipComplete: boolean;
  productRequestComplete: boolean;
  mandatoryDocumentsUploaded: boolean;
  mandatoryDocumentsVerified: boolean;
  payrollDataLoaded: boolean;
  bankDataLoaded: boolean;
  consentsGranted: boolean;

  /* Reviews. */
  identityVerificationComplete: boolean;
  complianceCleared: boolean;
  complianceReviewedBy: string | null;
  financialAnalysisComplete: boolean;
  payrollAnalysisComplete: boolean;

  /* Score state. */
  scoreCalculated: boolean;
  scorePolicyVersion: string | null;
  limitsProposed: boolean;
  analystRecommendationRecorded: boolean;

  /* Knockouts. */
  blocked: boolean;
  declineMandated: boolean;
  enhancedDueDiligenceRequired: boolean;
  enhancedDueDiligenceComplete: boolean;
  committeeReferralRequired: boolean;

  /* Approval state. */
  decisionRecorded: boolean;
  decisionOutcome: string | null;
  requiredApprovals: number;
  approvalsRecorded: number;
  committeeQuorumMet: boolean;

  /* Post-approval. */
  offerAccepted: boolean;
  documentationComplete: boolean;
  limitsActivated: boolean;
}

export interface Transition {
  from: Stage;
  to: Stage;
  /** Verb shown on the button. */
  action: string;
  /** Roles permitted to make this transition. Super Administrator is implicit. */
  roles: string[];
  /** Each returns null when satisfied, or the reason it is not. */
  requires: (ctx: WorkflowContext) => string[];
  /** True where the transition moves backwards deliberately, e.g. to request info. */
  isReturn?: boolean;
}

/* ------------------------------------------------------------------ HELPERS */

const need = (condition: boolean, message: string): string[] => (condition ? [] : [message]);

/* ------------------------------------------------------------ TRANSITIONS */

/*
 * Roles map to the eight EIR roles. `super_admin` is omitted from every list
 * because it is permitted everywhere — enumerating it fourteen times invites the
 * mistake of leaving it out once and creating a stage only a Super Admin cannot
 * pass.
 */
export const TRANSITIONS: Transition[] = [
  {
    from: "draft",
    to: "submitted",
    action: "Submit application",
    roles: ["employer_admin", "relationship_manager"],
    requires: (ctx) => [
      ...need(ctx.profileComplete, "The corporate profile is incomplete."),
      ...need(ctx.ownershipComplete, "Ownership and management details are incomplete."),
      ...need(ctx.productRequestComplete, "The product request has not been completed."),
      ...need(ctx.mandatoryDocumentsUploaded, "One or more mandatory documents have not been uploaded."),
      ...need(
        ctx.consentsGranted,
        "All required consents must be granted before the application can be submitted.",
      ),
    ],
  },
  {
    from: "submitted",
    to: "completeness_review",
    action: "Begin completeness review",
    roles: ["credit_administrator", "risk_analyst", "relationship_manager"],
    requires: () => [],
  },
  {
    from: "completeness_review",
    to: "identity_verification",
    action: "Confirm complete, begin identity verification",
    roles: ["credit_administrator", "risk_analyst"],
    requires: (ctx) => [
      ...need(ctx.mandatoryDocumentsUploaded, "Mandatory documents are still outstanding."),
      ...need(ctx.payrollDataLoaded, "No payroll data has been loaded."),
      ...need(ctx.bankDataLoaded, "No bank statement data has been loaded."),
    ],
  },
  {
    from: "completeness_review",
    to: "draft",
    action: "Return to employer for more information",
    roles: ["credit_administrator", "risk_analyst", "relationship_manager"],
    requires: () => [],
    isReturn: true,
  },
  {
    from: "identity_verification",
    to: "compliance_review",
    action: "Confirm identity, refer to compliance",
    roles: ["credit_administrator", "risk_analyst"],
    requires: (ctx) => [
      ...need(
        ctx.identityVerificationComplete,
        "Entity, director and beneficial-owner verification is not complete.",
      ),
      ...need(ctx.mandatoryDocumentsVerified, "Mandatory documents have not all been verified by a reviewer."),
    ],
  },
  {
    /*
     * Compliance clearance can only be given by a Compliance Officer. Credit
     * staff are absent from this list on purpose — the specification requires
     * compliance to be an independent gate, and the corresponding knockout rule
     * (`compliance_clearance_missing`) is non-overridable so it cannot be routed
     * around at the approval stage either.
     */
    from: "compliance_review",
    to: "financial_analysis",
    action: "Record compliance clearance",
    roles: ["compliance_officer"],
    requires: (ctx) => [
      ...need(ctx.complianceCleared, "Compliance clearance has not been recorded."),
      ...need(
        ctx.complianceReviewedBy !== null,
        "The clearing Compliance Officer must be recorded against the review.",
      ),
    ],
  },
  {
    from: "compliance_review",
    to: "declined",
    action: "Decline on compliance grounds",
    roles: ["compliance_officer"],
    requires: () => [],
  },
  {
    from: "financial_analysis",
    to: "payroll_analysis",
    action: "Complete financial analysis",
    roles: ["risk_analyst", "credit_administrator"],
    requires: (ctx) => need(ctx.financialAnalysisComplete, "Financial analysis has not been completed and signed off."),
  },
  {
    from: "payroll_analysis",
    to: "ai_assessment",
    action: "Request intelligence assessment",
    roles: ["risk_analyst", "credit_administrator"],
    requires: (ctx) => need(ctx.payrollAnalysisComplete, "Payroll analysis has not been completed."),
  },
  {
    /*
     * The AI stage is skippable. This transition exists so a file can go straight
     * from payroll analysis to scoring, which keeps the AI genuinely optional
     * rather than a formality everyone clicks through.
     */
    from: "payroll_analysis",
    to: "scoring",
    action: "Skip intelligence assessment and score",
    roles: ["risk_analyst", "credit_administrator"],
    requires: (ctx) => need(ctx.payrollAnalysisComplete, "Payroll analysis has not been completed."),
  },
  {
    from: "ai_assessment",
    to: "scoring",
    action: "Calculate score",
    roles: ["risk_analyst", "credit_administrator"],
    requires: () => [],
  },
  {
    from: "scoring",
    to: "proposed_terms",
    action: "Generate proposed terms",
    roles: ["risk_analyst", "credit_administrator"],
    requires: (ctx) => [
      ...need(ctx.scoreCalculated, "No score has been calculated."),
      ...need(
        ctx.scorePolicyVersion !== null,
        "The score must record the policy version it was calculated under.",
      ),
      ...need(
        !ctx.declineMandated,
        "A knockout rule mandates decline. The file must be declined rather than priced.",
      ),
      ...need(!ctx.blocked, "A blocking knockout rule is in force. Resolve it before proposing terms."),
    ],
  },
  {
    from: "scoring",
    to: "declined",
    action: "Decline",
    roles: ["credit_administrator", "risk_analyst", "compliance_officer"],
    requires: () => [],
  },
  {
    from: "proposed_terms",
    to: "analyst_recommendation",
    action: "Record recommendation",
    roles: ["risk_analyst"],
    requires: (ctx) => need(ctx.limitsProposed, "No limit recommendation has been generated."),
  },
  {
    from: "analyst_recommendation",
    to: "approval",
    action: "Refer for approval",
    roles: ["risk_analyst", "credit_administrator"],
    requires: (ctx) => [
      ...need(ctx.analystRecommendationRecorded, "The analyst recommendation has not been recorded."),
      ...need(!ctx.blocked, "A blocking knockout rule is in force. Approval cannot be sought."),
      ...need(
        !ctx.enhancedDueDiligenceRequired || ctx.enhancedDueDiligenceComplete,
        "Enhanced due diligence is required and has not been completed and documented.",
      ),
    ],
  },
  {
    from: "analyst_recommendation",
    to: "deferred",
    action: "Defer",
    roles: ["risk_analyst", "credit_administrator"],
    requires: () => [],
  },
  {
    from: "approval",
    to: "offer_issued",
    action: "Issue offer",
    roles: ["credit_administrator", "relationship_manager"],
    requires: (ctx) => [
      ...need(ctx.decisionRecorded, "No decision has been recorded."),
      ...need(
        ctx.decisionOutcome === "approved" ||
          ctx.decisionOutcome === "approved_with_conditions" ||
          ctx.decisionOutcome === "pilot_approved",
        "Only an approved, conditionally approved or pilot-approved decision can proceed to offer.",
      ),
      ...need(
        ctx.approvalsRecorded >= ctx.requiredApprovals,
        `${ctx.requiredApprovals} approval(s) are required and ${ctx.approvalsRecorded} have been recorded.`,
      ),
      ...need(
        !ctx.committeeReferralRequired || ctx.committeeQuorumMet,
        "Credit Committee quorum and majority have not been met.",
      ),
      ...need(!ctx.blocked, "A blocking knockout rule is in force."),
    ],
  },
  {
    from: "approval",
    to: "declined",
    action: "Decline",
    roles: ["credit_administrator", "credit_committee_member"],
    requires: (ctx) => need(ctx.decisionRecorded, "The decline decision and its reasons must be recorded first."),
  },
  {
    from: "approval",
    to: "deferred",
    action: "Defer or request more information",
    roles: ["credit_administrator", "credit_committee_member"],
    requires: () => [],
  },
  {
    from: "offer_issued",
    to: "documentation",
    action: "Record offer acceptance",
    roles: ["credit_administrator", "relationship_manager"],
    requires: (ctx) => need(ctx.offerAccepted, "The employer has not accepted the offer."),
  },
  {
    from: "offer_issued",
    to: "withdrawn",
    action: "Record withdrawal",
    roles: ["credit_administrator", "relationship_manager"],
    requires: () => [],
  },
  {
    from: "documentation",
    to: "activation",
    action: "Complete documentation",
    roles: ["credit_administrator"],
    requires: (ctx) => need(ctx.documentationComplete, "Agreements, mandates or security remain outstanding."),
  },
  {
    from: "activation",
    to: "monitoring",
    action: "Activate and begin monitoring",
    roles: ["credit_administrator"],
    requires: (ctx) => need(ctx.limitsActivated, "Limits have not been activated."),
  },
  {
    from: "deferred",
    to: "completeness_review",
    action: "Reopen assessment",
    roles: ["credit_administrator", "risk_analyst", "relationship_manager"],
    requires: () => [],
  },
];

/* ----------------------------------------------------------------- QUERIES */

export interface AvailableTransition {
  to: Stage;
  toLabel: string;
  action: string;
  /** True where the caller's role and the preconditions both allow it now. */
  permitted: boolean;
  /** Present when the role is wrong. */
  roleBlocked: boolean;
  /** Unmet preconditions, in the order they should be resolved. */
  blockers: string[];
  isReturn: boolean;
}

/** Everything reachable from this stage, with the reason each is or is not open. */
export function availableTransitions(
  stage: Stage,
  ctx: WorkflowContext,
  role: string,
): AvailableTransition[] {
  return TRANSITIONS.filter((t) => t.from === stage).map((t) => {
    const roleAllowed = role === "super_admin" || t.roles.includes(role);
    const blockers = t.requires(ctx);
    return {
      to: t.to,
      toLabel: STAGE_LABELS[t.to],
      action: t.action,
      permitted: roleAllowed && blockers.length === 0,
      roleBlocked: !roleAllowed,
      blockers,
      isReturn: t.isReturn ?? false,
    };
  });
}

/**
 * The authoritative check the API calls before writing a stage change.
 *
 * Returns a discriminated result rather than throwing, so the route can turn a
 * refusal into a 409 with the exact list of what is outstanding — which is far
 * more useful to a credit administrator than "invalid transition".
 */
export function canTransition(
  from: Stage,
  to: Stage,
  ctx: WorkflowContext,
  role: string,
): { allowed: true } | { allowed: false; code: string; message: string; blockers: string[] } {
  if (isTerminal(from)) {
    return {
      allowed: false,
      code: "STAGE_TERMINAL",
      message: `This application is ${STAGE_LABELS[from].toLowerCase()} and cannot be moved.`,
      blockers: [],
    };
  }

  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) {
    return {
      allowed: false,
      code: "TRANSITION_NOT_DEFINED",
      message: `An application at "${STAGE_LABELS[from]}" cannot move directly to "${STAGE_LABELS[to]}".`,
      blockers: [],
    };
  }

  if (role !== "super_admin" && !transition.roles.includes(role)) {
    return {
      allowed: false,
      code: "ROLE_NOT_PERMITTED",
      message: `"${transition.action}" is restricted to: ${transition.roles.join(", ")}.`,
      blockers: [],
    };
  }

  const blockers = transition.requires(ctx);
  if (blockers.length > 0) {
    return {
      allowed: false,
      code: "PRECONDITIONS_NOT_MET",
      message: `"${transition.action}" cannot be completed yet.`,
      blockers,
    };
  }

  return { allowed: true };
}

/** Progress percentage along the assessment rail, for the employer's view. */
export function progressPercent(stage: Stage): number {
  if (stage === "declined" || stage === "withdrawn") return 100;
  if (stage === "deferred") return 50;
  const index = stageIndex(stage);
  if (index < 0) return 0;
  return Math.round(((index + 1) / RAIL.length) * 100);
}

/** Decision outcomes the specification requires at the approval stage. */
export const DECISION_OUTCOMES = [
  "approved",
  "approved_with_conditions",
  "pilot_approved",
  "deferred",
  "more_information_required",
  "referred_to_committee",
  "declined",
] as const;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

export const DECISION_OUTCOME_LABELS: Record<DecisionOutcome, string> = {
  approved: "Approve",
  approved_with_conditions: "Approve with conditions",
  pilot_approved: "Pilot approval",
  deferred: "Defer",
  more_information_required: "Request more information",
  referred_to_committee: "Refer to Credit Committee",
  declined: "Decline",
};

/** Outcomes that create live exposure and therefore require full authority. */
export const APPROVING_OUTCOMES: DecisionOutcome[] = [
  "approved",
  "approved_with_conditions",
  "pilot_approved",
];
