import { cn } from "@/lib/utils";

/**
 * One badge for every status in the platform. Tone is derived from meaning, not
 * from the module, so a "Settled" Bridge and a "Matched" reconciliation read the
 * same everywhere. Calm by default — red is reserved for genuine failure.
 */

type Tone = "positive" | "progress" | "neutral" | "attention" | "negative" | "brand";

/* Bright teal is the finish line and steel is the machinery: "Settled" is
   teal, "Disbursed" is steel. Before the two were split, every badge was one
   colour, which meant a screen full of them gave no read at a glance. */
const TONE_CLASS: Record<Tone, string> = {
  positive: "border-success/40 bg-success/10 text-success",
  progress: "border-protected/40 bg-protected/10 text-protected",
  neutral: "border-border bg-secondary/70 text-muted-foreground",
  attention: "border-gold/45 bg-gold/10 text-gold",
  negative: "border-destructive/40 bg-destructive/10 text-destructive",
  brand: "border-primary/40 bg-primary/10 text-primary",
};

const STATUS_TONE: Record<string, Tone> = {
  // transactions
  Initiated: "neutral",
  Approved: "progress",
  Processing: "progress",
  Disbursed: "brand",
  Settled: "positive",
  Failed: "negative",
  Reversed: "attention",
  Overdue: "negative",
  // employer applications
  "New application": "neutral",
  "Documents pending": "attention",
  "Under review": "progress",
  "Credit assessment": "progress",
  Rejected: "negative",
  Suspended: "negative",
  // reconciliation
  Matched: "positive",
  "Partially matched": "attention",
  Unmatched: "neutral",
  Investigating: "progress",
  Resolved: "positive",
  // risk
  Low: "positive",
  Moderate: "attention",
  High: "negative",
  Critical: "negative",
  // kyc / kyb
  "Not started": "neutral",
  "In progress": "progress",
  Submitted: "progress",
  Verified: "positive",
  // buffers
  Draft: "neutral",
  "Offer issued": "attention",
  Accepted: "progress",
  Funded: "brand",
  Repaying: "progress",
  Repaid: "positive",
  Declined: "negative",
  // payroll
  Validated: "progress",
  Reconciled: "positive",
  // compliance / risk workflow
  Open: "attention",
  "In review": "progress",
  Escalated: "negative",
  Cleared: "positive",
  Reported: "neutral",
  Monitoring: "progress",
  Mitigated: "positive",
  Closed: "neutral",
  // tickets
  "Waiting on customer": "attention",
  Urgent: "negative",
  Normal: "neutral",
  // investments
  "Pending funding": "attention",
  Active: "positive",
  Maturing: "progress",
  Matured: "neutral",
  Withdrawn: "neutral",
  // repayments / withdrawals
  Scheduled: "progress",
  "Part paid": "attention",
  Paid: "positive",
  Requested: "neutral",
  // eligibility
  Eligible: "positive",
  "Not eligible": "neutral",
  Paused: "attention",
  // employment status
  Probation: "progress",
  "On paid leave": "progress",
  "On unpaid leave": "attention",
  "Notice period": "attention",
  Resigned: "neutral",
  Terminated: "negative",
  // payroll record confirmation
  Confirmed: "positive",
  "Pending review": "attention",
  "On hold": "attention",
  // exception severity and workflow
  Informational: "neutral",
  "Review required": "attention",
  "Information requested": "progress",
  // payroll cycle
  "On track": "positive",
  "Funding required": "attention",
  "Approval pending": "progress",
  Completed: "positive",
  "Reconciliation required": "attention",
  "Awaiting review": "attention",
  "Awaiting authorisation": "progress",
  // integrations and sync
  Connected: "positive",
  Sandbox: "brand",
  Degraded: "attention",
  "Not connected": "neutral",
  Healthy: "positive",
  Success: "positive",
  Partial: "attention",
  Late: "attention",
  Deferred: "attention",
};

export function StatusBadge({
  status,
  className,
  dot = true,
}: {
  status: string;
  className?: string;
  dot?: boolean;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {status}
    </span>
  );
}

export function RiskPill({ level }: { level: string }) {
  return <StatusBadge status={level} dot={false} />;
}
