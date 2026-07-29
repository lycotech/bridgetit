import { useState } from "react";
import { InviteForm } from "@/components/admin/portal/invitations/InviteForm";
import { CodeReveal } from "@/components/admin/portal/invitations/CodeReveal";
import { Button } from "@/components/ui/button";
import type { IssuedInvitation } from "@/lib/admin/invitations";

/**
 * Issue a private-demo invitation, for the operations console and the
 * registration drawer.
 *
 * This is a thin adapter over the portal's InviteForm. It exists because two
 * older screens embed invitation creation inline and pass a registration to
 * pre-fill from; the invitation model itself lives in one place now.
 *
 * The previous version of this component issued a magic LINK. That mechanism is
 * gone: invitations are codes, entered by hand on the Private Demonstration
 * page alongside the invitee's email address, so a forwarded message is not on
 * its own enough to get in.
 */
export function InvitationForm({
  registrationId,
  defaultEmail = "",
  defaultName = "",
  onIssued,
}: {
  registrationId?: string;
  defaultEmail?: string;
  defaultName?: string;
  onIssued?: () => void;
}) {
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);

  if (issued) {
    return (
      <div className="space-y-4">
        <CodeReveal issued={issued} onDone={() => setIssued(null)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setIssued(null)}>
          Issue another invitation
        </Button>
      </div>
    );
  }

  return (
    <InviteForm
      registrationId={registrationId}
      defaultEmail={defaultEmail}
      defaultName={defaultName}
      onIssued={(next) => {
        setIssued(next);
        onIssued?.();
      }}
    />
  );
}
