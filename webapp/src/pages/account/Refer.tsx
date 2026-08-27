import { useState } from "react";
import { Copy, Gift, Users } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { TextField } from "@/components/dashboard/forms";
import { useMyReferrals, useSendReferral } from "@/lib/account/session";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Real counterpart of the demo-only mock referral system (AGENTS.md §10).
 * The reward is a real Savings deposit once a referral joins — see
 * backend/src/routes/auth.ts's register handler — not an unexplained number.
 */
export default function Refer() {
  const referrals = useMyReferrals(true);
  const sendReferral = useSendReferral();

  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const items = referrals.data?.items ?? [];

  const submit = async () => {
    setError(null);
    try {
      await sendReferral.mutateAsync({ name, email });
      setInviting(false);
      setName("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send that invite.");
    }
  };

  const copyCode = () => {
    if (!referrals.data?.code) return;
    void navigator.clipboard.writeText(referrals.data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AccountLayout
      eyebrow="Refer & Earn"
      title="Bring your colleagues to PayBridge"
      description="Share your code. When someone you refer joins and completes verification, a reward is recorded to your PayBridge savings."
      actions={
        <ActionButton icon={<Gift className="h-4 w-4" />} onClick={() => setInviting(true)}>
          Refer someone
        </ActionButton>
      }
    >
      <StatGrid columns={3}>
        <StatCard label="People invited" value={referrals.data?.invited ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Joined PayBridge"
          value={referrals.data?.joined ?? 0}
          hint="Reward recorded once verification completes"
          tone="success"
        />
        <StatCard
          label="Total earned"
          value={`₦${(referrals.data?.totalEarned ?? 0).toLocaleString("en-NG")}`}
          tone="protected"
          icon={<Gift className="h-4 w-4" />}
        />
      </StatGrid>

      <Panel title="Your referral code">
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-2.5 text-sm font-semibold text-foreground hover:border-primary/50 hover:text-primary"
        >
          {referrals.data?.code ?? "—"}
          <Copy className="h-3.5 w-3.5" />
        </button>
        {copied ? <span className="ml-2 text-xs text-success">Referral code copied</span> : null}
        <p className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3 text-xs leading-relaxed text-foreground/90">
          Every successful referral earns ₦2,000, recorded to your PayBridge savings once your colleague joins and
          completes their verification. Reward terms are set by PayBridge policy and may change.
        </p>
      </Panel>

      <Panel title="Your referrals">
        {items.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-foreground">No referrals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Invite a colleague to start earning.</p>
            <ActionButton size="sm" className="mt-3" onClick={() => setInviting(true)}>
              Refer someone
            </ActionButton>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.referredName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.referredEmail} · invited {shortDate(r.invitedAt)}
                    {r.joinedAt ? ` · joined ${shortDate(r.joinedAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {r.status === "joined" ? (
                    <span className="text-sm font-semibold text-success">+₦{r.rewardAmount.toLocaleString("en-NG")}</span>
                  ) : null}
                  <StatusBadge status={r.status === "joined" ? "Joined" : "Invited"} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Refer a colleague"
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setInviting(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              onClick={() => void submit()}
              loading={sendReferral.isPending}
              disabled={name.trim().length < 2 || !email.includes("@")}
            >
              Send invite
            </ActionButton>
          </>
        }
      >
        <div className="space-y-3">
          <TextField label="Their name" value={name} onChange={setName} placeholder="Full name" />
          <TextField
            label="Their email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
            inputMode="email"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </Modal>
    </AccountLayout>
  );
}
