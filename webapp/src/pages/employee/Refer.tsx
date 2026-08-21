import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Gift, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { TextField } from "@/components/dashboard/forms";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { employeeApi, qk } from "@/lib/platform/mock-service";
import { naira, shortDate } from "@/lib/platform/format";
import { useAccountId } from "@/lib/platform/use-account";

export default function EmployeeReferPage() {
  const employeeId = useAccountId("employee");
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: qk.employeeOverview(employeeId),
    queryFn: () => employeeApi.overview(employeeId),
  });
  const referrals = useQuery({
    queryKey: qk.employeeReferrals(employeeId),
    queryFn: () => employeeApi.referrals(employeeId),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: () => employeeApi.sendReferral({ employeeId, name, email }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.employeeReferrals(employeeId) });
      setOpen(false);
      setName("");
      setEmail("");
      toast.success("Invite sent");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "We could not send that invite"),
  });

  const code = overview.data?.employee.referralCode;
  const rows = referrals.data ?? [];
  const joined = rows.filter((r) => r.status === "Joined");
  const earned = joined.reduce((sum, r) => sum + r.rewardAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Refer & Earn"
        title="Bring your colleagues to PayBridge"
        description="Share your code. When someone you refer joins and completes verification, a reward is credited to your PayBridge Account."
        actions={
          <ActionButton icon={<Share2 className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Refer someone
          </ActionButton>
        }
      />

      <StatGrid columns={3}>
        <StatCard label="People invited" value={`${rows.length}`} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Joined PayBridge"
          value={`${joined.length}`}
          hint="Reward paid once verification completes"
          tone="success"
        />
        <StatCard label="Total earned" value={naira(earned)} tone="protected" icon={<Gift className="h-4 w-4" />} />
      </StatGrid>

      <Panel title="Your referral code" description="Anyone who signs up with this code is linked to you.">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!code) return;
              void navigator.clipboard?.writeText(code);
              toast.success("Referral code copied");
            }}
            disabled={!code}
            className="inline-flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/[0.06] px-4 py-2.5 font-display text-lg font-extrabold tracking-wide text-primary"
          >
            {code ?? "—"}
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <InfoNote tone="primary" className="mt-4">
          Every successful referral earns {naira(2_000)}, credited once your colleague joins and completes their
          verification. Demo figures — final reward terms are set by PayBridge policy.
        </InfoNote>
      </Panel>

      <Panel title="Your referrals" bodyClassName="p-0 sm:p-0">
        <AsyncPanel query={referrals}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState
                title="No referrals yet"
                body="Invite a colleague to start earning."
                icon={<Users className="h-5 w-5" />}
                action={
                  <ActionButton size="sm" onClick={() => setOpen(true)}>
                    Refer someone
                  </ActionButton>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {list.map((referral) => (
                  <li key={referral.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{referral.referredName}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {referral.referredEmail} · invited {shortDate(referral.invitedAt)}
                        {referral.joinedAt ? ` · joined ${shortDate(referral.joinedAt)}` : ""}
                      </span>
                    </span>
                    {referral.status === "Joined" ? (
                      <span className="shrink-0 text-sm font-semibold text-success tnum">
                        +{naira(referral.rewardAmount)}
                      </span>
                    ) : null}
                    <StatusBadge status={referral.status} />
                  </li>
                ))}
              </ul>
            )
          }
        </AsyncPanel>
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Refer a colleague"
        description="We will send them an invite with your referral code attached."
        footer={
          <>
            <ActionButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              loading={invite.isPending}
              disabled={name.trim().length < 2 || !email.includes("@")}
              onClick={() => invite.mutate()}
            >
              Send invite
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label="Their name" value={name} onChange={setName} placeholder="Full name" />
          <TextField label="Their email" value={email} onChange={setEmail} inputMode="email" placeholder="name@example.com" />
        </div>
      </Modal>
    </div>
  );
}
