import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  Clock3,
  FileWarning,
  LifeBuoy,
  Lock,
  PiggyBank,
  Receipt,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import {
  useBridgeDraws,
  useCreateInvestmentCommitment,
  useCreateSavingsGoal,
  useEligibility,
  useInvestmentCommitments,
  useKycStatus,
  usePortfolioSnapshot,
  useRequestBridgeDraw,
  useSavingsDeposit,
  useSavingsGoals,
  useSavingsWithdraw,
  useSession,
  useWithdrawInvestmentCommitment,
} from "@/lib/account/session";

/**
 * The customer's own account screen. One page, four faces, chosen by the gate
 * the SERVER computed — pending, rejected, approved or suspended.
 *
 * The locked feature list below is presentational only. Nothing on this page can
 * open a regulated feature, because those endpoints sit behind
 * `requireFinancialAccess` on the server and this build has no client-side path
 * to them at all until the gate is `active`.
 */

const LOCKED_FEATURES = [
  { icon: Zap, label: "Bridge — access earned pay", note: "Available once verified" },
  { icon: Receipt, label: "Transactions", note: "Available once verified" },
  { icon: PiggyBank, label: "Savings", note: "Available once verified" },
  { icon: TrendingUp, label: "Investments", note: "Available once verified" },
];

function LockedFeatures() {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Lock className="h-4 w-4 text-muted-foreground" />
        Locked until verification is approved
      </p>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {LOCKED_FEATURES.map((feature) => (
          <li
            key={feature.label}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-3"
          >
            <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-muted-foreground">{feature.label}</span>
              <span className="block text-xs text-muted-foreground/70">{feature.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        PayBridge cannot offer earned-income access, savings or investment features to an account that has not
        completed identity verification. This is a licensing requirement, not a setting.
      </p>
    </div>
  );
}

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: "info" | "warning" | "success" | "danger";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-primary/30 bg-primary/[0.06]",
    warning: "border-amber-500/40 bg-amber-500/[0.07]",
    success: "border-primary/40 bg-primary/[0.06]",
    danger: "border-destructive/40 bg-destructive/10",
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="flex items-center gap-2.5 font-display text-base font-extrabold text-foreground">
        {icon}
        {title}
      </p>
      <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>
      {ok ? (
        <Check className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      )}
      {label}
    </li>
  );
}

/**
 * The real Bridge eligibility checklist — PRD.md's Business Rules, computed
 * server-side from actual employer/payroll/KYC state (backend/src/routes/
 * employee-link.ts). See `BridgeRequestSection` below for the actual draw
 * request, which reads this same eligibility server-side before deciding.
 */
function EligibilitySection() {
  const { data } = useEligibility(true);
  if (!data) return null;

  return (
    <Panel
      tone={data.eligible ? "success" : "info"}
      icon={<Zap className="h-5 w-5 text-primary" />}
      title="Bridge eligibility"
    >
      <ul className="space-y-1.5">
        <CheckRow ok={data.employmentVerified} label="Employment verified with your employer" />
        <CheckRow ok={data.employerActive} label={`Employer account active${data.employerName ? ` (${data.employerName})` : ""}`} />
        <CheckRow ok={data.payrollVerified} label="Payroll on file" />
        <CheckRow ok={data.kycApproved} label="Identity verified" />
      </ul>

      {data.eligible && data.earnedWageEstimate !== null ? (
        <p className="pt-1 text-sm">
          Estimated earned so far this period:{" "}
          <span className="font-semibold text-foreground">
            ₦{data.earnedWageEstimate.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </span>
        </p>
      ) : data.reasons.length > 0 ? (
        <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
          {data.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

/**
 * The real Bridge draw request — backend/src/routes/bridge.ts. Approval is
 * instant and deterministic: it checks the same eligibility as the panel
 * above, plus the employer's real, staff-approved `ewa` CreditLimit capacity
 * (set via the credit-risk decision at /admin/risk). Nothing here moves
 * money — see AGENTS.md, "Disbursement/Repayment" for what's still missing.
 */
function BridgeRequestSection() {
  const { data: eligibility } = useEligibility(true);
  const draws = useBridgeDraws(true);
  const request = useRequestBridgeDraw();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; reference: string; reason: string | null } | null>(null);

  if (!eligibility?.eligible) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    try {
      const draw = await request.mutateAsync({ amount: value });
      setResult({ status: draw.status, reference: draw.reference, reason: draw.rejectionReason });
      if (draw.status === "approved") setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That request could not be processed.");
    }
  };

  return (
    <Panel tone="info" icon={<Zap className="h-5 w-5 text-primary" />} title="Request a Bridge">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          Amount (₦)
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5 block h-11 w-40 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
          />
        </label>
        <ActionButton type="submit" loading={request.isPending}>
          Request
        </ActionButton>
      </form>

      {error ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {result ? (
        <p className={`mt-3 text-sm ${result.status === "approved" ? "text-success" : "text-destructive"}`}>
          {result.status === "approved"
            ? `Approved — reference ${result.reference}.`
            : `Not approved (${result.reference}): ${result.reason}`}
        </p>
      ) : null}

      {draws.data?.items.length ? (
        <div className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
          {draws.data.items.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {d.reference} · {d.status}
              </span>
              <span className="tnum">₦{d.requestedAmount.toLocaleString("en-NG")}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

/**
 * Savings — a self-service ledger, not a bank account. backend/src/routes/
 * savings.ts: no bank rail exists yet, so a deposit/withdrawal here is a
 * self-reported bookkeeping entry, not money PayBridge actually moved. This
 * is stated to the user, not hidden.
 */
function SavingsSection() {
  const goals = useSavingsGoals(true);
  const createGoal = useCreateSavingsGoal();
  const deposit = useSavingsDeposit();
  const withdraw = useSavingsWithdraw();

  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyGoal, setBusyGoal] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const createGoalSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    await createGoal.mutateAsync({ label });
    setLabel("");
    setCreating(false);
  };

  const act = async (goalId: string, kind: "deposit" | "withdraw") => {
    const amount = Number(amounts[goalId]);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusyGoal(goalId);
    setMessage(null);
    try {
      if (kind === "deposit") await deposit.mutateAsync({ goalId, amount });
      else await withdraw.mutateAsync({ goalId, amount });
      setAmounts((prev) => ({ ...prev, [goalId]: "" }));
      setMessage(kind === "deposit" ? "Deposit recorded." : "Withdrawal recorded.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That could not be recorded.");
    } finally {
      setBusyGoal(null);
    }
  };

  return (
    <Panel tone="info" icon={<PiggyBank className="h-5 w-5 text-primary" />} title="Savings">
      <p className="text-xs text-muted-foreground">
        A self-service savings ledger — amounts you record yourself. Not connected to a bank account yet.
      </p>

      <div className="mt-3 space-y-3">
        {goals.data?.items.map((g) => (
          <div key={g.id} className="rounded-xl border border-border bg-secondary/30 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{g.label}</p>
              <p className="text-sm font-bold tnum text-foreground">
                ₦{g.balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={amounts[g.id] ?? ""}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                className="h-9 w-32 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
              />
              <ActionButton size="sm" variant="secondary" loading={busyGoal === g.id} onClick={() => void act(g.id, "deposit")}>
                Deposit
              </ActionButton>
              <ActionButton size="sm" variant="ghost" loading={busyGoal === g.id} onClick={() => void act(g.id, "withdraw")}>
                Withdraw
              </ActionButton>
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}

      {creating ? (
        <form onSubmit={createGoalSubmit} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <input
            type="text"
            placeholder="Goal name, e.g. Rent buffer"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
          <ActionButton type="submit" size="sm" loading={createGoal.isPending}>
            Create
          </ActionButton>
        </form>
      ) : (
        <ActionButton size="sm" variant="ghost" className="mt-3" onClick={() => setCreating(true)}>
          + New savings goal
        </ActionButton>
      )}
    </Panel>
  );
}

/**
 * Investments — capital-partner accounts only. backend/src/routes/
 * investments.ts: a commitment is recorded, not transferred, and the
 * portfolio snapshot reports real numbers with no fabricated return figure.
 */
function InvestmentSection() {
  const commitments = useInvestmentCommitments(true);
  const portfolio = usePortfolioSnapshot(true);
  const commit = useCreateInvestmentCommitment();
  const withdraw = useWithdrawInvestmentCommitment();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    try {
      await commit.mutateAsync({ amount: value });
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That commitment could not be recorded.");
    }
  };

  return (
    <Panel tone="info" icon={<TrendingUp className="h-5 w-5 text-primary" />} title="Investments">
      <p className="text-xs text-muted-foreground">
        Commit capital to PayBridge's lending book. Recorded here, not yet transferred — no payment rail exists for
        this yet.
      </p>

      {portfolio.data ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Employers funded" value={portfolio.data.activeEmployers.toLocaleString()} />
          <Stat label="Total exposure" value={`₦${portfolio.data.totalApprovedExposure.toLocaleString("en-NG")}`} />
          <Stat label="Bridge draws" value={portfolio.data.bridgeDrawsApprovedCount.toLocaleString()} />
          <Stat label="Your committed capital" value={`₦${portfolio.data.yourCommittedCapital.toLocaleString("en-NG")}`} />
          <Stat label="Total committed (all investors)" value={`₦${portfolio.data.totalCommittedCapital.toLocaleString("en-NG")}`} />
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border/70 pt-3">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount to commit"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-10 w-44 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
        <ActionButton type="submit" size="sm" loading={commit.isPending}>
          Commit
        </ActionButton>
      </form>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {commitments.data?.items.length ? (
        <div className="mt-3 space-y-1.5">
          {commitments.data.items.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                ₦{c.amount.toLocaleString("en-NG")} · {c.status}
              </span>
              {c.status === "committed" ? (
                <button
                  type="button"
                  onClick={() => withdraw.mutate(c.id)}
                  className="font-semibold text-primary hover:underline"
                >
                  Withdraw
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
      <p className="text-sm font-bold tnum text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export default function AccountHome() {
  const { data: session } = useSession();
  const gate = session?.gate ?? "kyc_pending";
  const user = session?.user ?? null;
  // Not requested while suspended: the account's own KYC detail is irrelevant to
  // a blocked account and the endpoint would be refused anyway.
  const { data: kyc } = useKycStatus(gate === "kyc_pending" || gate === "kyc_rejected" || gate === "active");

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  if (gate === "suspended" || gate === "closed") {
    return (
      <AccountLayout
        title={gate === "closed" ? "This account is closed" : "This account is suspended"}
        description="You cannot sign in to PayBridge features while your account is in this state."
      >
        <Panel tone="danger" icon={<Ban className="h-5 w-5 text-destructive" />} title="Access blocked">
          {user?.suspendedReason ? <p>{user.suspendedReason}</p> : null}
          <p>
            Our support team can explain what happens next and what is needed to restore access. Email{" "}
            <a className="font-semibold text-primary hover:underline" href="mailto:support@getpaybridge.com">
              support@getpaybridge.com
            </a>{" "}
            from the address on your account.
          </p>
        </Panel>
        <ActionButton to="/contact" variant="secondary" icon={<LifeBuoy className="h-4 w-4" />}>
          Contact support
        </ActionButton>
      </AccountLayout>
    );
  }

  if (gate === "kyc_rejected") {
    return (
      <AccountLayout
        eyebrow="Identity verification"
        title="Your verification needs attention"
        description="We could not approve your submission. You can correct it and submit again."
      >
        <Panel tone="warning" icon={<FileWarning className="h-5 w-5 text-amber-500" />} title="What we found">
          <p>{user?.kycRejectionReason ?? kyc?.rejectionReason ?? "Please review your details and documents and submit again."}</p>
          <p className="text-xs text-muted-foreground">Reviewed {formatDate(kyc?.reviewedAt ?? user?.kycReviewedAt ?? null)}</p>
        </Panel>
        <ActionButton to="/verify-identity" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
          Update and resubmit
        </ActionButton>
        <LockedFeatures />
      </AccountLayout>
    );
  }

  if (gate === "kyc_pending") {
    return (
      <AccountLayout
        eyebrow="Identity verification"
        title="Verification in progress"
        description={`Thanks, ${firstName}. Your documents are with our review team.`}
      >
        <Panel tone="info" icon={<Clock3 className="h-5 w-5 text-primary" />} title="We are reviewing your submission">
          <p>
            Most reviews finish within one working day. We will email you at{" "}
            <span className="font-semibold">{user?.email}</span> as soon as there is a decision — you do not need to
            do anything else.
          </p>
          <dl className="grid gap-3 pt-1 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</dt>
              <dd className="text-sm font-medium">{formatDate(kyc?.submittedAt ?? user?.kycSubmittedAt ?? null)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents</dt>
              <dd className="text-sm font-medium">{kyc?.documents.length ?? 0} received</dd>
            </div>
          </dl>
        </Panel>
        <LockedFeatures />
      </AccountLayout>
    );
  }

  // gate === "active"
  return (
    <AccountLayout
      eyebrow="Verified account"
      title={`Welcome, ${firstName}`}
      description="Your identity is confirmed and your PayBridge account is open."
    >
      <Panel tone="success" icon={<BadgeCheck className="h-5 w-5 text-primary" />} title="Identity verified">
        <p>
          Approved {formatDate(kyc?.reviewedAt ?? user?.kycReviewedAt ?? null)}. Every PayBridge feature available to
          your account type is now unlocked.
        </p>
      </Panel>

      <EligibilitySection />
      <BridgeRequestSection />
      <SavingsSection />
      {user?.accountType === "investor" ? <InvestmentSection /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {LOCKED_FEATURES.map((feature) => (
          <div
            key={feature.label}
            className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-4"
          >
            <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{feature.label.split(" — ")[0]}</span>
              <span className="block text-xs text-muted-foreground">Ready to use</span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Your live dashboard is being connected to these features. In the meantime, our team can walk you through
        anything you need —{" "}
        <Link to="/contact" className="font-semibold text-primary hover:underline">
          get in touch
        </Link>
        .
      </p>
    </AccountLayout>
  );
}
