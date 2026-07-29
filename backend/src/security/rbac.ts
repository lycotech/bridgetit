/**
 * Server-side role → permission map.
 *
 * WHY this file exists at all: the app already has a role model in
 * webapp/src/lib/platform/roles.ts, but that copy runs on the attacker's
 * machine. Anything enforced only in React is a UX affordance, not a control —
 * a user can edit their stored role, call the API directly, or simply change
 * the JS. Access control must be decided where the data lives. This is the
 * authoritative copy; the frontend one exists only to hide dead ends.
 *
 * WHY deny-by-default: `hasPermission` returns false for unknown roles and
 * unknown permissions. A typo in a role name must fail closed. The most common
 * real-world broken-access-control bug is an allowlist that quietly evaluates
 * to "allow" when a lookup misses.
 *
 * WHY least privilege by portal: an employer administrator can approve payroll
 * but has no permission that could ever return an individual employee's Bridge
 * behaviour — the privacy boundary is expressed as an absent permission, not as
 * a filter someone might forget to apply.
 */

export const ROLES = [
  "employee",
  "employer_admin",
  "employer_finance",
  "employer_hr",
  "employer_viewer",
  "investor",
  "ops_officer",
  "ops_risk",
  "ops_compliance",
  "ops_finance",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

export type Permission =
  | "bridge.request"
  | "employer.payroll.upload"
  | "employer.payroll.approve"
  | "employer.payroll.exceptions.manage"
  | "employer.payroll.integrations.manage"
  | "employer.employees.manage"
  | "employer.reports.view"
  | "employer.settlement.pay"
  | "investor.invest"
  | "investor.withdraw"
  | "ops.employers.review"
  | "ops.funding.manage"
  | "ops.reconciliation.manage"
  | "ops.risk.manage"
  | "ops.compliance.manage"
  | "ops.settings.manage"
  | "ops.audit.read";

const OPS_BASE: Permission[] = ["ops.employers.review", "ops.audit.read"];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  employee: ["bridge.request"],
  employer_admin: [
    "employer.payroll.upload",
    "employer.payroll.approve",
    "employer.payroll.exceptions.manage",
    "employer.payroll.integrations.manage",
    "employer.employees.manage",
    "employer.reports.view",
    "employer.settlement.pay",
  ],
  employer_finance: [
    "employer.payroll.upload",
    "employer.payroll.approve",
    "employer.reports.view",
    "employer.settlement.pay",
  ],
  employer_hr: [
    "employer.employees.manage",
    "employer.payroll.exceptions.manage",
    "employer.payroll.upload",
    "employer.reports.view",
  ],
  employer_viewer: ["employer.reports.view"],
  investor: ["investor.invest", "investor.withdraw"],
  ops_officer: [...OPS_BASE, "ops.funding.manage", "ops.reconciliation.manage"],
  ops_risk: [...OPS_BASE, "ops.risk.manage"],
  ops_compliance: [...OPS_BASE, "ops.compliance.manage"],
  ops_finance: [...OPS_BASE, "ops.funding.manage", "ops.reconciliation.manage"],
  super_admin: [
    ...OPS_BASE,
    "ops.funding.manage",
    "ops.reconciliation.manage",
    "ops.risk.manage",
    "ops.compliance.manage",
    "ops.settings.manage",
  ],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!isRole(role)) return false; // deny by default
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Portals are hard boundaries: an employee token must never be accepted by an
 * employer route even if permissions happen to overlap in future.
 */
export function portalFor(role: Role): "employee" | "employer" | "investor" | "operations" {
  if (role === "employee") return "employee";
  if (role === "investor") return "investor";
  if (role.startsWith("employer_")) return "employer";
  return "operations";
}
