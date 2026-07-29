import type { Portal, Role } from "./models";

/**
 * Role registry + role-based access. One entry per platform role; the portal
 * decides which dashboard shell and home route a session lands on.
 */

export type Permission =
  | "bridge.request"
  | "employer.payroll.upload"
  | "employer.payroll.exceptions.manage"
  | "employer.payroll.integrations.manage"
  | "employer.payroll.approve"
  | "employer.reports.view"
  | "employer.buffer.request"
  | "employer.settings.manage"
  | "employer.employees.manage"
  | "investor.invest"
  | "investor.withdraw"
  | "ops.employers.review"
  | "ops.employees.review"
  | "ops.investors.review"
  | "ops.transactions.manage"
  | "ops.funding.manage"
  | "ops.portfolios.manage"
  | "ops.reconciliation.manage"
  | "ops.risk.manage"
  | "ops.compliance.manage"
  | "ops.reports.view"
  | "ops.support.manage"
  | "ops.settings.manage"
  /**
   * Invite named people into the confidential demonstration environment.
   *
   * NOT part of OPS_BASE. Deciding who may see the platform before launch is a
   * commercial and confidentiality decision, not day-to-day operations work — an
   * officer reviewing employers has no reason to widen the guest list. Granted to
   * super_admin only, and the page also demands staff credentials on top of the
   * role, because everyone inside the demo already holds an invitation.
   */
  | "ops.demo.invite";

export interface RoleMeta {
  role: Role;
  label: string;
  shortLabel: string;
  portal: Portal;
  home: string;
  description: string;
  internal: boolean;
  permissions: Permission[];
}

const OPS_BASE: Permission[] = [
  "ops.employers.review",
  "ops.employees.review",
  "ops.investors.review",
  "ops.transactions.manage",
  "ops.reports.view",
  "ops.support.manage",
];

export const ROLES: Record<Role, RoleMeta> = {
  employee: {
    role: "employee",
    label: "Employee",
    shortLabel: "Employee",
    portal: "employee",
    home: "/employee",
    description: "Access your earned pay, track settlement and build savings.",
    internal: false,
    permissions: ["bridge.request"],
  },
  employer_admin: {
    role: "employer_admin",
    label: "Payroll administrator",
    shortLabel: "Payroll admin",
    portal: "employer",
    home: "/employer",
    description:
      "Runs the payroll cycle: files, integrations, exceptions, employees and company settings.",
    internal: false,
    permissions: [
      "employer.payroll.upload",
      "employer.payroll.exceptions.manage",
      "employer.payroll.integrations.manage",
      "employer.buffer.request",
      "employer.settings.manage",
      "employer.employees.manage",
      "employer.reports.view",
    ],
  },
  employer_finance: {
    role: "employer_finance",
    label: "Finance authoriser",
    shortLabel: "Finance",
    portal: "employer",
    home: "/employer",
    description: "Authorises payroll funding and approves the payroll run for processing.",
    internal: false,
    permissions: [
      "employer.payroll.upload",
      "employer.payroll.approve",
      "employer.buffer.request",
      "employer.reports.view",
    ],
  },
  employer_hr: {
    role: "employer_hr",
    label: "HR administrator",
    shortLabel: "HR admin",
    portal: "employer",
    home: "/employer",
    description: "Employee records, employment changes and the exceptions that come from them.",
    internal: false,
    permissions: [
      "employer.employees.manage",
      "employer.payroll.exceptions.manage",
      "employer.reports.view",
    ],
  },
  employer_viewer: {
    role: "employer_viewer",
    label: "Executive viewer",
    shortLabel: "Executive",
    portal: "employer",
    home: "/employer",
    description: "Read-only company totals and reports. Cannot change payroll or confirm exceptions.",
    internal: false,
    permissions: ["employer.reports.view"],
  },
  investor: {
    role: "investor",
    label: "Investor",
    shortLabel: "Investor",
    portal: "investor",
    home: "/investor",
    description: "Review mandates, commit capital and monitor portfolio performance.",
    internal: false,
    permissions: ["investor.invest", "investor.withdraw"],
  },
  ops_officer: {
    role: "ops_officer",
    label: "PayBridge operations officer",
    shortLabel: "Operations",
    portal: "operations",
    home: "/operations",
    description: "Day-to-day operations: requests, disbursements and support.",
    internal: true,
    permissions: [...OPS_BASE, "ops.funding.manage", "ops.reconciliation.manage"],
  },
  ops_risk: {
    role: "ops_risk",
    label: "PayBridge risk officer",
    shortLabel: "Risk",
    portal: "operations",
    home: "/operations",
    description: "Exposure, limits and risk alerts.",
    internal: true,
    permissions: [...OPS_BASE, "ops.risk.manage"],
  },
  ops_compliance: {
    role: "ops_compliance",
    label: "PayBridge compliance officer",
    shortLabel: "Compliance",
    portal: "operations",
    home: "/operations",
    description: "KYC, KYB, screening and compliance cases.",
    internal: true,
    permissions: [...OPS_BASE, "ops.compliance.manage"],
  },
  ops_finance: {
    role: "ops_finance",
    label: "PayBridge finance officer",
    shortLabel: "Finance",
    portal: "operations",
    home: "/operations",
    description: "Capital, funding, portfolio accounting and reconciliation.",
    internal: true,
    permissions: [
      ...OPS_BASE,
      "ops.funding.manage",
      "ops.portfolios.manage",
      "ops.reconciliation.manage",
    ],
  },
  super_admin: {
    role: "super_admin",
    label: "Super administrator",
    shortLabel: "Super admin",
    portal: "operations",
    home: "/operations",
    description: "Unrestricted access across every PayBridge module.",
    internal: true,
    permissions: [
      ...OPS_BASE,
      "ops.funding.manage",
      "ops.portfolios.manage",
      "ops.reconciliation.manage",
      "ops.risk.manage",
      "ops.compliance.manage",
      "ops.settings.manage",
      "ops.demo.invite",
    ],
  },
};

export const ROLE_LIST: RoleMeta[] = Object.values(ROLES);

export const PUBLIC_SIGNUP_ROLES: Role[] = [
  "employee",
  "employer_admin",
  "employer_finance",
  "employer_hr",
  "employer_viewer",
  "investor",
];

export function roleMeta(role: Role): RoleMeta {
  return ROLES[role];
}

export function homeFor(role: Role): string {
  return ROLES[role].home;
}

export function portalFor(role: Role): Portal {
  return ROLES[role].portal;
}

export function can(role: Role, permission: Permission): boolean {
  return ROLES[role].permissions.includes(permission);
}

/** Portal groups used by the public "choose who you are" step. */
export const AUDIENCES = [
  {
    key: "employee" as const,
    title: "Employee",
    blurb: "Access the pay you have already earned, before payday.",
    defaultRole: "employee" as Role,
  },
  {
    key: "employer" as const,
    title: "Employer",
    blurb: "Enable your team and protect payroll continuity.",
    defaultRole: "employer_admin" as Role,
  },
  {
    key: "investor" as const,
    title: "Investor",
    blurb: "Put capital to work where salaries are earned.",
    defaultRole: "investor" as Role,
  },
];
