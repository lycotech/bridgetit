import {
  ArrowDownToLine,
  ClipboardList,
  Coins,
  FileText,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  PieChart,
  Receipt,
  Share2,
  Sprout,
  UserCog,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Navigation for the REAL customer dashboard (`/account/employee/*`,
 * `/account/investor/*`) — deliberately mirrors the shape and icon choices
 * of `webapp/src/components/dashboard/navigation.ts` (the mock demo's nav)
 * so the real experience is visually/structurally a replica of it, just
 * wired to real data. Kept as a SEPARATE file/type, not reused directly,
 * because the demo's `PORTAL_NAV` is keyed by the demo's `Portal` type and
 * carries demo-only `permission` gating that has no real-session equivalent.
 */
export type RealPortal = "employee" | "investor";

export interface RealNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface RealNavSection {
  label?: string;
  items: RealNavItem[];
}

export const REAL_PORTAL_NAV: Record<RealPortal, RealNavSection[]> = {
  employee: [
    { items: [{ to: "/account/employee", label: "Overview", icon: LayoutDashboard, end: true }] },
    {
      label: "Your money",
      items: [
        { to: "/account/employee/bridge", label: "Bridge", icon: Gauge },
        { to: "/account/employee/pay", label: "My Pay", icon: Wallet },
        { to: "/account/employee/savings", label: "Save", icon: Sprout },
        { to: "/account/employee/invest", label: "Invest", icon: LineChart },
        { to: "/account/employee/grow", label: "Grow", icon: HeartPulse },
        { to: "/account/employee/refer", label: "Refer & Earn", icon: Share2 },
      ],
    },
    { label: "Activity", items: [{ to: "/account/employee/transactions", label: "Transactions", icon: Receipt }] },
    {
      label: "Account",
      items: [
        { to: "/account/employee/profile", label: "Profile & bank", icon: UserCog },
        { to: "/account/employee/support", label: "Support", icon: LifeBuoy },
      ],
    },
  ],
  investor: [
    {
      items: [
        { to: "/account/investor", label: "Overview", icon: LayoutDashboard, end: true },
        { to: "/account/investor/invest", label: "Invest", icon: Coins },
        { to: "/account/investor/performance", label: "Performance", icon: PieChart },
      ],
    },
    {
      label: "Capital",
      items: [
        { to: "/account/investor/transactions", label: "Transactions", icon: Receipt },
        { to: "/account/investor/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
        { to: "/account/investor/statements", label: "Statements", icon: FileText },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/account/investor/documents", label: "Documents & KYB", icon: ClipboardList },
        { to: "/account/investor/profile", label: "Profile", icon: UserCog },
      ],
    },
  ],
};

export const REAL_PORTAL_LABEL: Record<RealPortal, string> = {
  employee: "Employee",
  investor: "Investor",
};
