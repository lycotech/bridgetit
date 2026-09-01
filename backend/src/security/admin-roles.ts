/**
 * Roles and permissions for the ADMIN PORTAL (/admin).
 *
 * WHY this is a separate file from rbac.ts. `rbac.ts` describes the roles of
 * people who use the PayBridge *product* — employees, employer administrators,
 * investors, and the operations staff who run the platform's day-to-day work.
 * Those roles live inside the customer-facing application.
 *
 * The admin portal is a different system with a different threat model: it
 * reviews identity documents, suspends accounts, creates other administrators
 * and issues demonstration access. Its roles are job functions in a compliance
 * organisation, not product personas. Merging the two lists would mean a change
 * to a customer-facing role could silently widen what someone can do to a KYC
 * case, and reviewing "who can approve KYC" would require reading a file full of
 * payroll permissions.
 *
 * Deny-by-default throughout: an unknown role has no permissions, and an
 * unknown permission is held by nobody. The most common broken-access-control
 * bug in the wild is a lookup miss that evaluates to "allow".
 */

export const ADMIN_ROLES = [
  "super_admin",
  "kyc_reviewer",
  "operations_admin",
  "demo_manager",
  "auditor",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  kyc_reviewer: "KYC Reviewer",
  operations_admin: "Operations Admin",
  demo_manager: "Demo Manager",
  auditor: "Read-only Auditor",
};

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Unrestricted. Can manage administrators and security settings.",
  kyc_reviewer: "Reviews identity documents and approves or rejects verification.",
  operations_admin: "Works registered users and employers. Cannot decide KYC.",
  demo_manager: "Issues and revokes private demonstration invitations only.",
  auditor: "Read-only across the portal, including the audit trail. Changes nothing.",
};

export type AdminPermission =
  /* --- Reading --- */
  | "portal.overview.view"
  | "users.view"
  | "employers.view"
  | "kyc.view"
  | "invitations.view"
  | "admins.view"
  | "audit.view"
  | "security.view"
  /** Read help requests: the message, the contact details, the conversation. */
  | "support.view"
  /**
   * Read a customer's FUNCTIONAL accessibility settings — language, "do not
   * phone me", assisted setup, Listen button.
   *
   * A separate permission from `support.view` because it answers a different
   * question. Reading a ticket tells you what someone asked; reading these tells
   * you how to reach them without making things worse. Only people who actually
   * reply to customers need the second, and every read is logged to
   * SupportAccessLog whether it is permitted or not.
   */
  | "support.accessibility.view"
  /** Read an employer's credit score, knockouts and limit recommendations. */
  | "risk.view"
  /** Read portfolio-wide aggregates — no individual customer detail. */
  | "reports.view"
  /** Read the real investor directory — who they are, real KYC status, real committed capital. */
  | "investors.view"
  /* --- Acting --- */
  /** Approve or reject a KYC submission. The regulated decision. */
  | "kyc.decide"
  /**
   * Record a credit decision (approve/decline) against an employer's score.
   *
   * Separate from `risk.view` for the same reason `kyc.decide` is separate
   * from `kyc.view`: seeing a recommendation and having the authority to act
   * on it are different questions. The engine's own authority matrix
   * (eir/risk/limits.ts resolveAuthority) is a second, independent gate on
   * top of this permission — holding `risk.decide` opens the endpoint;
   * whether THIS decision is within this administrator's exposure authority
   * is checked separately, per decision.
   */
  | "risk.decide"
  /** Suspend or reinstate a customer account. */
  | "users.suspend"
  /** Edit an employer record. */
  | "employers.manage"
  /** Create, resend, extend and revoke demonstration invitations. */
  | "invitations.manage"
  /** Create administrators and change their roles. Super Admin only. */
  | "admins.manage"
  /** Change portal-wide security settings. Super Admin only. */
  | "security.manage"
  /** Reply to a help request, assign it, change its status, record a resolution. */
  | "support.manage"
  /**
   * Flag a customer as vulnerable and escalate the case.
   *
   * Deliberately narrower than `support.manage`. The flag changes how PayBridge
   * treats a person — it is a judgement recorded about them, not a workflow
   * state — so it belongs to whoever is accountable for that judgement, not to
   * everyone who can answer a message.
   */
  | "support.escalate";

/**
 * Every role can see the overview and read the audit trail of its own area.
 *
 * WHY audit.view is in the base rather than reserved: an administrator who
 * cannot see the log of their own actions has no way to notice their account
 * being misused, and hiding the log from the people it records does not protect
 * it — only the absence of an edit path does that.
 */
