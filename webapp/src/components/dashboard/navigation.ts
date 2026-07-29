import {
  Banknote,
  Cable,
  Building2,
  ClipboardList,
  Coins,
  FileBarChart,
  FileText,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  PieChart,
  Receipt,
  Scale,
  Settings,
  ShieldAlert,
  Sprout,
  Upload,
  UserCog,
  Users,
  Wallet,
  Landmark,
  ArrowDownToLine,
  ScrollText,
  Ticket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Portal } from "@/lib/platform/models";
import type { Permission } from "@/lib/platform/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** When set, the item is hidden for roles without the permission. */
  permission?: Permission;
  end?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const PORTAL_NAV: Record<Portal, NavSection[]> = {
  employee: [
    {
      items: [{ to: "/employee", label: "Overview", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Your money",
      items: [
        { to: "/employee/bridge", label: "Bridge", icon: Gauge },
        { to: "/employee/pay", label: "My Pay", icon: Wallet },
        { to: "/employee/savings", label: "Save", icon: Sprout },
        { to: "/employee/invest", label: "Invest", icon: LineChart },
        { to: "/employee/grow", label: "Grow", icon: HeartPulse },
      ],
    },
    {
      label: "Activity",
      items: [{ to: "/employee/transactions", label: "Transactions", icon: Receipt }],
    },
    {
      label: "Account",
      items: [
        { to: "/employee/profile", label: "Profile & bank", icon: UserCog },
        { to: "/employee/support", label: "Support", icon: LifeBuoy },
      ],
    },
  ],
  employer: [
    {
      items: [
        { to: "/employer", label: "Overview", icon: LayoutDashboard, end: true },
        {
          to: "/employer/employees",
          label: "Employees",
          icon: Users,
          permission: "employer.employees.manage",
        },
      ],
    },
    {
      label: "PayBridge Payroll",
      items: [
        { to: "/employer/payroll", label: "Command centre", icon: Gauge, end: true },
        {
          to: "/employer/payroll/exceptions",
          label: "Exceptions",
          icon: ShieldAlert,
          permission: "employer.payroll.exceptions.manage",
        },
        {
          to: "/employer/payroll/records",
          label: "Payroll records",
          icon: ScrollText,
          permission: "employer.employees.manage",
        },
        {
          to: "/employer/payroll/runs",
          label: "Files & funding",
          icon: Upload,
          permission: "employer.payroll.upload",
        },
        {
          to: "/employer/payroll/integrations",
          label: "Integrations",
          icon: Cable,
          permission: "employer.payroll.integrations.manage",
        },
      ],
    },
    {
      label: "Payroll continuity",
      items: [
        {
          to: "/employer/salary-buffer",
          label: "Salary Buffer",
          icon: Landmark,
          permission: "employer.buffer.request",
        },
        {
          to: "/employer/bridge-activity",
          label: "Earned pay & settlements",
          icon: Banknote,
          permission: "employer.reports.view",
        },
        {
          to: "/employer/repayments",
          label: "Repayments",
          icon: Receipt,
          permission: "employer.reports.view",
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          to: "/employer/reports",
          label: "Reports",
          icon: FileBarChart,
          permission: "employer.reports.view",
        },
        {
          to: "/employer/settings",
          label: "Settings",
          icon: Settings,
          permission: "employer.settings.manage",
        },
      ],
    },
  ],
  investor: [
    {
      items: [
        { to: "/investor", label: "Overview", icon: LayoutDashboard, end: true },
        { to: "/investor/invest", label: "Invest", icon: Coins },
        { to: "/investor/performance", label: "Performance", icon: PieChart },
      ],
    },
    {
      label: "Capital",
      items: [
        { to: "/investor/transactions", label: "Transactions", icon: Receipt },
        { to: "/investor/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
        { to: "/investor/statements", label: "Statements", icon: FileText },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/investor/documents", label: "Documents & KYB", icon: ClipboardList },
        { to: "/investor/profile", label: "Profile", icon: UserCog },
      ],
    },
  ],
  operations: [
    {
      items: [{ to: "/operations", label: "Control centre", icon: LayoutDashboard, end: true }],
    },
    {
      label: "Customers",
      items: [
        { to: "/operations/employers", label: "Employers", icon: Building2, permission: "ops.employers.review" },
        { to: "/operations/employees", label: "Employees", icon: Users, permission: "ops.employees.review" },
        { to: "/operations/investors", label: "Investors", icon: Wallet, permission: "ops.investors.review" },
      ],
    },
    {
      label: "Money",
      items: [
        { to: "/operations/transactions", label: "Transactions", icon: Receipt, permission: "ops.transactions.manage" },
        { to: "/operations/funding", label: "Funding queue", icon: Landmark, permission: "ops.funding.manage" },
        {
          to: "/operations/payroll",
          label: "Payroll monitoring",
          icon: Gauge,
          permission: "ops.employers.review",
        },
        { to: "/operations/portfolios", label: "Portfolios", icon: PieChart, permission: "ops.portfolios.manage" },
        {
          to: "/operations/reconciliation",
          label: "Reconciliation",
          icon: Scale,
          permission: "ops.reconciliation.manage",
        },
      ],
    },
    {
      label: "Oversight",
      items: [
        { to: "/operations/risk", label: "Risk", icon: ShieldAlert, permission: "ops.risk.manage" },
        { to: "/operations/compliance", label: "Compliance", icon: ScrollText, permission: "ops.compliance.manage" },
        { to: "/operations/reports", label: "Reports", icon: FileBarChart, permission: "ops.reports.view" },
      ],
    },
    {
      label: "Service",
      items: [
        { to: "/operations/support", label: "Support", icon: LifeBuoy, permission: "ops.support.manage" },
        { to: "/operations/settings", label: "Settings & audit", icon: Settings },
      ],
    },
    {
      label: "Demonstration",
      items: [
        {
          to: "/operations/demo-access",
          label: "Demo access",
          icon: Ticket,
          permission: "ops.demo.invite",
        },
      ],
    },
  ],
};

export const PORTAL_LABEL: Record<Portal, string> = {
  employee: "Employee",
  employer: "Employer",
  investor: "Investor",
  operations: "Operations",
};
