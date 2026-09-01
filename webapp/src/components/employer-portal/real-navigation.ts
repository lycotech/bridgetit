import {
  Cable,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Landmark,
  Receipt,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Navigation for the REAL Employer Portal (`/employer-portal/*`) — mirrors
 * the shape and icon choices of `webapp/src/components/dashboard/
 * navigation.ts`'s employer entry (the demo's nav) so the real portal is a
 * structural replica, wired to real data. No URL collision with the demo:
 * the demo lives at `/employer/*`, the real portal has always lived at
 * `/employer-portal/*`.
 */
export interface EmployerNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface EmployerNavSection {
  label?: string;
  items: EmployerNavItem[];
}

export const EMPLOYER_PORTAL_NAV: EmployerNavSection[] = [
  { items: [{ to: "/employer-portal", label: "Overview", icon: LayoutDashboard, end: true }] },
  {
    label: "Payroll",
    items: [
      { to: "/employer-portal/employees", label: "Employees", icon: Users },
      { to: "/employer-portal/payroll", label: "Payroll", icon: Wallet },
      { to: "/employer-portal/salary-account-requests", label: "Salary Account Requests", icon: ClipboardList },
      { to: "/employer-portal/payroll-model", label: "PayBridge Payroll (optional)", icon: Wallet },
    ],
  },
  {
    label: "Payroll continuity",
    items: [
      { to: "/employer-portal/salary-buffer", label: "Salary Buffer", icon: Landmark },
      { to: "/employer-portal/bridge-activity", label: "Earned pay & settlements", icon: ShieldAlert },
      { to: "/employer-portal/repayments", label: "Repayments", icon: Receipt },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/employer-portal/reports", label: "Reports", icon: FileBarChart },
      { to: "/employer-portal/integrations", label: "Integrations", icon: Cable },
      { to: "/employer-portal/settings", label: "Settings", icon: Settings },
    ],
  },
];
