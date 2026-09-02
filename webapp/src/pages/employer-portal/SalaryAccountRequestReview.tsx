import { useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, SummaryRow } from "@/components/dashboard/Panel";
import { ConfirmDialog, Modal } from "@/components/dashboard/Modal";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CheckboxField } from "@/components/dashboard/forms";
import {
  salaryAccountStatusLabel,
  useDecideSalaryAccountRequest,
  useSalaryAccountRequest,
} from "@/lib/employer/salary-account";

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

const PROTECTION_NOTICE = [
  "PayBridge Access is an employee-elected financial service provided independently of the employer.",
  "The employer's participation is limited to verifying eligible employment information, processing approved salary-account instructions and providing information reasonably required for payroll settlement and reconciliation.",
  "The employer does not provide the advance, determine the employee's use of funds, manage the employee's PayBridge Account, or provide investment, credit or other financial advice.",
  "To the extent permitted by applicable law and the definitive PayBridge Employer Agreement, PayBridge will be responsible for obligations arising from PayBridge's platform operations, settlement instructions and participating financial-service providers, except to the extent that a loss results from inaccurate payroll information, unauthorised employer action, fraud, gross negligence or wilful misconduct by the employer or its authorised representatives.",
];

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Real counterpart of the demo-only mock "SalaryAccountRequestReview" screen
 * (AGENTS.md §9). HR's whole action, same as the mock: change one payroll
 * field, nothing else — approving does not move money or touch payroll
 * calculation, it only updates the destination account this employee's
 * salary is recorded against.
 */
export default function EmployerPortalSalaryAccountRequestReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const request = useSalaryAccountRequest(id ?? null);
  const decide = useDecideSalaryAccountRequest();

  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [authorised, setAuthorised] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = request.data;

  if (request.isLoading) {
    return <PageHeader title="Employee Request to Update Salary Account" description="Loading…" />;
  }

  async function submitDecision(decision: "approve" | "reject") {
    if (!id) return;
    setError(null);
    try {
      await decide.mutateAsync({ id, input: { decision, confirmedAuthorised: true } });
      setConfirming(null);
      setAuthorised(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be saved.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Employee Request to Update Salary Account" />

      {!data ? (
        <Panel title="Not found" description="This request does not exist, or does not belong to your company." />
      ) : data.status === "pending_review" ? (
        <>
          <Panel title="Employee Request to Update Salary Account">
            <SummaryRow label="Employee" value={`${data.employeeName ?? "—"} (${data.staffRef})`} />
            <SummaryRow
              label="Current nominated salary account"
              value={data.currentBankName ? `${data.currentBankName} ${data.currentAccountMasked}` : "None on file"}
            />
            <SummaryRow
              label="Requested salary account"
              value={`PayBridge Salary Account — ${data.newBankName} ${data.newAccountMasked}`}
              emphasis
            />
            <p className="mt-3 text-sm text-muted-foreground">
              This request does not change the employee's salary, payroll calculation, employment terms or your
              existing payroll process. It only changes the bank account to which the participating employee has
              voluntarily instructed the employer to send salary.
            </p>
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3">
              <p className="text-sm font-semibold text-foreground">What changes for HR?</p>
              <p className="mt-1 text-sm text-muted-foreground">One field: the employee's salary account number.</p>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">What does not change?</p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {UNCHANGED.map((item) => (
                  <li key={item} className="text-xs text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel
            title="Employee Salary Account Instruction"
            description="Shown to the employer for review — this is the employee's own digitally signed request, not something HR fills in."
          >
            <div className="space-y-2.5">
              {EMPLOYEE_INSTRUCTION_TEXT.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
              {[
                "I have reviewed the PayBridge Access Terms",
                "I authorise this salary-account update",
                "I authorise applicable settlement instructions",
                "I consent to the processing and sharing of information required for payroll settlement and reconciliation",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-border/70 pt-3">
              <SummaryRow label="Signed digitally by employee" value={data.employeeName ?? "—"} />
              <SummaryRow label="Date / time" value={dateTime(data.consent.signedAt)} />
              <SummaryRow label="Device / IP reference" value={data.consent.deviceRef ?? "—"} />
              <SummaryRow label="Consent reference ID" value={data.consent.consentReferenceId} />
            </div>
          </Panel>

          <Panel
            title="Employer Protection Notice"
            icon={<ShieldAlert className="h-4 w-4 text-gold" />}
            action={
              <span className="rounded-full border border-gold/45 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
                Subject to Legal Review
              </span>
            }
            description="Demo-adjacent legal wording — subject to counsel approval."
          >
            <div className="space-y-2.5">
              {PROTECTION_NOTICE.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          </Panel>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={() => setConfirming("approve")}>Approve Salary Account Change</ActionButton>
            <ActionButton variant="danger" onClick={() => setConfirming("reject")}>
              Reject Request
            </ActionButton>
          </div>

          <Modal
            open={confirming === "approve"}
            onClose={() => {
              setConfirming(null);
              setAuthorised(false);
            }}
            title="Approve employee salary-account update?"
            description="You are confirming the employee's voluntary instruction to update the salary account held in your payroll records."
            footer={
              <>
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    setConfirming(null);
                    setAuthorised(false);
                  }}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  disabled={!authorised}
                  loading={decide.isPending}
                  onClick={() => void submitDecision("approve")}
                >
                  Approve &amp; Update
                </ActionButton>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">
              No PayBridge financial obligation is being assumed by the employer through this action.
            </p>
            <div className="mt-3">
              <CheckboxField checked={authorised} onChange={setAuthorised} required>
                I confirm that I am authorised to update employee payroll bank details.
              </CheckboxField>
            </div>
          </Modal>

          <ConfirmDialog
            open={confirming === "reject"}
            onClose={() => setConfirming(null)}
            onConfirm={() => void submitDecision("reject")}
            title="Reject this request?"
            description="The employee keeps their current salary account. They can submit a new request later if they wish."
            confirmLabel="Reject Request"
            tone="danger"
            loading={decide.isPending}
          />
        </>
      ) : (
        <Panel title={data.status === "active" ? "Salary Account Updated" : "Request decided"}>
          <SummaryRow label="Employee" value={data.employeeName ?? "—"} />
          <SummaryRow
            label="New payroll destination"
            value={`PayBridge Salary Account — ${data.newBankName} ${data.newAccountMasked}`}
          />
          <SummaryRow label="Status" value={<StatusBadge status={salaryAccountStatusLabel(data.status)} />} />
          {data.status === "active" ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Continue processing this employee through your normal payroll process.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                On payday, send salary to the account above as part of your normal salary-payment file.
              </p>
              <p className="mt-3 text-sm font-bold text-foreground">One payroll. Nothing else changes.</p>
            </>
          ) : null}
          <ActionButton
            className="mt-4"
            variant="secondary"
            onClick={() => navigate("/employer-portal/salary-account-requests")}
          >
            Back to requests
          </ActionButton>
        </Panel>
      )}
    </div>
  );
}
