import { BadgeCheck, CalendarClock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PreferencesPanel } from "@/components/prefs/PreferencesPanel";
import { useSession } from "@/lib/account/session";
import { TwoFactorSection } from "@/pages/account/AccountHome";

/** Real investor Profile — `/account/investor/profile`. */
export default function InvestorProfile() {
  const { data: session } = useSession();
  const user = session?.user ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your details and account security." />

      {/* Ahead of anything that reads session data — see the note on the
          employee profile: the control that fixes an unreadable screen must not
          sit below something that can be slow or fail. */}
      <PreferencesPanel />

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
          label="Investor since"
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
