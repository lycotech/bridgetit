import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, ClipboardCheck, Mail, Ticket, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { adminApi } from "@/lib/admin";
import { useAdminSession } from "@/lib/admin/portal-session";

/**
 * Overview — the first thing an administrator sees after signing in.
 *
 * Deliberately counts, not charts. What an operations administrator opens this
 * page to learn is whether anything is waiting on a person: applications to
 * review, invitations that need issuing. A dashboard of trends answers a
 * question nobody asked at 9am.
 */
function Tile({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  to?: string;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  const shell =
    "group relative rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/40";

  return to ? (
    <Link to={to} className={shell}>
      {body}
      <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export default function PortalOverview() {
  const session = useAdminSession();
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: adminApi.stats, staleTime: 30_000 });

  const firstName = session.data?.name?.split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="PayBridge operations. Everything you do here is recorded against your name."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Registered interest"
          value={stats.data?.total ?? "—"}
          hint={stats.data ? `${stats.data.lastSevenDays} in the last 7 days` : undefined}
          icon={Users}
          to="/admin/users"
        />
        <Tile
          label="Employers"
          value={stats.data?.employer ?? "—"}
          hint="Organisations that registered"
          icon={ClipboardCheck}
          to="/admin/employers"
        />
        <Tile
          label="Demo invitations"
          value={stats.data?.demoInvitations ?? "—"}
          hint="Issued to date"
          icon={Ticket}
          to="/admin/invitations"
        />
        <Tile
          label="Capital partners"
          value={stats.data?.capitalPartner ?? "—"}
          hint="Funding-side interest"
          icon={Users}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold text-foreground">Where to start</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              to="/admin/invitations"
              className="flex items-start gap-3 rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/40"
            >
              <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-foreground">Invite someone to a demonstration</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  Generate a single-use access code for a named person, with an expiry you choose.
                </span>
              </span>
            </Link>
          </li>
          <li>
            <Link
              to="/admin/mail"
              className="flex items-start gap-3 rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/40"
            >
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-foreground">Check outgoing mail</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  Confirm invitations and verification codes are actually being delivered.
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
