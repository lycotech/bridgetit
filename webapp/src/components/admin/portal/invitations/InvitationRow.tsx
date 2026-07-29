import { useState } from "react";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  ChevronDown,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INVITATION_STATUS_TONE,
  useExtendInvitation,
  useResendInvitation,
  useRevokeInvitation,
  type IssuedInvitation,
} from "@/lib/admin/invitations";
import {
  DEMO_TYPE_LABELS,
  INVITATION_STATUS_LABELS,
  type InvitationView,
} from "../../../../../../backend/src/types";

/** `datetime-local` value for a date, in local time. */
function toLocalInput(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * One invitation, with the three things an administrator does to it.
 *
 * "Resend" is labelled honestly. It does not resend the original code — the
 * server cannot read it — it issues a new one and retires the old. Calling that
 * button "Resend" while silently changing the code is how someone ends up
 * reading a dead code down the phone, so the confirmation says what will happen.
 */
export function InvitationRow({
  invitation,
  onReissued,
}: {
  invitation: InvitationView;
  onReissued: (issued: IssuedInvitation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"none" | "resend" | "extend" | "revoke">("none");
  const [expiresAt, setExpiresAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 72 * 60 * 60 * 1000)),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resend = useResendInvitation();
  const extend = useExtendInvitation();
  const revoke = useRevokeInvitation();
  const busy = resend.isPending || extend.isPending || revoke.isPending;

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      setAction("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  };

  const expiry = new Date(invitation.expiresAt);
  const finished = invitation.status === "revoked" || invitation.status === "used";

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {invitation.inviteeName ?? invitation.email}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                INVITATION_STATUS_TONE[invitation.status],
              )}
            >
              {INVITATION_STATUS_LABELS[invitation.status]}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {invitation.email}
            {invitation.organisation ? ` · ${invitation.organisation}` : ""} ·{" "}
            {DEMO_TYPE_LABELS[invitation.demoType]}
          </p>
          <p className="mt-1 font-mono text-xs tracking-wider text-muted-foreground">
            {invitation.codeHint} · expires {expiry.toLocaleString()} · used {invitation.useCount}/
            {invitation.maxUses}
          </p>
        </div>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border bg-background/40 px-5 py-4">
          <dl className="grid gap-3 text-xs sm:grid-cols-3">
            <Detail label="Issued by" value={invitation.issuedBy} />
            <Detail label="Created" value={new Date(invitation.createdAt).toLocaleString()} />
            <Detail
              label="Sent"
              value={
                invitation.sendCount === 0
                  ? "Never emailed"
                  : `${invitation.sendCount}× · last ${invitation.lastSentAt ? new Date(invitation.lastSentAt).toLocaleString() : "—"}`
              }
            />
            <Detail
              label="First opened"
              value={invitation.openedAt ? new Date(invitation.openedAt).toLocaleString() : "Not yet"}
            />
            <Detail
              label="First used"
              value={invitation.redeemedAt ? new Date(invitation.redeemedAt).toLocaleString() : "Not yet"}
            />
            <Detail
              label="Expiry extended"
              value={invitation.extendedAt ? new Date(invitation.extendedAt).toLocaleString() : "No"}
            />
          </dl>

          {invitation.internalNote ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Internal note — never sent to the invitee
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {invitation.internalNote}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          {/* ------------------------------------------------- Action prompts */}

          {action === "resend" ? (
            <Confirm
              title="Issue a new code and email it?"
              body={`${invitation.email} will receive a fresh code. The current code ${invitation.codeHint} stops working immediately — we cannot resend it, because only its hash is stored.`}
              confirmLabel="Issue a new code"
              busy={busy}
              onCancel={() => setAction("none")}
              onConfirm={() => run(async () => onReissued(await resend.mutateAsync(invitation.id)))}
            />
          ) : null}

          {action === "extend" ? (
            <div className="space-y-3 rounded-xl border border-border bg-card/70 p-4">
              <p className="text-sm font-semibold text-foreground">Move the expiry</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The code itself does not change. If the invitee already has it, they can keep using it until the new
                expiry.
              </p>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      extend.mutateAsync({
                        id: invitation.id,
                        expiresAt: new Date(expiresAt).toISOString(),
                      }),
                    )
                  }
                >
                  {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Save expiry
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction("none")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {action === "revoke" ? (
            <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/[0.06] p-4">
              <p className="text-sm font-semibold text-foreground">Withdraw this invitation</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The code stops working at once. The invitation stays in this list with its history — nothing is deleted.
              </p>
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason (kept with the invitation, staff only)"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => run(() => revoke.mutateAsync({ id: invitation.id, reason: reason.trim() }))}
                >
                  {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Revoke
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction("none")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {action === "none" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAction("resend")} disabled={finished}>
                <Send className="mr-2 h-3.5 w-3.5" />
                Resend with a new code
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAction("extend")}
                disabled={invitation.status === "revoked"}
              >
                <CalendarClock className="mr-2 h-3.5 w-3.5" />
                Extend expiry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setAction("revoke")}
                disabled={invitation.status === "revoked"}
              >
                <Ban className="mr-2 h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          ) : null}

          {finished && action === "none" ? (
            <p className="text-xs text-muted-foreground">
              {invitation.status === "revoked"
                ? "This invitation was withdrawn. Create a new one if access is needed again."
                : "This invitation has been fully used. Create a new one if access is needed again."}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs text-foreground">{value}</dd>
    </div>
  );
}

function Confirm({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/70 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onConfirm}>
          {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          {confirmLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
