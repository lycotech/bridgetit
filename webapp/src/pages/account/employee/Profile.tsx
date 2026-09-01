import { BadgeCheck, CalendarClock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useSession } from "@/lib/account/session";
import { TwoFactorSection } from "@/pages/account/AccountHome";

/** Real employee Profile & bank — `/account/employee/profile`. */
export default function EmployeeProfile() {
  const { data: session } = useSession();
  const user = session?.user ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & bank" description="Your details and account security." />

      <StatGrid columns={3}>
        <StatCard
          label="Identity verification"
          value={<StatusBadge status={user?.kycStatus ?? "—"} />}
          icon={<BadgeCheck className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Two-factor authentication"
          value={user?.twoFactorEnabled ? "On" : "Off"}
          tone={user?.twoFactorEnabled ? "success" : "attention"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Member since"
          value={user ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </StatGrid>

      <Panel title="Your details">
        <div className="space-y-1">
          <SummaryRow label="Full name" value={user?.fullName ?? "—"} />
          <SummaryRow label="Email" value={user?.email ?? "—"} />
          <SummaryRow label="Phone" value={user?.phoneMasked ?? "Not added"} />
        </div>
      </Panel>

      <TwoFactorSection enabled={user?.twoFactorEnabled ?? false} />
    </div>
  );
}
