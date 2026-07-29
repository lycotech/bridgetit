import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { SelectField, TextField, ToggleRow } from "@/components/dashboard/forms";
import { StatusBadge, RiskPill } from "@/components/dashboard/StatusBadge";
import { employerApi, payrollApi, qk } from "@/lib/platform/mock-service";
import { FALLBACK_RULES } from "@/lib/platform/models";
import { longDate, naira } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { useAuth } from "@/lib/auth/auth-context";

const TEAM_ROLES = [
  { value: "employer_admin", label: "Payroll administrator" },
  { value: "employer_hr", label: "HR administrator" },
  { value: "employer_finance", label: "Finance authoriser" },
  { value: "employer_viewer", label: "Executive viewer" },
];

const SHARE_OPTIONS = ["30", "40", "50", "60"];

export default function EmployerSettingsPage() {
  const employerId = useAccountId("employer");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [payrollDay, setPayrollDay] = useState("28");
  const [notifyBridge, setNotifyBridge] = useState(true);
  const [notifySettlement, setNotifySettlement] = useState(true);
  const [notifyBuffer, setNotifyBuffer] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(TEAM_ROLES[1].value);

  const overview = useQuery({
    queryKey: qk.employerOverview(employerId),
    queryFn: () => employerApi.overview(employerId),
  });
  const policy = useQuery({
    queryKey: qk.payrollPolicy(employerId),
    queryFn: () => payrollApi.policy(employerId),
  });

  const updatePolicy = useMutation({
    mutationFn: (patch: Parameters<typeof payrollApi.updatePolicy>[1]) =>
      payrollApi.updatePolicy(employerId, patch, user?.fullName ?? "Payroll administrator"),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: qk.payrollPolicy(employerId) });
      void queryClient.invalidateQueries({ queryKey: qk.payrollCommandCentre(employerId) });
      void queryClient.invalidateQueries({ queryKey: qk.employerEmployees(employerId) });
      toast.success(`Payroll rules saved — version ${updated.version}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Company and access settings"
        description="Your organisation details, who can act on PayBridge, and how much earned pay stays available."
      />

      <AsyncPanel query={overview}>
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Organisation" description="Verified against your CAC record during onboarding.">
              <div className="divide-y divide-border/70">
                <SummaryRow label="Company name" value={data.employer.name} />
                <SummaryRow label="RC number" value={data.employer.rcNumber} />
                <SummaryRow label="Industry" value={data.employer.industry} />
                <SummaryRow label="Primary contact" value={data.employer.contactName} />
                <SummaryRow label="Contact email" value={data.employer.contactEmail} />
                <SummaryRow label="Employees on payroll" value={String(data.employer.employeeCount)} />
                <SummaryRow label="Account status" value={<StatusBadge status={data.employer.applicationStatus} />} />
                <SummaryRow label="Risk band" value={<RiskPill level={data.employer.riskLevel} />} />
                <SummaryRow label="Approved limit" value={naira(data.employer.approvedLimit)} />
                <SummaryRow label="Next payroll" value={longDate(data.employer.nextPayrollDate)} />
              </div>
              <InfoNote className="mt-4">
                To change your registered details or approved limit, message your PayBridge relationship manager.
              </InfoNote>
            </Panel>

            <div className="space-y-6">
              <Panel
                title="Payroll rules"
                description="Approved once at onboarding, then applied automatically. You are never asked to re-approve unchanged earnings."
                action={
                  policy.data ? (
                    <span className="text-xs text-muted-foreground">Version {policy.data.version}</span>
                  ) : null
                }
              >
                {policy.data ? (
                  <div className="space-y-4">
                    <SelectField
                      label="Share of earned pay available"
                      value={String(policy.data.maxBridgePct)}
                      onChange={(value) => updatePolicy.mutate({ maxBridgePct: Number(value) })}
                      options={SHARE_OPTIONS.map((value) => ({
                        value,
                        label: `${value}% of net pay earned so far`,
                      }))}
                      hint="Calculated from confirmed net pay, never gross."
                    />
                    <SelectField
                      label="Payroll day"
                      value={payrollDay}
                      onChange={(value) => {
                        setPayrollDay(value);
                        toast.success(`Payroll day set to day ${value}`);
                      }}
                      options={["25", "26", "27", "28", "30"].map((value) => ({
                        value,
                        label: `Day ${value} of each month`,
                      }))}
                    />
                    <SelectField
                      label="If payroll data is late"
                      value={policy.data.fallbackRule}
                      onChange={(value) =>
                        updatePolicy.mutate({ fallbackRule: value as (typeof FALLBACK_RULES)[number] })
                      }
                      options={FALLBACK_RULES.map((value) => ({ value, label: value }))}
                      hint="PayBridge never estimates earnings indefinitely."
                    />
                    <SelectField
                      label="Grace period"
                      value={String(policy.data.gracePeriodDays)}
                      onChange={(value) => updatePolicy.mutate({ gracePeriodDays: Number(value) })}
                      options={["0", "1", "2", "3", "5"].map((value) => ({
                        value,
                        label: value === "0" ? "No grace period" : `${value} days`,
                      }))}
                    />
                    <div className="divide-y divide-border/70">
                      <ToggleRow
                        title="Pause availability on critical exceptions"
                        description="New earned-pay access stops for that employee until you confirm the change."
                        checked={policy.data.autoPauseOnCritical}
                        onChange={(value) => updatePolicy.mutate({ autoPauseOnCritical: value })}
                      />
                      <ToggleRow
                        title="Allow bulk accept for low-risk exceptions"
                        description="Informational changes can be accepted together."
                        checked={policy.data.allowBulkAcceptLowRisk}
                        onChange={(value) => updatePolicy.mutate({ allowBulkAcceptLowRisk: value })}
                      />
                    </div>
                    <div className="divide-y divide-border/70">
                      <SummaryRow label="Payroll calendar" value={policy.data.payrollCalendar} />
                      <SummaryRow label="Net method" value={policy.data.netMethod} />
                      <SummaryRow label="Eligible categories" value={policy.data.eligibleCategories.join(", ")} />
                      <SummaryRow label="Minimum service" value={`${policy.data.minimumMonthsService} months`} />
                      <SummaryRow label="Protected deductions" value={policy.data.protectedDeductions.join(", ")} />
                      <SummaryRow label="Excluded deductions" value={policy.data.excludedDeductions.join(", ")} />
                      <SummaryRow label="Submission schedule" value={policy.data.submissionSchedule} />
                      <SummaryRow label="Submission deadline" value={policy.data.submissionDeadline} />
                      <SummaryRow label="Payroll administrator" value={policy.data.approvers.payrollAdmin} />
                      <SummaryRow label="HR administrator" value={policy.data.approvers.hrAdmin} />
                      <SummaryRow label="Finance authoriser" value={policy.data.approvers.financeAuthoriser} />
                      <SummaryRow label="Last approved by" value={policy.data.approvedBy} />
                    </div>
                  </div>
                ) : null}
                <InfoNote tone="primary" className="mt-4">
                  Employees only ever access pay they have already earned, calculated from confirmed net salary.
                  Nothing here creates credit.
                </InfoNote>
              </Panel>

              <Panel
                title="Your team"
                description="Administrators, finance and HR officers who can act for your company."
                action={
                  <ActionButton
                    size="sm"
                    variant="secondary"
                    icon={<UserPlus className="h-3.5 w-3.5" />}
                    onClick={() => setInviteOpen(true)}
                  >
                    Invite
                  </ActionButton>
                }
              >
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {user?.fullName ?? data.employer.contactName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {user?.email ?? data.employer.contactEmail}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      You
                    </span>
                  </li>
                  <li className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        Finance officer seat
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Not yet invited</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      className="shrink-0 text-xs font-semibold text-primary hover:underline"
                    >
                      Invite
                    </button>
                  </li>
                </ul>
              </Panel>

              <Panel title="Notifications" description="Choose what your team hears about.">
                <div className="divide-y divide-border/70">
                  <ToggleRow
                    title="Daily Bridge summary"
                    description="One email each morning with yesterday's activity."
                    checked={notifyBridge}
                    onChange={(value) => {
                      setNotifyBridge(value);
                      toast.success(value ? "Daily summary on" : "Daily summary off");
                    }}
                  />
                  <ToggleRow
                    title="Settlement reminders"
                    description="Three days before each settlement date."
                    checked={notifySettlement}
                    onChange={(value) => {
                      setNotifySettlement(value);
                      toast.success(value ? "Settlement reminders on" : "Settlement reminders off");
                    }}
                  />
                  <ToggleRow
                    title="Salary Buffer updates"
                    description="Status changes on any buffer request."
                    checked={notifyBuffer}
                    onChange={(value) => {
                      setNotifyBuffer(value);
                      toast.success(value ? "Buffer updates on" : "Buffer updates off");
                    }}
                  />
                  <ToggleRow
                    title="Two-factor authentication"
                    description="Coming soon for employer teams."
                    checked={false}
                    onChange={() => toast.info("Two-factor authentication is coming soon")}
                    disabled
                  />
                </div>
              </Panel>
            </div>
          </div>
        )}
      </AsyncPanel>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a colleague"
        description="They receive an email invitation and set their own password."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              disabled={!inviteEmail.includes("@")}
              onClick={() => {
                setInviteOpen(false);
                setInviteEmail("");
                toast.success(`Invitation sent to ${inviteEmail}`);
              }}
            >
              Send invitation
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Work email"
            value={inviteEmail}
            onChange={setInviteEmail}
            inputMode="email"
            placeholder="name@company.com"
          />
          <SelectField label="Role" value={inviteRole} onChange={setInviteRole} options={TEAM_ROLES} />
          <InfoNote>
            Payroll administrators submit payroll and review exceptions. HR administrators confirm employment
            changes. Finance authorisers approve funding. Executive viewers see company aggregates only — no
            line manager ever sees an employee's financial activity.
          </InfoNote>
        </div>
      </Modal>
    </div>
  );
}
