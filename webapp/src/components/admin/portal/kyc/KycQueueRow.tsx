import { Clock, FileWarning, IdCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime, relativeTime } from "@/lib/platform/format";
import { KYC_STATUS_TONE } from "@/lib/admin/kyc";
import {
  ACCOUNT_TYPE_LABELS,
  ID_TYPE_LABELS,
  KYC_STATUS_LABELS,
  type KycQueueItemView,
} from "../../../../../../backend/src/types";

/**
 * One KYC case, as a row in the reviewer's queue.
 *
 * A button, not a link: opening a case is a logged read of somebody's
 * identity data, and it should behave like the deliberate action it is.
 */
export function KycQueueRow({
  item,
  selected,
  onOpen,
}: {
  item: KycQueueItemView;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "w-full rounded-2xl border px-4 py-3.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          selected
            ? "border-primary/60 bg-primary/[0.06]"
            : "border-border bg-card/60 hover:border-border/80 hover:bg-card",
        )}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
              KYC_STATUS_TONE[item.status],
            )}
          >
            {KYC_STATUS_LABELS[item.status]}
          </span>
          <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[item.accountType]}
          </span>
        </span>

        <span className="mt-1.5 block truncate text-sm font-semibold text-foreground">{item.fullName}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.email}</span>

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {item.submittedAt ? (
            <span className="inline-flex items-center gap-1" title={dateTime(item.submittedAt)}>
              <Clock className="h-3 w-3" aria-hidden />
              {relativeTime(item.submittedAt)}
            </span>
          ) : null}
          {item.idType ? (
            <span className="inline-flex items-center gap-1">
              <IdCard className="h-3 w-3" aria-hidden />
              {ID_TYPE_LABELS[item.idType]}
            </span>
          ) : null}
          {item.missingDocuments.length > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <FileWarning className="h-3 w-3" aria-hidden />
              {item.missingDocuments.length} document{item.missingDocuments.length === 1 ? "" : "s"} missing
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
