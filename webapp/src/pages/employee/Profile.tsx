import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Landmark, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { SelectField, TextField, ToggleRow } from "@/components/dashboard/forms";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PreferencesPanel } from "@/components/prefs/PreferencesPanel";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { longDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { useAuth } from "@/lib/auth/auth-context";

const BANKS = [
  "Access Bank",
  "First Bank of Nigeria",
  "Guaranty Trust Bank",
  "Kuda Microfinance Bank",
  "Moniepoint MFB",
  "Opay",
  "Stanbic IBTC",
  "United Bank for Africa",
  "Zenith Bank",
];

export default function EmployeeProfilePage() {
  const employeeId = useAccountId("employee");
  const queryClient = useQueryClient();
  const { user, updateProfile } = useAuth();

  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState(BANKS[2]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  const overview = useQuery({
    queryKey: qk.employeeOverview(employeeId),
    queryFn: () => employeeApi.overview(employeeId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.employeeOverview(employeeId) });
    void queryClient.invalidateQueries({ queryKey: qk.employeeBanks(employeeId) });
  };

  const addBank = useMutation({
    mutationFn: () => employeeApi.addBank(employeeId, { bankName, accountNumber, accountName }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setAccountNumber("");
      toast.success("Bank account added");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not add that account"),
  });

  const setPrimary = useMutation({
    mutationFn: (accountId: string) => employeeApi.setPrimaryBank(employeeId, accountId),
    onSuccess: () => {
      invalidate();
      toast.success("Primary account updated");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Your details and bank accounts"
        description="Your employer verifies your payroll record. Bank details are yours to manage."
      />

      {/* Ahead of everything else, and deliberately OUTSIDE AsyncPanel: the
          accessibility settings must not be behind a data fetch. If the overview
          request is slow or fails, the person who cannot read the screen at this
          size still needs the control that fixes it. */}
      <PreferencesPanel />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Personal details" description="Contact details come from your payroll record.">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Full name" value={data.employee.fullName} />
                <SummaryRow label="Staff ID" value={data.employee.staffId} />
                <SummaryRow label="Email" value={data.employee.email} />
                <SummaryRow label="Employer" value={data.employee.employerName} />
                <SummaryRow label="Department" value={data.employee.department} />
                <SummaryRow label="Job title" value={data.employee.jobTitle} />
                <SummaryRow label="Joined" value={longDate(data.employee.joinedAt)} />
                <SummaryRow
                  label="Identity verification"
                  value={<StatusBadge status={data.employee.kycStatus} />}
                />
              </div>

              <div className="mt-4 space-y-4">
                <TextField
                  label="Phone number"
                  value={phone}
                  onChange={setPhone}
                  inputMode="tel"
                  hint="Used for the codes that confirm each Bridge."
                />
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    updateProfile({ phone });
                    toast.success("Phone number saved");
                  }}
                >
                  Save changes
                </ActionButton>
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel
                title="Bank accounts"
                description="Choose where your Bridge lands."
                action={
                  <ActionButton size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                    Add
                  </ActionButton>
                }
              >
                <ul className="space-y-2.5">
                  {data.employee.bankAccounts.map((account) => (
                    <li
                      key={account.id}
                      className="flex items-center gap-3.5 rounded-2xl border border-border p-4"
                    >
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
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          <Star className="h-3 w-3" />
                          Primary
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrimary.mutate(account.id)}
                          className="shrink-0 text-xs font-semibold text-primary hover:underline"
                        >
                          Make primary
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Security" description="How we keep your account and your money safe.">
                <div className="divide-y divide-border/70">
                  <ToggleRow
                    title="Two-factor authentication"
                    description="Coming soon — you will be able to add an authenticator app here."
                    checked={user?.twoFactorEnabled ?? false}
                    onChange={() => toast.info("Two-factor authentication is coming soon")}
                    disabled
                  />
                  <ToggleRow
                    title="Confirm every Bridge with a code"
                    description="Always on. A 6-digit code is required before any money moves."
                    checked
                    onChange={() => undefined}
                    disabled
                  />
                </div>
                <InfoNote tone="primary" className="mt-4">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Secure session
                  </span>{" "}
                  — you are signed out automatically after a period of inactivity. PayBridge never asks for
                  your bank password or card PIN.
                </InfoNote>
              </Panel>
            </div>
          </div>
        )}
      </AsyncPanel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a bank account"
        description="We verify the account name before your first Bridge to it."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={addBank.isPending}
              disabled={accountNumber.replace(/\D/g, "").length !== 10 || accountName.trim().length < 3}
              onClick={() => addBank.mutate()}
            >
              Add account
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Bank"
            value={bankName}
            onChange={setBankName}
            options={BANKS.map((bank) => ({ value: bank, label: bank }))}
          />
          <TextField
            label="Account number"
            value={accountNumber}
            onChange={(value) => setAccountNumber(value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="0123456789"
            hint="10 digits"
          />
          <TextField label="Account name" value={accountName} onChange={setAccountName} />
        </div>
      </Modal>
    </div>
  );
}
