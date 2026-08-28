import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { AsyncPanel } from "@/components/dashboard/states";
import { employerApi, qk } from "@/lib/platform/mock-service";
import { dateTime, salaryAccountStatusLabel } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";
import { LiveModeTabs } from "@/components/employer/LiveModeTabs";
import RealSalaryAccountRequestReview from "@/pages/employer-portal/SalaryAccountRequestReview";

const UNCHANGED = [
  "Salary calculation",
  "Payroll approval process",
  "PAYE",
  "Pension",
  "Statutory deductions",
  "Employee benefits",
  "Payroll calendar",
  "Employer bank",
  "Payroll software",
];

const EMPLOYEE_INSTRUCTION_TEXT = [
  "I voluntarily request and authorise my employer to update my nominated salary-payment account to the PayBridge Salary Account provided above for as long as I remain enrolled in PayBridge Access.",
  "I understand that my employer's role is limited to processing salary to the bank account nominated by me in accordance with the employer's normal payroll process.",
  "I authorise PayBridge and its regulated banking and payment partners, subject to applicable terms and law, to apply agreed PayBridge settlement instructions to qualifying salary credits received into my PayBridge Salary Account and to transfer the remaining available balance to my nominated external bank account where the service is supported.",
  "I acknowledge that PayBridge products and obligations are separate from my employer's obligations under my contract of employment.",
];

const CONSENT_CHECKLIST = [
  "I have reviewed the PayBridge Access Terms",
  "I authorise this salary-account update",
  "I authorise applicable settlement instructions",
  "I consent to the processing and sharing of information required for payroll settlement and reconciliation",
];

const PROTECTION_NOTICE = [
  "PayBridge Access is an employee-elected financial service provided independently of the employer.",
  "The employer's participation is limited to verifying eligible employment information, processing approved salary-account instructions and providing information reasonably required for payroll settlement and reconciliation.",
  "The employer does not provide the advance, determine the employee's use of funds, manage the employee's PayBridge Account, or provide investment, credit or other financial advice.",
  "To the extent permitted by applicable law and the definitive PayBridge Employer Agreement, PayBridge will be responsible for obligations arising from PayBridge's platform operations, settlement instructions and participating financial-service providers, except to the extent that a loss results from inaccurate payroll information, unauthorised employer action, fraud, gross negligence or wilful misconduct by the employer or its authorised representatives.",
];

