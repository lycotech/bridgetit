import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime, relativeTime } from "@/lib/platform/format";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { useReplyToTicket } from "@/lib/support/customer";
import type { SupportTicketView, SupportTicketStatus } from "../../../../backend/src/types";
import type { TranslationKey } from "@/i18n/translate";

/**
 * The customer's own conversations.
 *
 * STATUS IS A SENTENCE, not a coloured dot: "Waiting for us", "We are working on
 * it", "Waiting for you", "Finished". A grey pill means nothing to somebody who
 * cannot see the colour, and "Pending" means nothing to anybody who has not
 * worked in a support team (WCAG 1.4.1).
 *
 * Each conversation is a native <details>: it opens with a press or with Enter,
 * it is announced as expanded or collapsed without any ARIA we have to maintain,
 * and it works before JavaScript finishes loading on a slow connection.
 */

const STATUS_KEY: Record<SupportTicketStatus, TranslationKey> = {
  open: "support.status_open",
  in_progress: "support.status_in_progress",
  waiting_on_customer: "support.status_waiting",
  resolved: "support.status_resolved",
};

function Conversation({ ticket }: { ticket: SupportTicketView }) {
  const { t } = usePreferences();
  const reply = useReplyToTicket(ticket.reference);
  const [draft, setDraft] = useState("");

  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{ticket.subject}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground tnum">
            {ticket.reference} · {relativeTime(ticket.updatedAt)}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            ticket.status === "resolved"
              ? "border-success/40 bg-success/10 text-success"
              : ticket.status === "waiting_on_customer"
                ? "border-gold/40 bg-gold/10 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground",
          )}
        >
          {t(STATUS_KEY[ticket.status])}
        </span>
      </summary>

      <div className="border-t border-border/70 p-4">
        <ol className="space-y-3">
          {ticket.messages.map((message) => {
            const mine = message.authorType === "customer";
            return (
              <li
                key={message.id}
                className={cn(
                  "rounded-2xl border p-3.5",
                  mine ? "border-primary/30 bg-primary/[0.07]" : "border-border bg-secondary/30",
                )}
              >
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-semibold text-foreground">
                  <span>{mine ? "You" : message.authorLabel}</span>
                  <span className="font-normal text-muted-foreground">{dateTime(message.createdAt)}</span>
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {message.body}
                </p>
              </li>
            );
          })}
        </ol>

        {/* The reply box stays open even on a finished conversation: replying
            reopens it, which is cheaper for everybody than making somebody start
            again and re-explain from the beginning. */}
        <div className="mt-3">
            <label htmlFor={`reply-${ticket.id}`} className="block text-sm font-semibold text-foreground">
              {t("support.reply_label")}
            </label>
            <textarea
              id={`reply-${ticket.id}`}
              value={draft}
              rows={3}
              onChange={(event) => setDraft(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background p-3 text-sm leading-relaxed text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
            />
            <button
              type="button"
              disabled={draft.trim().length === 0 || reply.isPending}
              onClick={() =>
                reply.mutate(draft.trim(), {
                  onSuccess: () => setDraft(""),
                })
              }
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-primary/45 bg-primary/10 px-4 text-sm font-semibold text-primary disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
            >
              <Send className="h-4 w-4" aria-hidden />
              {reply.isPending ? t("common.loading") : t("support.reply_send")}
            </button>
            {reply.isError ? (
              <p role="alert" className="mt-2 text-sm font-medium text-destructive">
                {t("common.something_went_wrong")}
              </p>
            ) : null}
        </div>
      </div>
    </details>
  );
}

export function MyConversations({ tickets }: { tickets: SupportTicketView[] }) {
  return (
    <ul className="space-y-2.5">
      {tickets.map((ticket) => (
        <li key={ticket.reference}>
          <Conversation ticket={ticket} />
        </li>
      ))}
    </ul>
  );
}
