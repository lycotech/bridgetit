import { prisma } from "./db";
import type { RegistrationEventKind } from "./types";

/**
 * Writing to the registration timeline.
 *
 * Two rules govern everything in this file:
 *
 *   1. Recording history must never break the thing being recorded. A failed
 *      insert here is logged and swallowed — a lead is not lost, and a status
 *      change is not rolled back, because the audit row could not be written.
 *      The timeline is evidence, not a transaction participant.
 *
 *   2. Only pipeline vocabulary goes in `oldValue` / `newValue`. Statuses,
 *      stages, priorities, assignee names, delivery notes: yes. Email
 *      addresses, phone numbers, salary bands, anything from `details`: no.
 *      This table is read by more people than the Registration row is, so it
 *      stays free of contact and financial data by construction — see
 *      REDACTED_FIELDS below, which is enforced rather than documented.
 */

export interface EventInput {
  registrationId: string;
  kind: RegistrationEventKind;
  actor?: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  message?: string | null;
}

/**
 * Fields whose values must never be copied into a timeline row, even if a
 * future caller passes them. Identity and contact details live on the
 * Registration itself; duplicating them here would widen their blast radius
 * for no operational gain — nobody works a pipeline off a phone-number diff.
 */
const REDACTED_FIELDS = new Set([
  "email",
  "phone",
  "fullName",
  "ipHash",
  "userAgent",
  "details",
  "consentText",
]);

const MAX_VALUE = 300;
const MAX_MESSAGE = 4000;

function trim(value: string | null | undefined, limit: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Append one event. Never throws. */
export async function recordEvent(input: EventInput): Promise<void> {
  const redacted = input.field ? REDACTED_FIELDS.has(input.field) : false;

  try {
    await prisma.registrationEvent.create({
      data: {
        registrationId: input.registrationId,
        kind: input.kind,
        actor: trim(input.actor, 120) ?? "system",
        field: trim(input.field, 60),
        // A redacted field still produces a row — "someone changed the phone
        // number, and when" is worth knowing. The VALUES are what we drop.
        oldValue: redacted ? "[redacted]" : trim(input.oldValue, MAX_VALUE),
        newValue: redacted ? "[redacted]" : trim(input.newValue, MAX_VALUE),
        message: trim(input.message, MAX_MESSAGE),
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        type: "error",
        at: new Date().toISOString(),
        scope: "registration.event.write",
        kind: input.kind,
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
  }
}

/** Append several events concurrently. Never throws. */
export async function recordEvents(inputs: EventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await Promise.all(inputs.map(recordEvent));
}

/** How a value reads in the timeline when it is absent. */
function display(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Human labels for the pipeline fields. Falls back to the raw key so a newly
 * added field still produces a readable-enough row rather than being dropped.
 */
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

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/**
 * Build one `field_changed` event per field that actually moved.
 *
 * WHY compare instead of trusting the request body: the admin UI submits the
 * whole edit form, so most PATCHes contain fields the user never touched.
 * Logging those would bury the one real change — "moved to Pilot Candidate" —
 * under seven no-op rows, and the timeline would become noise people scroll
 * past, which is the same as not having it.
 */
export function diffEvents(
  registrationId: string,
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
  actor: string,
): EventInput[] {
  const events: EventInput[] = [];

  for (const [field, next] of Object.entries(patch)) {
    const previous = before[field];

    // Normalise before comparing: the form sends "" for a cleared text input
    // while the database holds null. Those are the same state, not a change.
    const a = previous === null || previous === undefined ? "" : String(previous);
    const b = next === null || next === undefined ? "" : String(next);
    if (a === b) continue;

    // A note edit is recorded as a change, but the note bodies are not diffed
    // into old/new — the note itself is already an event of its own kind.
    if (field === "internalNotes") {
      events.push({
        registrationId,
        kind: "field_changed",
        actor,
        field,
        oldValue: null,
        newValue: null,
        message: "Internal notes field edited.",
      });
      continue;
    }

    events.push({
      registrationId,
      kind: "field_changed",
      actor,
      field,
      oldValue: display(previous),
      newValue: display(next),
    });
  }

  return events;
}

/** Serialise a timeline row for the admin API. */
export function serialiseEvent(row: {
  id: string;
  kind: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  message: string | null;
  actor: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    kind: row.kind,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
    message: row.message,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}
