import { EyeOff, User, Headset } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/platform/format";
import type { SupportMessageView } from "../../../../../../backend/src/types";

/**
 * The conversation, oldest first.
 *
 * Rendered as an ordered list because the order carries the meaning: who spoke
 * last is the whole question a support agent is answering. Internal notes are a
 * SEPARATE list below, visually and structurally, so nobody reads a colleague's
 * working note as something the customer has seen.
 */
export function SupportConversation({
  messages,
  internalNotes,
}: {
  messages: SupportMessageView[];
  internalNotes: SupportMessageView[];
}) {
  return (
    <div className="space-y-5">
      <ol className="space-y-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              "rounded-2xl border px-3.5 py-3",
              message.authorType === "staff"
                ? "border-primary/30 bg-primary/[0.05]"
                : "border-border bg-card/60",
            )}
          >
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
              >
                {message.authorType === "staff" ? (
                  <Headset className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </span>
              {message.authorType === "staff" ? "PayBridge support" : message.authorLabel}
              <span className="font-normal text-muted-foreground">· {dateTime(message.createdAt)}</span>
            </p>
            {/* whitespace-pre-wrap, never dangerouslySetInnerHTML: this is text a
                stranger typed, and it is displayed as text. */}
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {message.body}
            </p>
          </li>
        ))}
      </ol>

      {internalNotes.length > 0 ? (
        <section aria-labelledby="internal-notes-heading" className="space-y-2">
          <h4
            id="internal-notes-heading"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
            Internal notes — the customer never sees these
          </h4>
          <ol className="space-y-2">
            {internalNotes.map((note) => (
              <li key={note.id} className="rounded-xl border border-dashed border-border bg-background/50 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {note.authorLabel} · {dateTime(note.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
                  {note.body}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