export default function SalaryAccountRequestReviewPage() {
  const employerId = useAccountId("employer");
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const request = useQuery({
    queryKey: qk.employerSalaryAccountRequest(id),
    queryFn: () => employerApi.salaryAccountRequest(employerId, id),
  });

  const [confirming, setConfirming] = useState<"approved" | "rejected" | null>(null);
  const [authorised, setAuthorised] = useState(false);

  const decide = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      employerApi.decideSalaryAccountRequest(id, decision, "HR administrator"),
    onSuccess: (_result, decision) => {
      void queryClient.invalidateQueries({ queryKey: qk.employerSalaryAccountRequest(id) });
      void queryClient.invalidateQueries({ queryKey: qk.employerSalaryAccountRequests(employerId) });
      void queryClient.invalidateQueries({ queryKey: qk.employerOverview(employerId) });
      setConfirming(null);
      setAuthorised(false);
      toast.success(decision === "approved" ? "Salary account updated" : "Request rejected");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll Setup · Option A"
        title="Employee Request to Update Salary Account"
        actions={
          <ActionButton to="/employer/salary-account-requests" variant="ghost">
            Back to requests
          </ActionButton>
        }
      />

      <LiveModeTabs
        gateTitle="Company sign-in required"
        gateDescription="Sign in to your company's PayBridge account to review this request with real data instead of demo data."
        live={<RealSalaryAccountRequestReview />}
        demo={
      <AsyncPanel query={request}>
        {(data) =>
          data.status === "pending_review" ? (
            <div className="space-y-6">
              <Panel title="Employee Request to Update Salary Account">
                <div className="divide-y divide-border/70">
                  <SummaryRow label="Employee" value={`${data.employeeName} (${data.staffId})`} />
                  <SummaryRow
                    label="Current nominated salary account"
                    value={`${data.currentBank} ${data.currentAccountMasked}`}
                  />
                  <SummaryRow
                    label="Requested salary account"
                    value={`PayBridge Salary Account — ${data.newPartnerBank} ${data.newAccountMasked}`}
                    emphasis
                  />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  This request does not change the employee's salary, payroll calculation,
                  employment terms or your existing payroll process.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  It only changes the bank account to which the participating employee has
                  voluntarily instructed the employer to send salary.
                </p>

                <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    What changes for HR?
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">
                    One field: the employee's salary account number.
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    What does not change?
                  </p>
                  <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-3">
                    {UNCHANGED.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </Panel>

              <Panel
                title="Employee Salary Account Instruction"
                description="Shown to the employer for review — this is the employee's own digitally signed request, not something HR fills in."
              >
                <div className="space-y-3">
                  {EMPLOYEE_INSTRUCTION_TEXT.map((line) => (
                    <p key={line} className="text-sm leading-relaxed text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
                <ul className="mt-4 space-y-2">
                  {CONSENT_CHECKLIST.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 divide-y divide-border/70 border-t border-border/70 pt-1">
                  <SummaryRow label="Signed digitally by employee" value={data.employeeName} />
                  <SummaryRow label="Date / time" value={dateTime(data.consent.signedAt)} />
                  <SummaryRow label="Device / IP reference" value={data.consent.deviceRef} />
                  <SummaryRow label="Consent reference ID" value={data.consent.consentReferenceId} />
                </div>
              </Panel>

              <Panel
                title="Employer Protection Notice"
                action={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Subject to Legal Review
                  </span>
                }
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Demo legal wording — subject to counsel approval
                </p>
                <div className="mt-3 space-y-3">
                  {PROTECTION_NOTICE.map((line) => (
                    <p key={line} className="text-sm leading-relaxed text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
                <InfoNote tone="attention" className="mt-4">
                  Final legal language will be governed by the executed PayBridge Employer
                  Agreement. This wording is not final contractual wording.
                </InfoNote>
              </Panel>

              <div className="flex flex-wrap gap-3">
                <ActionButton onClick={() => setConfirming("approved")}>
                  Approve Salary Account Change
                </ActionButton>
                <ActionButton variant="danger" onClick={() => setConfirming("rejected")}>
                  Reject Request
                </ActionButton>
              </div>

              <Modal
                open={confirming === "approved"}
                onClose={() => {
                  setConfirming(null);
                  setAuthorised(false);
                }}
                title="Approve employee salary-account update?"
                description="You are confirming the employee's voluntary instruction to update the salary account held in your payroll records."
                footer={
                  <>
                    <ActionButton variant="secondary" onClick={() => setConfirming(null)}>
                      Cancel
                    </ActionButton>
                    <ActionButton
                      disabled={!authorised}
                      loading={decide.isPending}
                      onClick={() => decide.mutate("approved")}
                    >
                      Approve & Update
                    </ActionButton>
                  </>
                }
              >
                <p className="text-sm leading-relaxed text-muted-foreground">
                  No PayBridge financial obligation is being assumed by the employer through this
                  action.
                </p>
                <label className="mt-4 flex items-start gap-2.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={authorised}
                    onChange={(e) => setAuthorised(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  I confirm that I am authorised to update employee payroll bank details.
                </label>
              </Modal>

              <Modal
                open={confirming === "rejected"}
                onClose={() => setConfirming(null)}
                title="Reject this request?"
                footer={
                  <>
                    <ActionButton variant="secondary" onClick={() => setConfirming(null)}>
                      Cancel
                    </ActionButton>
                    <ActionButton variant="danger" loading={decide.isPending} onClick={() => decide.mutate("rejected")}>
                      Reject Request
                    </ActionButton>
                  </>
                }
              >
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The employee keeps their current salary account. They can submit a new request
                  later if they wish.
                </p>
              </Modal>
            </div>
          ) : (
            <Panel title={data.status === "active" ? "Salary Account Updated" : "Request decided"}>
              <div className="divide-y divide-border/70">
                <SummaryRow label="Employee" value={data.employeeName} />
                <SummaryRow
                  label="New payroll destination"
                  value={`PayBridge Salary Account — ${data.newPartnerBank} ${data.newAccountMasked}`}
                />
                <SummaryRow label="Status" value={<StatusBadge status={salaryAccountStatusLabel(data.status)} />} />
              </div>
              {data.status === "active" ? (
                <>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Continue processing this employee through your normal payroll process.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    On payday, send salary to the account above as part of your normal
                    salary-payment file.
                  </p>
                  <p className="mt-5 font-display text-xl font-bold text-foreground">
                    One payroll. Nothing else changes.
                  </p>
                </>
              ) : null}
              <div className="mt-5">
                <ActionButton variant="secondary" onClick={() => navigate("/employer/salary-account-requests")}>
                  Back to requests
                </ActionButton>
              </div>
            </Panel>
          )
        }
      </AsyncPanel>
        }
      />
    </div>
  );
}
