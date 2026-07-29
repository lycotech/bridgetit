import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Mail,
  MessageSquarePlus,
  PhoneCall,
  Send,
  Ticket,
  TicketX,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { adminApi, adminKeys, formatDateTime, type RegistrationEvent } from "@/lib/admin";
import { ApiError } from "@/lib/api";

/**
 * The activity timeline for one registration, plus the note composer.
 *
 * WHY this exists: `status`, `pipelineStage` and `internalNotes` are all
 * last-write-wins columns. Before the timeline, a lead could be moved from
 * "Qualified" back to "Not Yet Suitable" and the only trace was the new value —
 * nobody could see it had ever been anything else, or who decided otherwise.
 * For a pipeline that gates access to a financial product, that is the wrong
 * default. Every entry here is append-only on the server.
 */

/** Field-name → label. Mirrors fieldLabel() on the server. */
const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  followUpStatus: "Follow-up",
  pipelineStage: "Pipeline stage",
  pilotPriority: "Priority",
  assignedTeam: "Assigned team",
  assignedTo: "Assigned to",
  qualified: "Qualified",
  internalNotes: "Internal notes",
};

interface Presentation {
  icon: typeof Mail;
  /** Icon + rail colour. Kept to the brand tokens, no raw hex. */
  tone: string;
  title: string;
}

function present(event: RegistrationEvent): Presentation {
  switch (event.kind) {
    case "registered":
      return { icon: UserPlus, tone: "text-primary", title: "Registered interest" };
    case "resubmitted":
      return { icon: RefreshCw, tone: "text-muted-foreground", title: "Submitted the form again" };
    case "note":
      return { icon: MessageSquarePlus, tone: "text-gold", title: "Note" };
    case "contacted":
      return { icon: PhoneCall, tone: "text-primary", title: "Contacted" };
    case "invitation_issued":
      return { icon: Ticket, tone: "text-gold", title: "Demo invitation issued" };
    case "invitation_revoked":
      return { icon: TicketX, tone: "text-destructive", title: "Demo invitation revoked" };
    case "email_sent":
      // Failures are surfaced as failures. A silent SMTP problem otherwise looks
      // identical to a delivered email, and the lead is the one who suffers.
      return failedEmail(event)
        ? { icon: AlertTriangle, tone: "text-destructive", title: "Email not delivered" }
        : { icon: Mail, tone: "text-muted-foreground", title: "Email sent" };
    case "field_changed":
      return {
        icon: ArrowRight,
        tone: "text-foreground",
        title: FIELD_LABELS[event.field ?? ""] ?? event.field ?? "Changed",
      };
    default:
      return { icon: ArrowRight, tone: "text-muted-foreground", title: event.kind };
  }
}

function failedEmail(event: RegistrationEvent): boolean {
  return event.kind === "email_sent" && /failed/i.test(event.message ?? "");
}

function TimelineEntry({ event, last }: { event: RegistrationEvent; last: boolean }) {
  const { icon: Icon, tone, title } = present(event);
  const showDiff = event.kind === "field_changed" && (event.oldValue ?? event.newValue);

  return (
    <li className="relative flex gap-3 pb-5">
      {/* The rail. Hidden on the last entry so the line stops at the oldest event
          rather than trailing into empty space. */}
      {last ? null : (
        <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
      )}

      <span
        className={cn(
          "relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card",
          tone,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
            {formatDateTime(event.createdAt)}
          </time>
        </div>

        {showDiff ? (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-xs text-muted-foreground line-through">
              {event.oldValue ?? "Not set"}
            </span>
            <ArrowRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {event.newValue ?? "Not set"}
            </span>
          </p>
        ) : null}

        {event.message ? (
          <p
            className={cn(
              "mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed",
              event.kind === "note" ? "text-foreground" : "text-muted-foreground",
              failedEmail(event) ? "text-destructive" : "",
            )}
          >
            {event.message}
          </p>
        ) : null}

        <p className="mt-1 text-xs text-muted-foreground">by {event.actor}</p>
      </div>
    </li>
  );
}

export function ActivityTimeline({
  registrationId,
  events,
}: {
  registrationId: string;
  events: RegistrationEvent[];
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [markContacted, setMarkContacted] = useState(false);

  const addNote = useMutation({
    mutationFn: () => adminApi.addNote(registrationId, message.trim(), markContacted),
    onSuccess: async () => {
      setMessage("");
      setMarkContacted(false);
      toast.success("Note added to the timeline");
      // The registration row itself can change too (lastContactAt), so refresh
      // the detail query rather than patching the events array in place.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.registration(registrationId) }),
        queryClient.invalidateQueries({ queryKey: ["admin", "registrations"] }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "We could not add that note"),
  });

  const canSubmit = message.trim().length > 0 && !addNote.isPending;

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Activity
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Append-only. Notes and status changes are never overwritten, so the record of who decided
        what, and when, survives.
      </p>

      <div className="mt-4 rounded-2xl border border-border bg-card/40 p-4">
        <Label htmlFor="new-note" className="text-sm">
          Add a note
        </Label>
        <Textarea
          id="new-note"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="What happened? Internal only — never visible to the registrant."
          className="mt-2 rounded-xl bg-secondary/40"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="note-contacted"
              checked={markContacted}
              onCheckedChange={(checked) => setMarkContacted(checked === true)}
            />
            <Label htmlFor="note-contacted" className="text-xs font-normal text-muted-foreground">
              Also mark as contacted now
            </Label>
          </div>

          <Button
            type="button"
            size="sm"
            className="h-10 rounded-full btn-brand text-sm font-semibold"
            disabled={!canSubmit}
            onClick={() => addNote.mutate()}
          >
            {addNote.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Add note
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nothing recorded yet. Registrations created before the timeline existed start empty — their
          history begins with the next change.
        </p>
      ) : (
        <ol className="mt-5">
          {events.map((event, index) => (
            <TimelineEntry key={event.id} event={event} last={index === events.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}
