import { useState } from "react";
import { Check, Copy, MailCheck, MailWarning, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import type { IssuedInvitation } from "@/lib/admin/invitations";
import { DEMO_TYPE_LABELS } from "../../../../../../backend/src/types";

/**
 * The one and only screen where a full invitation code is visible.
 *
 * This is a hard constraint of the design, not an oversight: the server stores
 * sha256 of the code, so once this panel closes the plaintext is gone from the
 * entire system. The copy says so plainly, because an administrator who assumes
 * they can look it up later will close this and then have to reissue.
 *
 * "Done" is a deliberate extra click rather than an auto-dismiss. A toast that
 * fades takes the code with it.
 */
export function CodeReveal({ issued, onDone }: { issued: IssuedInvitation; onDone: () => void }) {
  const [copied, setCopied] = useState<"none" | "code" | "message">("none");
  const invitation = issued.invitation;
  const expiry = new Date(invitation.expiresAt);

  /*
   * The wording here matches the invitation email so an administrator passing
   * the code on by hand — WhatsApp, a call, a different mail client — sends the
   * invitee the same instructions the automated message would have.
   */
  const message = [
    `You have been invited to a private demonstration of PayBridge.`,
    ``,
    `Access the demonstration using the email address associated with this invitation and the code below.`,
    ``,
    `Invitation code: ${issued.code}`,
    `Expiry: ${expiry.toLocaleString()}`,
    ``,
    `Visit getpaybridge.com and select Private Demonstration in the footer.`,
  ].join("\n");

  const copy = (what: "code" | "message") => {
    void navigator.clipboard.writeText(what === "code" ? issued.code : message);
    setCopied(what);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Invitation code</p>
        <p className="mt-2 select-all font-mono text-3xl font-bold tracking-[0.16em] text-foreground">{issued.code}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          For {invitation.inviteeName ?? invitation.email} · {DEMO_TYPE_LABELS[invitation.demoType]} · expires{" "}
          {expiry.toLocaleString()}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => copy("code")}>
            {copied === "code" ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => copy("message")}>
            {copied === "message" ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {copied === "message" ? "Copied" : "Copy the whole message"}
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span>
          <strong className="font-semibold">Copy it now if you need it.</strong> PayBridge keeps only a one-way hash of
          this code, so it cannot be shown again — not by you, not by anyone. If it is lost, resend the invitation to
          issue a fresh code.
        </span>
      </p>

      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
        {issued.emailed ? (
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        )}
        <span>
          {issued.emailed
            ? `Emailed to ${invitation.email}.`
            : `Not emailed — ${issued.note} Pass the code on yourself, or connect a mail service and resend.`}
        </span>
      </p>

      <ActionButton size="lg" onClick={onDone}>
        Done
      </ActionButton>
    </div>
  );
}
