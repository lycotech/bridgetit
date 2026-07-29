import { useEffect, useMemo, useState } from "react";
import { Inbox, Lock, MessageSquare } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingRows } from "@/components/dashboard/states";
import { SupportFilterBar } from "@/components/admin/portal/support/SupportFilterBar";
import { SupportTicketRow } from "@/components/admin/portal/support/SupportTicketRow";
import { SupportTicketDetail } from "@/components/admin/portal/support/SupportTicketDetail";
import { AssistedRequests } from "@/components/admin/portal/support/AssistedRequests";
import { adminCan, useAdminSession } from "@/lib/admin/portal-session";
import {
  useAssistedQueue,
  useSupportAgents,
  useSupportTicket,
  useSupportTickets,
  useUpdateSupportTicket,
  type SupportFilters,
  type SupportUpdateInput,
} from "@/lib/admin/support";

/**
 * Support requests — the desk where somebody answers.
 *
 * TWO PROPERTIES OF THIS SCREEN ARE THE POINT:
 *
 *   It shows no money. Not a balance, not a bridge amount, not a repayment date.
 *   The endpoint behind it does not return any, so no future edit here can
 *   accidentally put one on the page. A support agent helping someone sign in has
 *   no need to know what they earn.
 *
 *   Opening a request is recorded. Every ticket read, every accessibility panel
 *   and every list page writes an access log naming the reader. That is why the
 *   detail loads when a request is opened rather than being prefetched for the
 *   whole queue — prefetching would log reads of people nobody looked at, and a
 *   log full of noise protects nobody.
 */
export default function SupportRequests() {
  const session = useAdminSession();
  const canManage = adminCan(session.data, "support.manage");
  const canEscalate = adminCan(session.data, "support.escalate");
  const canSeeAccessibility = adminCan(session.data, "support.accessibility.view");

  const [filters, setFilters] = useState<SupportFilters>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounced: the search box hits the database on every change.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo<SupportFilters>(() => ({ ...filters, q: debounced }), [filters, debounced]);
  const queue = useSupportTickets(query);
  const ticket = useSupportTicket(selected);
  const assisted = useAssistedQueue();
  const agents = useSupportAgents(canManage);
  const update = useUpdateSupportTicket();

  const counts = queue.data?.pages[0]?.counts;

  async function runUpdate(input: Omit<SupportUpdateInput, "reference">) {
    if (!selected) return;
    setActionError(null);
    try {
      await update.mutateAsync({ reference: selected, ...input });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "That change did not go through.");
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="People"
        title="Support requests"
        description="Every request for help, from every channel — WhatsApp, the written form, phone, call-backs and email. Each one has a reference, so nothing is answered off the record."
      />

      {counts ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Count label="New" value={counts.open} />
          <Count label="Being worked on" value={counts.inProgress} />
          <Count label="Waiting on them" value={counts.waiting} />
          <Count label="Resolved" value={counts.resolved} />
          <Count label="Want help setting up" value={counts.assisted} tone="attention" />
          <Count label="Need extra care" value={counts.vulnerable} tone="attention" />
        </ul>
      ) : null}

      {/* Not an AsyncPanel: a 403 here is an ANSWER — "your role does not include
          accessibility details" — and rendering it as a failed request would tell
          an auditor something broke when nothing did. */}
      {assisted.isLoading ? (
        <LoadingRows rows={2} />
      ) : (
        <AssistedRequests
          requests={assisted.data?.standingRequests ?? []}
          denied={assisted.isError || !canSeeAccessibility}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel
          title="The queue"
          description="Newest first. Open one to read it and reply."
          bodyClassName="space-y-4"
        >
          <SupportFilterBar filters={filters} onChange={setFilters} search={search} onSearchChange={setSearch} />

          <AsyncPanel query={queue} loading={<LoadingRows rows={5} />}>
            {(data) => {
              const tickets = data.pages.flatMap((page) => page.items);
              if (tickets.length === 0) {
                return (
                  <EmptyState
                    icon={<Inbox className="h-5 w-5" />}
                    title="Nothing here"
                    body="No request matches this filter. Clear it to see the whole queue — an empty result means no match, not that nobody needs help."
                  />
                );
              }
              return (
                <>
                  <ul className="space-y-2">
                    {tickets.map((item) => (
                      <SupportTicketRow
                        key={item.id}
                        ticket={item}
                        selected={item.reference === selected}
                        onOpen={() => {
                          setActionError(null);
                          setSelected(item.reference);
                        }}
                      />
                    ))}
                  </ul>

                  {queue.hasNextPage ? (
                    <div className="flex justify-center pt-1">
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => queue.fetchNextPage()}
                        loading={queue.isFetchingNextPage}
                      >
                        Load older requests
                      </ActionButton>
                    </div>
                  ) : null}
                </>
              );
            }}
          </AsyncPanel>
        </Panel>

        <div>
          {selected ? (
            <AsyncPanel query={ticket} loading={<LoadingRows rows={6} />}>
              {(data) => (
                <SupportTicketDetail
                  ticket={data}
                  agents={agents.data?.items ?? []}
                  selfId={agents.data?.selfId ?? null}
                  canManage={canManage}
                  canEscalate={canEscalate}
                  busy={update.isPending}
                  error={actionError}
                  onUpdate={(input) => void runUpdate(input)}
                />
              )}
            </AsyncPanel>
          ) : (
            <Panel title="No request open" description="Choose one from the queue to read it.">
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="Nothing open"
                body="Opening a request is recorded against your name, along with the time — so requests are not opened for you in advance."
              />
            </Panel>
          )}
        </div>
      </div>

      <InfoNote tone="neutral">
        This screen shows no balances, no bridge amounts and no savings — the data behind it does not contain them. What
        it does show is how each person prefers to be helped, which is why every read here is logged.
      </InfoNote>

      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Employers never see any of this: not that an employee asked for help, not what they asked, and not the
          settings they chose. Support requests and accessibility settings are visible only to the person themselves and
          to authorised PayBridge staff.
        </span>
      </p>
    </div>
  );
}

function Count({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "attention";
}) {
  return (
    <li
      className={
        tone === "attention"
          ? "rounded-2xl border border-gold/40 bg-gold/[0.07] px-3.5 py-3"
          : "rounded-2xl border border-border bg-card/60 px-3.5 py-3"
      }
    >
      <p className="text-xl font-bold text-foreground tnum">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
    </li>
  );
}
