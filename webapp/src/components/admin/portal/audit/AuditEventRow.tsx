import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime, relativeTime } from "@/lib/platform/format";
import { ACTOR_TYPE_LABELS, AUDIT_OUTCOME_TONE, detailEntries } from "@/lib/admin/audit";
import { auditActionLabel, type AuditEventView } from "../../../../../../backend/src/types";

/**
 * One line of the audit trail, expandable into the full record.
 *
 * WHY collapsed by default: the columns that matter for scanning are when, what,
 * who and whether it worked. IP address, device string, request id and the
 * event's own detail matter when you have already found the row — showing them
 * inline makes twenty events fill a screen and forces the eye past evidence it
 * is not looking for yet.
 *
 * Nothing here is editable. There is no menu, no action button and no form: the
 * row is a reader for a record that cannot be changed, and it should look like
 * one.
 */
export function AuditEventRow({ event }: { event: AuditEventView }) {
  const [open, setOpen] = useState(false);
  const detail = detailEntries(event);
  const tone = AUDIT_OUTCOME_TONE[event.outcome] ?? "border-border bg-secondary/60 text-muted-foreground";

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-secondary/40 sm:px-4"
      >
        <span
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            event.outcome === "success"
              ? "bg-emerald-500"
              : event.outcome === "failure"
                ? "bg-amber-500"
                : "bg-destructive",
          )}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{auditActionLabel(event.action)}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                tone,
              )}
            >
              {event.outcome}
            </span>
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="truncate font-medium text-foreground/80">
              {event.actorLabel ?? ACTOR_TYPE_LABELS[event.actorType] ?? event.actorType}
            </span>
            <span aria-hidden>·</span>
            <span>{ACTOR_TYPE_LABELS[event.actorType] ?? event.actorType}</span>
            {event.targetType ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">
                  on {event.targetType}
                  {event.targetId ? ` ${event.targetId.slice(-8)}` : ""}
                </span>
              </>
            ) : null}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-xs font-semibold text-foreground tnum">{relativeTime(event.createdAt)}</span>
          <span className="mt-0.5 hidden text-[11px] text-muted-foreground tnum sm:block">
            {dateTime(event.createdAt)}
          </span>
        </span>

        <ChevronDown
          className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-border/70 bg-background/40 px-3.5 py-3.5 sm:px-4">
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <Field label="Occurred at" value={new Date(event.createdAt).toISOString()} mono />
            <Field label="Action" value={event.action} mono />
            <Field label="Actor" value={event.actorLabel} />
            <Field label="Actor id" value={event.actorId} mono />
            <Field label="Target" value={event.targetType ? `${event.targetType} · ${event.targetId ?? "—"}` : null} mono />
            <Field
              label="Status change"
              value={
                event.previousStatus || event.newStatus
                  ? `${event.previousStatus ?? "—"} → ${event.newStatus ?? "—"}`
                  : null
              }
            />
            <Field label="IP address" value={event.ip} mono />
            <Field label="Request id" value={event.requestId} mono />
            <Field label="Device" value={event.userAgent} className="sm:col-span-2" />
            <Field label="Event id" value={event.id} mono />
          </dl>

          {detail ? (
            <div className="mt-4 rounded-xl border border-border bg-card/60 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Detail</p>
              {typeof detail === "string" ? (
                <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-foreground/90">{detail}</pre>
              ) : (
                <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {detail.map((entry) => (
                    <div key={entry.key} className="min-w-0">
                      <dt className="text-[11px] text-muted-foreground">{entry.key}</dt>
                      <dd className="break-words text-xs font-medium text-foreground">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "break-words text-xs font-medium",
          value ? "text-foreground" : "text-muted-foreground/70",
          mono && value && "font-mono",
        )}
      >
        {value || "Not recorded"}
      </dd>
    </div>
  );
}
