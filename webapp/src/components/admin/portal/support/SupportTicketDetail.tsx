import { useState } from "react";
import { AlertTriangle, Mail, Phone, Send, ShieldAlert, StickyNote, UserCheck } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { InfoNote, Panel } from "@/components/dashboard/Panel";
import { SelectField, TextAreaField } from "@/components/dashboard/forms";
import { dateTime } from "@/lib/platform/format";
import { AccessibilityBrief } from "./AccessibilityBrief";
import { SupportConversation } from "./SupportConversation";
import type { SupportUpdateInput } from "@/lib/admin/support";
import {
  SUPPORT_CHANNEL_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TICKET_STATUSES,
  type SupportPriority,
  type SupportTicketAdminView,
  type SupportTicketStatus,
} from "../../../../../../backend/src/types";

export interface SupportAgent {
  id: string;
  name: string;
  role: string;
}

/**
 * One request for help, and the controls to answer it.
 *
 * The reply box is the first control, above status and assignment, because
 * answering the person is the job — everything else is bookkeeping about the job.
 * A queue tool that puts the status dropdown first teaches its users to triage
 * instead of reply.
 *
 * `canManage` and `canEscalate` come from the server's permission list and only
 * decide what is RENDERED. The server refuses either action regardless, which is
 * why a hidden control here is a courtesy rather than the boundary.
 */
