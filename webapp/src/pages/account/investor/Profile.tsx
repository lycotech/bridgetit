import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useSession } from "@/lib/account/session";
import { TwoFactorSection } from "@/pages/account/AccountHome";

/** Real investor Profile — `/account/investor/profile`. */
export default function InvestorProfile() {
  const { data: session } = useSession();
  const user = session?.user ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your details and account security." />
      <Panel title="Your details">
        <div className="space-y-1">
          <SummaryRow label="Full name" value={user?.fullName ?? "—"} />
          <SummaryRow label="Email" value={user?.email ?? "—"} />
          <SummaryRow label="Phone" value={user?.phoneMasked ?? "Not added"} />
          <SummaryRow label="Identity verification" value={<StatusBadge status={user?.kycStatus ?? "—"} />} />
        </div>
      </Panel>
      <TwoFactorSection enabled={user?.twoFactorEnabled ?? false} />
    </div>
  );
}
