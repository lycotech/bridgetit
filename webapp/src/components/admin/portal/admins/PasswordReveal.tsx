import { useState } from "react";
import { Check, Copy, MailCheck, MailWarning, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { ADMIN_ROLE_LABELS, type IssuedAdminView } from "../../../../../../backend/src/types";

/**
 * The one and only screen where a temporary password is visible.
 *
 * Same hard constraint as the invitation code: the server keeps an argon2id hash,
 * so once this closes the plaintext is gone from the whole system. It is never
 * emailed either — the administrator hands it over in person, on a call or over a
 * channel they trust, which is the point of a password that dies on first use.
 *
 * Copy is offered but not forced, and dismissal is a deliberate click. A toast
 * that fades would take the password with it.
 */
export function PasswordReveal({ issued, onDone }: { issued: IssuedAdminView; onDone: () => void }) {
  const [copied, setCopied] = useState<"none" | "password" | "message">("none");
  const admin = issued.admin;
  const expiry = new Date(issued.expiresAt);

  const message = [
    `You have been given a PayBridge operations account.`,
    ``,
    `Role: ${ADMIN_ROLE_LABELS[admin.role]}`,
    `Sign in with: ${admin.email}`,
    `Temporary password: ${issued.temporaryPassword}`,
    `Valid until: ${expiry.toLocaleString()}`,
    ``,
    `The password works once. On first sign-in you will set your own password,`,
    `enrol an authenticator app and accept the administrator policy before`,
    `anything else opens.`,
  ].join("\n");

  const copy = (what: "password" | "message") => {
    void navigator.clipboard.writeText(what === "password" ? issued.temporaryPassword : message);
    setCopied(what);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Temporary password</p>
        <p className="mt-2 select-all break-all font-mono text-2xl font-bold tracking-[0.08em] text-foreground">
          {issued.temporaryPassword}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          For {admin.name} · {ADMIN_ROLE_LABELS[admin.role]} · signs in with {admin.email} · valid until{" "}
          {expiry.toLocaleString()}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => copy("password")}>
            {copied === "password" ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
            {copied === "password" ? "Copied" : "Copy password"}
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
          <strong className="font-semibold">Pass it on now.</strong> PayBridge stores only a one-way hash, so this
          password cannot be shown again — not by you, not by anyone. If it is lost, issue a new one from the
          administrator&apos;s row. It expires in 24 hours or at first sign-in, whichever comes first.
        </span>
      </p>

      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
        {issued.notified ? (
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        )}
        <span>
          {issued.notified
            ? `${admin.email} has been told an account was created for them. The password was not included in that email.`
            : `We could not email ${admin.email} to say the account exists. Tell them yourself.`}
        </span>
      </p>

      <ActionButton size="lg" onClick={onDone}>
        Done
      </ActionButton>
    </div>
  );
}