export function SupportTicketDetail({
  ticket,
  agents,
  selfId,
  canManage,
  canEscalate,
  busy,
  error,
  onUpdate,
}: {
  ticket: SupportTicketAdminView;
  agents: SupportAgent[];
  selfId: string | null;
  canManage: boolean;
  canEscalate: boolean;
  busy: boolean;
  error: string | null;
  onUpdate: (input: Omit<SupportUpdateInput, "reference">) => void;
}) {
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState(ticket.resolutionNote ?? "");
  const [vulnerabilityNote, setVulnerabilityNote] = useState(ticket.vulnerabilityNote ?? "");

  const send = (input: Omit<SupportUpdateInput, "reference">) => onUpdate(input);

  return (
    <div className="space-y-5">
      <Panel
        title={ticket.subject}
        description={`${ticket.reference} · opened ${dateTime(ticket.createdAt)} · ${SUPPORT_CHANNEL_LABELS[ticket.channel]}`}
        bodyClassName="space-y-5"
      >
        {error ? <InfoNote tone="attention">{error}</InfoNote> : null}

        {ticket.vulnerabilityFlag ? (
          <InfoNote tone="attention">
            <span className="font-semibold">Flagged for extra care.</span>{" "}
            {ticket.vulnerabilityNote ?? "No note was recorded with the flag."}
          </InfoNote>
        ) : null}

        {/* Contact details. Deliberately the ONLY personal data on this screen:
            there is no balance, no bridge history and no savings figure, because
            the endpoint behind it does not return any. */}
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Name">{ticket.name}</Detail>
          <Detail label="Status">{SUPPORT_STATUS_LABELS[ticket.status]}</Detail>
          <Detail label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
            <a className="underline decoration-dotted underline-offset-2" href={`mailto:${ticket.email}`}>
              {ticket.email}
            </a>
          </Detail>
          <Detail label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
            {ticket.phone ? (
              ticket.accessibility.textOnly ? (
                <span>
                  {ticket.phone}{" "}
                  <span className="font-semibold text-gold">— written messages only</span>
                </span>
              ) : (
                ticket.phone
              )
            ) : (
              "Not given"
            )}
          </Detail>
          {ticket.callbackWindow ? <Detail label="Best time to call">{ticket.callbackWindow}</Detail> : null}
          <Detail label="Assigned to" icon={<UserCheck className="h-3.5 w-3.5" />}>
            {ticket.assignedToLabel ?? "Nobody yet"}
          </Detail>
          {ticket.resolvedAt ? (
            <Detail label="Resolved">
              {dateTime(ticket.resolvedAt)}
              {ticket.resolvedBy ? ` by ${ticket.resolvedBy}` : ""}
            </Detail>
          ) : null}
        </dl>

        <AccessibilityBrief ticket={ticket} />

        <SupportConversation messages={ticket.messages} internalNotes={ticket.internalNotes} />
      </Panel>

      {canManage ? (
        <Panel
          title="Answer this person"
          description="Your reply is sent to them and kept on the record. Write it in the language shown above."
          bodyClassName="space-y-4"
        >
          <TextAreaField
            label="Reply to the customer"
            value={reply}
            onChange={setReply}
            rows={4}
            maxLength={4000}
            placeholder="We have seen your message. Here is what happens next…"
            hint="They will see this exactly as written. Short sentences, everyday words, no jargon."
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              size="sm"
              icon={<Send className="h-3.5 w-3.5" />}
              disabled={reply.trim().length === 0}
              loading={busy}
              onClick={() => {
                send({ reply: reply.trim() });
                setReply("");
              }}
            >
              Send reply
            </ActionButton>
          </div>

          <TextAreaField
            label="Internal note"
            value={note}
            onChange={setNote}
            rows={2}
            optional
            maxLength={4000}
            placeholder="Called twice, no answer. Trying WhatsApp."
            hint="For colleagues only. Never sent to the customer and never shown to their employer."
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              icon={<StickyNote className="h-3.5 w-3.5" />}
              disabled={note.trim().length === 0}
              loading={busy}
              onClick={() => {
                send({ internalNote: note.trim() });
                setNote("");
              }}
            >
              Save note
            </ActionButton>
          </div>
        </Panel>
      ) : (
        <InfoNote tone="neutral">
          Your role can read support requests but not answer them. Ask an operations administrator to reply.
        </InfoNote>
      )}

      {canManage ? (
        <Panel title="Move it along" description="Who owns this case, how urgent it is, and where it stands." bodyClassName="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Status"
              value={ticket.status}
              onChange={(next) => send({ status: next as SupportTicketStatus })}
              options={SUPPORT_TICKET_STATUSES.map((value) => ({ value, label: SUPPORT_STATUS_LABELS[value] }))}
              hint="Changing this is recorded, with the old and new value."
            />
            <SelectField
              label="Urgency"
              value={ticket.priority}
              onChange={(next) => send({ priority: next as SupportPriority })}
              options={SUPPORT_PRIORITIES.map((value) => ({ value, label: SUPPORT_PRIORITY_LABELS[value] }))}
            />
          </div>

          <SelectField
            label="Assigned to"
            value={ticket.assignedTo ?? ""}
            onChange={(next) => send({ assignedTo: next })}
            options={[
              { value: "", label: "Nobody — leave in the queue" },
              ...agents.map((agent) => ({
                value: agent.id,
                label: selfId && agent.id === selfId ? `${agent.name} (you)` : agent.name,
              })),
            ]}
            hint="Only administrators who can open support requests appear here — a case assigned to someone who cannot see it would sit unread."
          />

          <TextAreaField
            label="What was done about it"
            value={resolution}
            onChange={setResolution}
            rows={2}
            optional
            maxLength={2000}
            placeholder="Walked her through Bridge It on a call. She completed a request afterwards."
            hint="Saved with the case so the next person reading it knows how it ended."
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              loading={busy}
              disabled={resolution.trim() === (ticket.resolutionNote ?? "")}
              onClick={() => send({ resolutionNote: resolution.trim() })}
            >
              Save outcome
            </ActionButton>
            {ticket.status === "resolved" ? null : (
              <ActionButton
                size="sm"
                loading={busy}
                onClick={() => send({ status: "resolved", resolutionNote: resolution.trim() || undefined })}
              >
                Mark resolved
              </ActionButton>
            )}
          </div>
        </Panel>
      ) : null}

      {canEscalate ? (
        <Panel
          title="Escalate: customer needs extra care"
          description="Use this when someone may be at risk of harm from a financial decision — not for a difficult conversation."
          bodyClassName="space-y-4"
        >
          <InfoNote tone="neutral">
            Flagging someone puts the case at the top of the queue and is recorded against your name. The customer is
            never told they were flagged and never sees this note.
          </InfoNote>

          <TextAreaField
            label="Why this needs extra care"
            value={vulnerabilityNote}
            onChange={setVulnerabilityNote}
            rows={3}
            optional
            maxLength={2000}
            placeholder="Confused about repayment on three calls; asked the same question each time."
            hint="Describe what happened and what they said. Do not record a health condition or a diagnosis — PayBridge does not hold that information."
          />

          <div className="flex flex-wrap gap-2">
            {ticket.vulnerabilityFlag ? (
              <ActionButton
                variant="secondary"
                size="sm"
                loading={busy}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                onClick={() => send({ vulnerabilityFlag: false, vulnerabilityNote: vulnerabilityNote.trim() })}
              >
                Remove the flag
              </ActionButton>
            ) : (
              <ActionButton
                variant="danger"
                size="sm"
                loading={busy}
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
                onClick={() => send({ vulnerabilityFlag: true, vulnerabilityNote: vulnerabilityNote.trim() })}
              >
                Flag for extra care
              </ActionButton>
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {icon ? <span aria-hidden>{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}
