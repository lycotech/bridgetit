import { Building2, CalendarClock, Landmark, Mail, Ticket, Users } from "lucide-react";
import type { AdminStats } from "@/lib/admin";
import { cn } from "@/lib/utils";

/** Headline counts. Segment tiles double as one-click filters. */
export function StatTiles({
  stats,
  activeSegment,
  onSelectSegment,
}: {
  stats?: AdminStats;
  activeSegment: string;
  onSelectSegment: (segment: string) => void;
}) {
  const tiles = [
    { key: "", label: "All registrations", value: stats?.total, icon: Users },
    { key: "employee", label: "Employees", value: stats?.employee, icon: Users },
    { key: "employer", label: "Employers", value: stats?.employer, icon: Building2 },
    { key: "capital_partner", label: "Capital Partners", value: stats?.capitalPartner, icon: Landmark },
    { key: "general", label: "General enquiries", value: stats?.general, icon: Mail },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
      {tiles.map((tile) => {
        const active = activeSegment === tile.key;
        return (
          <button
            key={tile.label}
            type="button"
            onClick={() => onSelectSegment(tile.key)}
            aria-pressed={active}
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              active
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-card/60 hover:border-primary/30",
            )}
          >
            <tile.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
            <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-foreground">
              {tile.value ?? "—"}
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{tile.label}</p>
          </button>
        );
      })}

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-foreground">
          {stats?.lastSevenDays ?? "—"}
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">Last 7 days</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-foreground">
          {stats?.demoInvitations ?? "—"}
        </p>
        {/* The server counts invitations that have not been revoked. */}
        <p className="mt-1 text-xs leading-snug text-muted-foreground">Live demo invitations</p>
      </div>
    </div>
  );
}
