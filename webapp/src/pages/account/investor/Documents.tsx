import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Real investor Documents & KYB — `/account/investor/documents`. No real
 * investor KYB (Know Your Business) flow exists yet — this account's own
 * identity verification (KYC) already happened at sign-up; KYB is a
 * separate, not-yet-built capital-partner verification step.
 */
export default function InvestorDocuments() {
  return (
    <div className="space-y-6">
      <PageHeader title="Documents & KYB" description="Capital-partner verification documents." />
      <Panel tone="info" icon={<ClipboardList className="h-5 w-5 text-primary" />} title="Not available yet">
        <p>
          A dedicated capital-partner (KYB) verification flow doesn't exist yet — your account's identity
          verification is already complete from sign-up. This page will hold KYB documents once that flow is built.
        </p>
      </Panel>
    </div>
  );
}
