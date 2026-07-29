import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Mail, MailWarning } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Outgoing mail.
 *
 * Two states, and the difference matters operationally:
 *
 *   Delivering — a transport is configured, mail leaves the server, and this
 *   page has nothing to show. That is the healthy state.
 *
 *   Held — no transport is configured, so every message is being kept locally
 *   instead of being silently dropped. The codes are readable here so a
 *   verification, an invitation or a recovery step can still be completed.
 *
 * The held view exists only outside production, where the endpoint returns 404.
 * A live deployment must not have a screen that lists customers' verification
 * codes, however well guarded.
 */
interface OutboxMessage {
  id: string;
  at: string;
  to: string[];
  from: string;
  subject: string;
  text: string;
}

interface OutboxView {
  transport: string;
  delivering: boolean;
  messages: OutboxMessage[];
}

export default function OutgoingMail() {
  const [open, setOpen] = useState<string | null>(null);
  const outbox = useQuery({
    queryKey: ["admin", "outbox"],
    queryFn: () => api.get<OutboxView>("/api/admin/outbox"),
    retry: false,
    refetchInterval: 15_000,
  });

  const delivering = outbox.data?.delivering ?? false;
  // A 404 means production, where the local outbox does not exist at all.
  const unavailable = outbox.isError;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Outgoing mail"
        description="Verification codes, demonstration invitations and security notices sent by PayBridge."
      />

      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-5",
          delivering || unavailable
            ? "border-primary/30 bg-primary/[0.06]"
            : "border-amber-500/40 bg-amber-500/10",
        )}
      >
        {delivering || unavailable ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        )}
        <div className="text-sm leading-relaxed">
          {delivering || unavailable ? (
            <>
              <p className="font-semibold text-foreground">Mail is being delivered</p>
              <p className="mt-1 text-muted-foreground">
                Messages go out through the configured mail service. Nothing is held locally.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">No mail service connected — messages are being held</p>
              <p className="mt-1 text-muted-foreground">
                Customers and invitees are not receiving anything yet. Add a mail service key to start delivering; the
                messages below are the ones that could not be sent, kept so you can still finish a journey by hand.
              </p>
            </>
          )}
        </div>
      </div>

      {unavailable ? null : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Held messages{outbox.data ? ` (${outbox.data.messages.length})` : ""}
          </h2>

          {outbox.data?.messages.length === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              Nothing held. Messages appear here as they are generated.
            </p>
          ) : null}

          <ul className="space-y-2">
            {outbox.data?.messages.map((message) => (
              <li key={message.id} className="overflow-hidden rounded-2xl border border-border bg-card/60">
                <button
                  type="button"
                  onClick={() => setOpen((prev) => (prev === message.id ? null : message.id))}
                  className="flex w-full flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="text-sm font-semibold text-foreground">{message.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    To {message.to.join(", ")} · {new Date(message.at).toLocaleString()}
                  </span>
                </button>
                {open === message.id ? (
                  <pre className="max-h-80 overflow-auto border-t border-border bg-background/60 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
                    {message.text}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
