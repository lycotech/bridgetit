import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { SummaryRow, InfoNote } from "@/components/dashboard/Panel";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { DataTable, CellStack } from "@/components/dashboard/DataTable";
import type { Column } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Modal } from "@/components/dashboard/Modal";
import { SelectField, TextAreaField } from "@/components/dashboard/forms";
import { opsApi, qk } from "@/lib/platform/mock-service";
import { dateTime, relativeTime } from "@/lib/platform/format";
import { TICKET_STATUSES } from "@/lib/platform/models";
import type { SupportTicket, TicketStatus } from "@/lib/platform/models";
import { useActorName } from "@/lib/platform/use-account";

const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
const REQUESTER_TYPES = ["Employee", "Employer", "Investor"] as const;
const CHANNELS = ["Email", "In-app", "Phone", "WhatsApp"] as const;

export default function OperationsSupportPage() {
  const actor = useActorName();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<TicketStatus>("Open");

  const tickets = useQuery({ queryKey: qk.ops("support"), queryFn: () => opsApi.tickets() });

  const sendReply = useMutation({
    mutationFn: () => opsApi.replyToTicket(selected?.id ?? "", reply, actor),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("support") });
      setSelected(ticket);
      setReply("");
      toast.success("Reply sent to the customer");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not send that reply"),
  });

  const changeStatus = useMutation({
    mutationFn: (next: TicketStatus) => opsApi.setTicketStatus(selected?.id ?? "", next),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: qk.ops("support") });
      setSelected(ticket);
      toast.success(`Ticket set to ${ticket.status.toLowerCase()}`);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update that ticket"),
  });

  const rows = tickets.data ?? [];
  const open = rows.filter((row) => row.status === "Open");
  const escalated = rows.filter((row) => row.status === "Escalated");
  const waiting = rows.filter((row) => row.status === "Waiting on customer");

  const columns: Column<SupportTicket>[] = [
    {
      key: "subject",
      header: "Ticket",
      render: (row) => <CellStack primary={row.subject} secondary={`${row.reference} · ${relativeTime(row.updatedAt)}`} />,
      sortValue: (row) => row.updatedAt,
    },
    {
      key: "requester",
      header: "Requester",
      hideBelow: "md",
      render: (row) => <CellStack primary={row.requester} secondary={row.requesterType} />,
      sortValue: (row) => row.requester,
    },
    {
      key: "channel",
      header: "Channel",
      hideBelow: "lg",
      render: (row) => <span className="text-muted-foreground">{row.channel}</span>,
      sortValue: (row) => row.channel,
    },
    {
      key: "priority",
      header: "Priority",
      hideBelow: "sm",
      render: (row) => <StatusBadge status={row.priority} />,
      sortValue: (row) => PRIORITIES.indexOf(row.priority),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Customer support queue"
        description="Every question from employees, employers and investors in one place."
      />

      <StatGrid columns={4}>
        <StatCard label="Open" value={String(open.length)} tone="primary" />
        <StatCard label="Escalated" value={String(escalated.length)} tone="attention" />
        <StatCard label="Waiting on customer" value={String(waiting.length)} />
        <StatCard
          label="Resolved"
          value={String(rows.filter((row) => row.status === "Resolved").length)}
          tone="protected"
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        caption="Each support case, with the customer, the channel it arrived on, its priority and its stage"
        search={(row) => `${row.reference} ${row.subject} ${row.requester} ${row.requesterType} ${row.status}`}
        searchPlaceholder="Search by ticket, reference or requester"
        filters={[
          { key: "status", label: "Status", options: TICKET_STATUSES, accessor: (row) => row.status },
          { key: "priority", label: "Priority", options: PRIORITIES, accessor: (row) => row.priority },
          { key: "type", label: "Requester", options: REQUESTER_TYPES, accessor: (row) => row.requesterType },
          { key: "channel", label: "Channel", options: CHANNELS, accessor: (row) => row.channel },
        ]}
        dateAccessor={(row) => row.createdAt}
        isLoading={tickets.isLoading}
        isError={tickets.isError}
        onRetry={() => void tickets.refetch()}
        emptyTitle="Nothing in the queue"
        emptyBody="New tickets from any portal appear here immediately."
        onRowClick={(row) => {
          setSelected(row);
          setStatus(row.status);
          setReply("");
        }}
        initialSort={{ key: "subject", direction: "desc" }}
        exportName="paybridge-support-tickets"
        exportRow={(row) => ({
          Reference: row.reference,
          Subject: row.subject,
          Requester: row.requester,
          Type: row.requesterType,
          Channel: row.channel,
          Priority: row.priority,
          Status: row.status,
          Opened: dateTime(row.createdAt),
          Updated: dateTime(row.updatedAt),
        })}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? "Ticket"}
        description={selected ? `${selected.reference} · ${selected.requester}` : undefined}
        size="wide"
        footer={
          <>
            <div className="mr-auto w-48">
              <SelectField
                label=""
                value={status}
                onChange={(value) => {
                  setStatus(value as TicketStatus);
                  changeStatus.mutate(value as TicketStatus);
                }}
                options={TICKET_STATUSES.map((value) => ({ value, label: value }))}
              />
            </div>
            <ActionButton
              loading={sendReply.isPending}
              disabled={reply.trim().length < 4}
              icon={<Send className="h-4 w-4" />}
              onClick={() => sendReply.mutate()}
            >
              Send reply
            </ActionButton>
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="divide-y divide-border/70">
              <SummaryRow label="Requester" value={`${selected.requester} · ${selected.requesterType}`} />
              <SummaryRow label="Channel" value={selected.channel} />
              <SummaryRow label="Priority" value={<StatusBadge status={selected.priority} />} />
              <SummaryRow label="Status" value={<StatusBadge status={selected.status} />} />
              <SummaryRow label="Opened" value={dateTime(selected.createdAt)} />
              <SummaryRow label="Last update" value={dateTime(selected.updatedAt)} />
            </div>

            <ul className="space-y-3">
              {selected.messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.authorType === "PayBridge"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-primary/30 bg-primary/8 p-3.5"
                      : "max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-secondary/50 p-3.5"
                  }
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {message.author} · {relativeTime(message.at)}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">{message.body}</p>
                </li>
              ))}
            </ul>

            <TextAreaField
              label="Reply to the customer"
              value={reply}
              onChange={setReply}
              rows={4}
              placeholder="Answer the question in plain language."
              hint="Never ask a customer for their bank password, card PIN or a one-time code."
            />

            <InfoNote>
              Support can see amounts, dates and statuses. A customer's reasons for a request stay private
              unless they tell you themselves.
            </InfoNote>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
