import { useEffect, useMemo, useState } from "react";
import { Download, FileClock, Lock } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingRows } from "@/components/dashboard/states";
import { AuditEventRow } from "@/components/admin/portal/audit/AuditEventRow";
import { AuditFilterBar } from "@/components/admin/portal/audit/AuditFilterBar";
import { downloadAuditCsv, useAuditTrail, type AuditFilters } from "@/lib/admin/audit";

/**
 * Audit logs — the reader for PayBridge's append-only record.
 *
 * What this screen deliberately cannot do: change anything. There is no edit
 * control, no delete, and no endpoint behind either — the server exposes exactly
 * two routes for this table, a filtered read and a CSV export. An audit trail an
 * administrator can amend is not evidence, and the person most likely to want to
 * amend it is the one it names.
 *
 * Everything else follows from the table being unbounded: filters run on the
 * server, paging is a cursor rather than a page number (the trail is appended to
 * while you read it), and the total is capped so a search never becomes a full
 * table scan.
 */
export default function AuditLogs() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Debounced: the search box hits the database, so one request per keystroke
  // would be one scan per keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo<AuditFilters>(() => ({ ...filters, q: debounced }), [filters, debounced]);
  const trail = useAuditTrail(query);

  const filtered = Boolean(
    filters.group || filters.action || filters.outcome || filters.from || filters.to || debounced,
  );
  const total = trail.data?.pages[0]?.total ?? 0;
  const totalIsFloor = trail.data?.pages[0]?.totalIsFloor ?? false;

  async function runExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadAuditCsv(query);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The export could not be prepared.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Evidence"
        title="Audit logs"
        description="An append-only record of every consequential action taken in PayBridge — who did it, when, from which address, and what changed."
        actions={
          <ActionButton
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={runExport}
            loading={exporting}
          >
            Export CSV
          </ActionButton>
        }
      />

      {exportError ? (
        <InfoNote tone="attention">{exportError}</InfoNote>
      ) : (
        <InfoNote tone="neutral">
          An export carries whichever filter is applied below, up to 5,000 rows, and is itself recorded here as{" "}
          <strong className="font-semibold text-foreground">Audit trail exported</strong> — including who took the copy.
        </InfoNote>
      )}

      <Panel
        title="Recorded activity"
        description="Newest first. Open a row for the full record: device, request id, status change and the event's own detail."
        bodyClassName="space-y-4"
        action={
          trail.data ? (
            <span className="text-xs font-semibold text-muted-foreground tnum">
              {totalIsFloor
                ? `${total.toLocaleString()}+ events`
                : `${total.toLocaleString()} event${total === 1 ? "" : "s"}`}
            </span>
          ) : null
        }
      >
        <AuditFilterBar filters={filters} onChange={setFilters} search={search} onSearchChange={setSearch} />

        <AsyncPanel query={trail} loading={<LoadingRows rows={6} />}>
          {(data) => {
            const events = data.pages.flatMap((page) => page.items);
            if (events.length === 0) {
              return (
                <EmptyState
                  icon={<FileClock className="h-5 w-5" />}
                  title={filtered ? "Nothing matches that" : "Nothing recorded yet"}
                  body={
                    filtered
                      ? "No event matches this filter. Widen the dates or clear it — an empty result here means no match, not no activity."
                      : "Sign-ins, KYC decisions, invitations and role changes appear here as they happen."
                  }
                />
              );
            }
            return (
              <>
                <ul className="space-y-2">
                  {events.map((event) => (
                    <AuditEventRow key={event.id} event={event} />
                  ))}
                </ul>

                {trail.hasNextPage ? (
                  <div className="flex justify-center pt-1">
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      onClick={() => trail.fetchNextPage()}
                      loading={trail.isFetchingNextPage}
                    >
                      Load older events
                    </ActionButton>
                  </div>
                ) : (
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    That is the end of the record for this filter.
                  </p>
                )}
              </>
            );
          }}
        </AsyncPanel>
      </Panel>

      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Entries cannot be edited or deleted by anyone, including a Super Admin — a correction is a new entry, so both
          the mistake and the fix stay visible. Every event is also written to the server's log stream as it happens, so
          the record survives the database.
        </span>
      </p>
    </div>
  );
}
