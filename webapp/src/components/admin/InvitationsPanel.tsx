import { useState } from "react";
import { Loader2, TicketCheck } from "lucide-react";
import { EmptyState } from "@/components/dashboard/states";
import { ErrorState } from "@/components/dashboard/states";
import { InvitationRow } from "@/components/admin/portal/invitations/InvitationRow";
import { CodeReveal } from "@/components/admin/portal/invitations/CodeReveal";
import { Modal } from "@/components/dashboard/Modal";
import { useInvitations, type IssuedInvitation } from "@/lib/admin/invitations";
import { InvitationForm } from "@/components/admin/InvitationForm";

/**
 * Issued invitations, for the operations console.
 *
 * The full manager — filters, counts, search — is at Admin → Demo invitations.
 * This is the same list with the same row actions, kept for the operations
 * console where invitations sit beside the access log.
 */
export function InvitationsPanel() {
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  const invitations = useInvitations({});

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <h3 className="font-display text-lg font-bold text-foreground">Issue an invitation</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          One code, one email address. Every invitation expires, is limited in uses, can be revoked, and is recorded
          when it is opened.
        </p>
        <div className="mt-4">
          <InvitationForm />
        </div>
      </div>

      <div className="min-w-0">
        {invitations.isPending ? (
          <div className="flex justify-center rounded-2xl border border-border bg-card/50 py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invitations.isError ? (
          <ErrorState
            body={invitations.error instanceof Error ? invitations.error.message : undefined}
            onRetry={invitations.refetch}
            className="rounded-2xl border border-border bg-card/50"
          />
        ) : (invitations.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<TicketCheck className="h-5 w-5" />}
            title="No invitations issued yet"
            body="Use the form to invite a named person into the demonstration."
            className="rounded-2xl border border-border bg-card/50"
          />
        ) : (
          <ul className="space-y-2.5">
            {invitations.data?.items.map((invitation) => (
              <InvitationRow key={invitation.id} invitation={invitation} onReissued={setIssued} />
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title="Invitation code"
        description="Copy it now — this is the only time it can be displayed."
        size="wide"
      >
        {issued ? <CodeReveal issued={issued} onDone={() => setIssued(null)} /> : null}
      </Modal>
    </div>
  );
}