const BASE: AdminPermission[] = ["portal.overview.view", "audit.view"];

/**
 * Role → permission map. Read this as the answer to "who can do the four
 * things that matter": decide KYC, suspend an account, issue demo access,
 * manage administrators.
 *
 * Note what each role does NOT have, because that is the actual design:
 *   - kyc_reviewer cannot issue demo invitations or touch administrators.
 *   - operations_admin can work the user queue but CANNOT decide KYC. That
 *     separation is deliberate: the person chasing a customer to complete
 *     onboarding must not also be the person who approves their documents,
 *     because the commercial incentive is to approve.
 *   - demo_manager sees invitations and nothing else. A sales-side role has no
 *     reason to hold identity documents.
 *   - auditor has every *.view and no verb. Read-only means no write
 *     permission exists to forget to check.
 */
const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: [
    ...BASE,
    "users.view",
    "employers.view",
    "kyc.view",
    "invitations.view",
    "admins.view",
    "security.view",
    "support.view",
    "support.accessibility.view",
    "risk.view",
    "risk.decide",
    "reports.view",
    "investors.view",
    "kyc.decide",
    "users.suspend",
    "employers.manage",
    "invitations.manage",
    "admins.manage",
    "security.manage",
    "support.manage",
    "support.escalate",
  ],
  kyc_reviewer: [...BASE, "users.view", "kyc.view", "kyc.decide"],
  operations_admin: [
    ...BASE,
    "users.view",
    "employers.view",
    "employers.manage",
    "users.suspend",
    // Deliberately holds kyc.view without kyc.decide: operations needs to see
    // where a customer is stuck in order to help them, and must not be the one
    // who clears them.
    "kyc.view",
    // Same split for credit risk: can see a score and its knockouts, cannot
    // record the decision. Underwriting authority is not an operations job.
    "risk.view",
    "reports.view",
    "investors.view",
    // Support is operations' job: read the request, read how to reach the person
    // well, answer it. Escalating someone as vulnerable is NOT here — that goes
    // to a Super Admin, because it is a judgement about a person rather than a
    // step in a queue.
    "support.view",
    "support.accessibility.view",
    "support.manage",
  ],
  demo_manager: [...BASE, "invitations.view", "invitations.manage"],
  auditor: [
    ...BASE,
    "users.view",
    "employers.view",
    "kyc.view",
    "invitations.view",
    "admins.view",
    "security.view",
    // Reads help requests for oversight, but NOT support.accessibility.view: an
    // auditor checking that cases were handled properly does not need the list
    // of who needs bigger writing.
    "support.view",
    "risk.view",
    "reports.view",
    "investors.view",
  ],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Deny by default: unknown role or unknown permission → false. */
export function adminCan(role: string | null | undefined, permission: AdminPermission): boolean {
  if (!isAdminRole(role)) return false;
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}

/** The full permission list for a role — sent to the portal so it can hide dead ends. */
export function permissionsFor(role: string | null | undefined): AdminPermission[] {
  if (!isAdminRole(role)) return [];
  return [...ADMIN_ROLE_PERMISSIONS[role]];
}

/**
 * Which roles may an administrator with `actorRole` assign?
 *
 * Only Super Admin can assign anything, and this is the function that stops
 * privilege escalation by role assignment: without it, any role holding
 * `admins.manage` could grant itself super_admin, making every other
 * restriction in this file cosmetic.
 */
export function assignableRoles(actorRole: string | null | undefined): AdminRole[] {
  return actorRole === "super_admin" ? [...ADMIN_ROLES] : [];
}

/** Roles for the portal's own navigation gating. Section → permission needed. */
export const PORTAL_SECTIONS = [
  { key: "overview", label: "Overview", permission: "portal.overview.view" },
  { key: "users", label: "Registered users", permission: "users.view" },
  { key: "kyc", label: "KYC review", permission: "kyc.view" },
  { key: "employers", label: "Employers", permission: "employers.view" },
  { key: "risk", label: "Credit risk", permission: "risk.view" },
  { key: "investors", label: "Investors", permission: "investors.view" },
  { key: "reports", label: "Reports", permission: "reports.view" },
  { key: "invitations", label: "Demo invitations", permission: "invitations.view" },
  { key: "support", label: "Support requests", permission: "support.view" },
  { key: "admins", label: "Admin users", permission: "admins.view" },
  { key: "audit", label: "Audit logs", permission: "audit.view" },
  { key: "security", label: "Security settings", permission: "security.view" },
] as const satisfies readonly { key: string; label: string; permission: AdminPermission }[];
