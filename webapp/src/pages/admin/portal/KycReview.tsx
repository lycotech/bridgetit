import { useEffect, useMemo, useState } from "react";
import { IdCard, ShieldCheck } from "lucide-react";
import { PageHeader, ActionButton } from "@/components/dashboard/PageHeader";
import { Panel, InfoNote } from "@/components/dashboard/Panel";
import { AsyncPanel, EmptyState, LoadingRows } from "@/components/dashboard/states";
import { KycQueueRow } from "@/components/admin/portal/kyc/KycQueueRow";
import { KycCaseDetail } from "@/components/admin/portal/kyc/KycCaseDetail";
import { adminCan, useAdminSession } from "@/lib/admin/portal-session";
import { useKycCase, useKycQueue, type KycFilters } from "@/lib/admin/kyc";
import { KYC_STATUS_LABELS, type KycStatus } from "../../../../../backend/src/types";

const STATUS_TABS: KycStatus[] = ["pending", "approved", "rejected", "not_started"];

/**
 * KYC review — Admin → KYC review.
 *
 * The regulated decision: whether a person's identity is who they say it is.
 * The queue shows nothing decrypted; opening one case does, and every open —
 * of a case or a document — is written to the audit trail server-side.
 */
export default function KycReview() {
  const session = useAdminSession();
  const canDecide = adminCan(session.data, "kyc.decide");

  const [status, setStatus] = useState<KycStatus>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo<KycFilters>(() => ({ status, q: debounced }), [status, debounced]);
  const queue = useKycQueue(filters);
  const kycCase = useKycCase(selected);

  const counts = queue.data?.pages[0]?.counts;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Compliance"
        title="KYC review"
        description="Identity checks waiting on a decision, and the documents behind them."
      />

      {counts ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Count label="Awaiting review" value={counts.pending} tone="attention" />
          <Count label="Verified" value={counts.approved} />
          <Count label="Needs attention" value={counts.rejected} />
          <Count label="Not started" value={counts.notStarted} />
        </ul>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Panel title="The queue" description="Oldest submission first." bodyClassName="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setStatus(tab);
                    setSelected(null);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    status === tab
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                >
                  {KYC_STATUS_LABELS[tab]}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
            />
          </div>

          <AsyncPanel query={queue} loading={<LoadingRows rows={5} />}>
            {(data) => {
              const items = data.pages.flatMap((page) => page.items);
              if (items.length === 0) {
                return (
                  <EmptyState
                    icon={<IdCard className="h-5 w-5" />}
                    title="Nothing here"
                    body="No case matches this filter."
                  />
                );
              }
              return (
                <>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <KycQueueRow
                        key={item.userId}
                        item={item}
                        selected={item.userId === selected}
                        onOpen={() => setSelected(item.userId)}
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
                        Load older cases
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
            <AsyncPanel query={kycCase} loading={<LoadingRows rows={6} />}>
              {(data) => <KycCaseDetail kycCase={data} canDecide={canDecide} />}
            </AsyncPanel>
          ) : (
            <Panel title="No case open" description="Choose one from the queue to review it.">
              <EmptyState
                icon={<IdCard className="h-5 w-5" />}
                title="Nothing open"
                body="Opening a case decrypts identity data for this screen only, and is recorded against your name."
              />
            </Panel>
          )}
        </div>
      </div>

      <InfoNote tone="neutral" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
        Decrypted identity fields — id number, date of birth, address, BVN — appear only on an open case, one at a
        time, and every open is logged. The queue itself never carries them.
      </InfoNote>
    </div>
  );
}

function Count({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "attention" }) {
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
