import { useEffect, useState } from "react";
import { Mail, Plus, Search, TicketCheck } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingRows } from "@/components/dashboard/states";
import { Modal } from "@/components/dashboard/Modal";
import { cn } from "@/lib/utils";
import { CodeReveal } from "@/components/admin/portal/invitations/CodeReveal";
import { InviteForm } from "@/components/admin/portal/invitations/InviteForm";
import { InvitationRow } from "@/components/admin/portal/invitations/InvitationRow";
import { useInvitations, type IssuedInvitation } from "@/lib/admin/invitations";
import {
  INVITATION_STATUSES,
  INVITATION_STATUS_LABELS,
  type InvitationStatus,
} from "../../../../../backend/src/types";

/**
 * Demo invitations — the private-demonstration access list.
 *
 * The whole section is built around one awkward fact: a code is visible exactly
 * once, at the moment it is generated. So creating and reissuing both end in a
 * modal that has to be dismissed deliberately, and the list below can only ever
 * show the hint (PB-7K4M-••••), never a code.
 */
const FILTERS: { value: "" | InvitationStatus; label: string }[] = [
  { value: "", label: "All" },
  ...INVITATION_STATUSES.map((status) => ({ value: status, label: INVITATION_STATUS_LABELS[status] })),
];

export default function DemoInvitations() {
  const [status, setStatus] = useState<"" | InvitationStatus>("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);

  // The search box queries the server, so it is debounced — otherwise a fast
  // typist fires one request per keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const invitations = useInvitations({ status, q: debounced });
  const counts = invitations.data?.counts;
  const filtered = debounced.length > 0 || status !== "";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Private demonstrations"
        title="Demo invitations"
        description="Invite selected people to experience PayBridge. Each invitation is one code, tied to one email address, with an expiry and a use limit."
        actions={
          <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New invitation
          </ActionButton>
        }
      />

      {counts ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tally label="Total" value={counts.total} />
          <Tally label="Pending" value={counts.pending} />
          <Tally label="Opened" value={counts.opened} />
          <Tally label="Used" value={counts.used} />
          <Tally label="Expired" value={counts.expired} />
          <Tally label="Revoked" value={counts.revoked} />
        </div>
      ) : null}

      <Panel
        title="Invitations"
        description="Newest first. Open a row to resend with a new code, move the expiry or withdraw access."
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => (
              <button
                key={filter.value || "all"}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  status === filter.value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Name, email or organisation"
              className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
            />
          </label>
        </div>

        <AsyncPanel query={invitations} loading={<LoadingRows rows={4} />}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState
                icon={<TicketCheck className="h-5 w-5" />}
                title={filtered ? "Nothing matches that" : "No invitations yet"}
                body={
                  filtered
                    ? "Try clearing the filter or the search box."
                    : "Create an invitation to give someone a private, time-limited look at PayBridge."
                }
                action={
                  filtered ? undefined : (
                    <ActionButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                      New invitation
                    </ActionButton>
                  )
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {data.items.map((invitation) => (
                  <InvitationRow key={invitation.id} invitation={invitation} onReissued={setIssued} />
                ))}
              </ul>
            )
          }
        </AsyncPanel>
      </Panel>

      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Invitees reach the demonstration through{" "}
          <strong className="font-semibold text-foreground">Private Demonstration</strong> in the website footer, where
          they enter their email address and this code. It is not reachable from registration or ordinary sign-in.
        </span>
      </p>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New demonstration invitation"
        description="PayBridge generates the code and shows it to you once."
        size="wide"
      >
        <InviteForm
          onIssued={(next) => {
            setCreating(false);
            setIssued(next);
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title="Invitation code"
        description="Copy it now — this is the only time it can be displayed."
        size="wide"
      >
        {issued ? <CodeReveal issued={issued} onDone={() => setIssued(null)} /> : null}
      </Modal>
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}
