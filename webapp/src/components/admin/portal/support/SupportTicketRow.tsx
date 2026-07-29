import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HandHelping,
  Languages,
  MessageSquare,
  MessageSquareOff,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime, relativeTime } from "@/lib/platform/format";
import { SUPPORT_PRIORITY_TONE, SUPPORT_STATUS_TONE } from "@/lib/admin/support";
import {
  LOCALE_ENGLISH_NAMES,
  SUPPORT_CHANNEL_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  type SupportTicketAdminView,
} from "../../../../../../backend/src/types";

/**
 * One support request, as a row in the queue.
 *
 * The row is a BUTTON, not a link with a click handler — opening a ticket is a
 * logged read of somebody's request for help, and it should behave like the
 * deliberate action it is: reachable by keyboard, announced as a button, with the
 * reference read out first so a screen-reader user hears which case they are
 * opening before hearing its contents.
 *
 * Everything urgent on this row is a word AND an icon. A support lead triaging
 * forty requests must be able to see "Needs help setting up" without depending on
 * amber, and the person waiting on the other end cannot afford a missed colour.
 */
export function SupportTicketRow({
  ticket,
  selected,
  onOpen,
}: {
  ticket: SupportTicketAdminView;
  selected: boolean;
  onOpen: () => void;
}) {
  const waitingReplies = ticket.messages.filter((message) => message.authorType === "customer").length;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "w-full rounded-2xl border px-4 py-3.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          selected
            ? "border-primary/60 bg-primary/[0.06]"
            : "border-border bg-card/60 hover:border-border/80 hover:bg-card",
        )}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-xs font-semibold tracking-tight text-muted-foreground">
            {ticket.reference}
          </span>

          <Pill className={SUPPORT_STATUS_TONE[ticket.status]}>
            {ticket.status === "resolved" ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden />
            ) : (
              <Clock className="h-3 w-3" aria-hidden />
            )}
            {SUPPORT_STATUS_LABELS[ticket.status]}
          </Pill>

          {ticket.priority === "normal" ? null : (
            <Pill className={SUPPORT_PRIORITY_TONE[ticket.priority]}>
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {SUPPORT_PRIORITY_LABELS[ticket.priority]}
            </Pill>
          )}

          {ticket.assistedOnboarding ? (
            <Pill className="border-gold/40 bg-gold/10 text-foreground">
              <HandHelping className="h-3 w-3" aria-hidden />
              Wants help setting up
            </Pill>
          ) : null}
        </span>

        <span className="mt-1.5 block truncate text-sm font-semibold text-foreground">{ticket.subject}</span>

        <span className="mt-1 block text-xs text-muted-foreground">
          {ticket.name} · {SUPPORT_CHANNEL_LABELS[ticket.channel]} ·{" "}
          <span title={dateTime(ticket.createdAt)}>{relativeTime(ticket.createdAt)}</span>
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Languages className="h-3 w-3" aria-hidden />
            {LOCALE_ENGLISH_NAMES[ticket.locale]}
          </span>
          {ticket.textOnly ? (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <MessageSquareOff className="h-3 w-3" aria-hidden />
              Written only — do not phone
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" aria-hidden />
            {waitingReplies} from them
          </span>
          {ticket.assignedToLabel ? (
            <span className="inline-flex items-center gap-1">
              <UserCheck className="h-3 w-3" aria-hidden />
              {ticket.assignedToLabel}
            </span>
          ) : (
            <span className="font-semibold text-foreground">Nobody has picked this up</span>
          )}
        </span>
      </button>
    </li>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
        className,
      )}
    >
      {children}
    </span>
  );
}
