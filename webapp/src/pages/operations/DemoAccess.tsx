import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Ticket, TicketCheck, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard, StatGrid } from "@/components/dashboard/StatCard";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminSessionGate } from "@/components/admin/AdminSessionGate";
import { InvitationForm } from "@/components/admin/InvitationForm";
import { InvitationsPanel } from "@/components/admin/InvitationsPanel";
import { AccessLogPanel } from "@/components/admin/AccessLogPanel";
import { useInvitations } from "@/lib/admin/invitations";
import {
  adminApi,
  adminKeys,
  formatDateTime,
  SEGMENT_LABELS,
  type AdminRegistration,
} from "@/lib/admin";

/**
 * Demo access, run from inside the Operations dashboard.
 *
 * The demonstration environment is not a separate product to be administered
 * somewhere else — deciding who sees PayBridge before launch is operations work,
 * so the controls live where the operations team already works.
 *
 * Two gates, doing different jobs:
 *   - the `ops.demo.invite` permission (App.tsx) decides which internal ROLE
 *     sees this page at all: super admin only;
 *   - AdminSessionGate demands PayBridge staff credentials before any control
 *     on it works, because every person viewing this dashboard is already inside
 *     the demo on an invitation. Without it, a guest could invite the next
 *     guest and the confidential guest list would grow unattributably.
 *
 * The server is the real boundary either way: /api/admin/* refuses without a
 * staff session.
 */
export default function OperationsDemoAccessPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Demonstration"
        title="Demo access"
        description="Invite named people into the confidential demonstration, see every invitation you have issued, revoke any of them, and review who actually used one."
      />

      <AdminSessionGate
        title="Staff credentials required"
        description="Issuing demonstration access is restricted to PayBridge staff. Sign in with your internal account to unlock the controls on this page."
      >
        <DemoAccessConsole />
      </AdminSessionGate>
    </div>
  );
}

function DemoAccessConsole() {
  const invitations = useInvitations({});
  const access = useQuery({ queryKey: adminKeys.demoAccess, queryFn: adminApi.demoAccess });

  const counts = useMemo(() => {
    /*
     * The server derives status, so "live" is read from its counts rather than
     * recomputed here — two implementations of "is this code still usable?"
     * would eventually disagree, and the client's copy would be the wrong one.
     */
    const tally = invitations.data?.counts;
    const granted = (access.data ?? []).filter((r) => r.outcome === "granted").length;
    return {
      total: tally?.total ?? 0,
      live: (tally?.pending ?? 0) + (tally?.opened ?? 0),
      opened: (tally?.opened ?? 0) + (tally?.used ?? 0),
      granted,
    };
  }, [invitations.data, access.data]);

  return (
    <div className="space-y-6">
      <StatGrid columns={4}>
        <StatCard
          label="Invitations issued"
          value={invitations.isPending ? "—" : counts.total}
          hint="All time, including revoked and expired"
          icon={<Ticket className="h-4 w-4" />}
        />
        <StatCard
          label="Live now"
          value={invitations.isPending ? "—" : counts.live}
          hint="Unexpired, unused, not revoked"
          tone="primary"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Codes opened"
          value={invitations.isPending ? "—" : counts.opened}
          hint="Invitations opened or used at least once"
          icon={<UserCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Sessions granted"
          value={access.isPending ? "—" : counts.granted}
          hint="Recorded demo entries"
          tone="protected"
          icon={<Eye className="h-4 w-4" />}
        />
      </StatGrid>

      <InfoNote tone="attention">
        Everyone who enters the demonstration sees confidential, pre-launch product with fictional
        sample data. Invite deliberately, one person at a time. Registering interest does not entitle
        anyone to access.
      </InfoNote>

      <Tabs defaultValue="invite">
        <TabsList>
          <TabsTrigger value="invite">Invite someone</TabsTrigger>
          <TabsTrigger value="issued">Issued invitations</TabsTrigger>
          <TabsTrigger value="who">Who opened it</TabsTrigger>
        </TabsList>

        <TabsContent value="invite" className="mt-5">
          <InviteFromRegistrations />
        </TabsContent>

        <TabsContent value="issued" className="mt-5">
          <InvitationsPanel />
        </TabsContent>

        <TabsContent value="who" className="mt-5">
          <Panel
            title="Demonstration access log"
            description="Successful and refused attempts. A run of refusals against one address means a code has been passed somewhere it should not have been."
          >
            <AccessLogPanel />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Pick a real registrant, then invite them — rather than retyping an email
 * address and hoping it matches someone in the pipeline.
 *
 * WHY search is server-side and starts empty: this list is registrant personal
 * data. Loading every row into the browser so the box can filter locally would
 * put the entire pipeline in memory on a page whose whole purpose is limiting
 * exposure. Nothing is fetched until someone types.
 */
function InviteFromRegistrations() {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<AdminRegistration | null>(null);

  const query = term.trim();
  const results = useQuery({
    queryKey: adminKeys.registrations({ q: query, take: 8 }),
    queryFn: () => adminApi.registrations({ q: query, take: 8 }),
    enabled: query.length >= 2,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Panel
        title="Choose who to invite"
        description="Search the people who have registered interest, or skip this and invite any email address directly."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="demo-invite-search">Search registrations</Label>
            <Input
              id="demo-invite-search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Name, email, company or city"
              className="mt-2 h-11 rounded-xl bg-secondary/40"
            />
          </div>

          {query.length < 2 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Type at least two characters to search.
            </p>
          ) : results.isPending ? (
            <p className="p-2 text-sm text-muted-foreground">Searching…</p>
          ) : !results.data || results.data.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nobody matches “{query}”. You can still invite an email address directly on the right.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.data.items.map((row) => {
                const active = selected?.id === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(active ? null : row)}
                      aria-pressed={active}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card/40 hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{row.fullName}</p>
                        <Badge variant="outline" className="text-xs">
                          {SEGMENT_LABELS[row.segment] ?? row.segment}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.email}
                        {row.organisation ? ` · ${row.organisation}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Registered {formatDateTime(row.createdAt)} · {row.status}
                        {row.demoInvitationStatus && row.demoInvitationStatus !== "Not invited"
                          ? ` · demo: ${row.demoInvitationStatus}`
                          : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm text-foreground">
                Inviting <span className="font-semibold">{selected.fullName}</span> — the invitation
                will be recorded against their registration.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(null)}>
                Clear
              </Button>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Issue the invitation"
        description="Every invitation expires, is limited in uses, can be revoked, and is recorded when used."
      >
        {/*
          `key` forces a fresh form when the chosen person changes. Without it the
          previous recipient's email would stay in the inputs and the next
          invitation could quietly go to the wrong person.
        */}
        <InvitationForm
          key={selected?.id ?? "direct"}
          registrationId={selected?.id}
          defaultEmail={selected?.email ?? ""}
          defaultName={selected?.fullName ?? ""}
          onIssued={() => setSelected(null)}
        />
      </Panel>
    </div>
  );
}
