import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Landmark } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel } from "@/components/dashboard/states";
import { SelectField, TextField, ToggleRow } from "@/components/dashboard/forms";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { InvestorDisclosureLine } from "@/components/investor/Disclosures";
import { investorApi, qk } from "@/lib/platform/mock-service";
import { naira, shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { useAuth } from "@/lib/auth/auth-context";

const FREQUENCIES = ["Monthly", "Quarterly", "At maturity"];

export default function InvestorProfilePage() {
  const investorId = useAccountId("investor");
  const { user, updateProfile } = useAuth();

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [contact, setContact] = useState(user?.fullName ?? "");
  const [reporting, setReporting] = useState(FREQUENCIES[1]);
  const [notifyDeployment, setNotifyDeployment] = useState(true);
  const [notifyDistribution, setNotifyDistribution] = useState(true);
  const [notifyStatements, setNotifyStatements] = useState(true);

  const overview = useQuery({
    queryKey: qk.investorOverview(investorId),
    queryFn: () => investorApi.overview(investorId),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Your investor account"
        description="Your details, mandate preferences and how we keep the account secure."
      />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Investor details" description="Held on file by the investment manager.">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Investor" value={data.investor.name} />
                <SummaryRow label="Type" value={data.investor.type} />
                <SummaryRow label="Email" value={data.investor.email} />
                <SummaryRow label="Accreditation" value={data.investor.accreditation} />
                <SummaryRow label="Verification" value={<StatusBadge status={data.investor.kybStatus} />} />
                <SummaryRow label="Risk profile" value={<RiskPill level={data.investor.riskProfile} />} />
                <SummaryRow label="Investor since" value={shortDate(data.investor.joinedAt)} />
                <SummaryRow label="Portfolio value" value={naira(data.investor.portfolioValue)} emphasis tone="primary" />
              </div>

              <div className="mt-5 space-y-4">
                <TextField label="Primary contact" value={contact} onChange={setContact} />
                <TextField
                  label="Phone number"
                  value={phone}
                  onChange={setPhone}
                  inputMode="tel"
                  hint="Used for verification when you request a withdrawal."
                />
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    updateProfile({ fullName: contact, phone });
                    toast.success("Contact details saved");
                  }}
                >
                  Save changes
                </ActionButton>
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel title="Settlement accounts" description="Withdrawals are only ever paid to these accounts.">
                <ul className="space-y-2.5">
                  {data.investor.bankAccounts.map((account) => (
                    <li key={account.id} className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <Landmark className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{account.bankName}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground tnum">
                          {account.accountName} · {account.accountNumberMasked}
                        </span>
                      </span>
                      {account.isPrimary ? (
                        <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          Primary
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <InfoNote className="mt-4">
                  To add or change a settlement account, contact the investment manager. Changes require
                  re-verification.
                </InfoNote>
              </Panel>

              <Panel title="Reporting preferences">
                <SelectField
                  label="Statement frequency"
                  value={reporting}
                  onChange={(value) => {
                    setReporting(value);
                    toast.success(`Statements set to ${value.toLowerCase()}`);
                  }}
                  options={FREQUENCIES.map((value) => ({ value, label: value }))}
                />
                <div className="mt-4 divide-y divide-border/70">
                  <ToggleRow
                    title="Deployment updates"
                    description="When capital is deployed into a mandate."
                    checked={notifyDeployment}
                    onChange={setNotifyDeployment}
                  />
                  <ToggleRow
                    title="Distribution notices"
                    description="When income is distributed to your account."
                    checked={notifyDistribution}
                    onChange={setNotifyDistribution}
                  />
                  <ToggleRow
                    title="Statement ready"
                    description="When a new statement or tax document is available."
                    checked={notifyStatements}
                    onChange={setNotifyStatements}
                  />
                  <ToggleRow
                    title="Two-factor authentication"
                    description="Coming soon — an authenticator app for investor accounts."
                    checked={user?.twoFactorEnabled ?? false}
                    onChange={() => toast.info("Two-factor authentication is coming soon")}
                    disabled
                  />
                </div>
                <InfoNote tone="primary" className="mt-4">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Secure session
                  </span>{" "}
                  — withdrawal requests always require verification, and PayBridge never asks for your bank
                  password.
                </InfoNote>
              </Panel>
            </div>
          </div>
        )}
      </AsyncPanel>

      <InvestorDisclosureLine />
    </div>
  );
}
