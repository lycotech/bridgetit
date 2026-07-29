import { Search } from "lucide-react";
import { SelectField } from "@/components/dashboard/forms";
import { cn } from "@/lib/utils";
import type { SupportFilters } from "@/lib/admin/support";
import {
  LOCALE_CODES,
  LOCALE_ENGLISH_NAMES,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TICKET_STATUSES,
  type LocaleCode,
  type SupportPriority,
  type SupportTicketStatus,
} from "../../../../../../backend/src/types";

/**
 * Filters for the queue.
 *
 * Every control is a real labelled form control — no icon-only dropdowns and no
 * placeholder-as-label. The search box has a visible label rather than relying on
 * the magnifying glass, because "search" as a picture is a guess and this portal
 * is used by people reading it in a second language.
 */
export function SupportFilterBar({
  filters,
  onChange,
  search,
  onSearchChange,
}: {
  filters: SupportFilters;
  onChange: (next: SupportFilters) => void;
  search: string;
  onSearchChange: (next: string) => void;
}) {
  const set = (patch: Partial<SupportFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background/40 p-3.5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Where it stands"
          value={filters.status ?? ""}
          onChange={(next) => set({ status: next as SupportTicketStatus | "" })}
          options={[
            { value: "", label: "Any status" },
            ...SUPPORT_TICKET_STATUSES.map((value) => ({ value, label: SUPPORT_STATUS_LABELS[value] })),
          ]}
        />
        <SelectField
          label="Urgency"
          value={filters.priority ?? ""}
          onChange={(next) => set({ priority: next as SupportPriority | "" })}
          options={[
            { value: "", label: "Any urgency" },
            ...SUPPORT_PRIORITIES.map((value) => ({ value, label: SUPPORT_PRIORITY_LABELS[value] })),
          ]}
        />
        <SelectField
          label="Language"
          value={filters.locale ?? ""}
          onChange={(next) => set({ locale: next as LocaleCode | "" })}
          options={[
            { value: "", label: "Any language" },
            ...LOCALE_CODES.map((value) => ({ value, label: LOCALE_ENGLISH_NAMES[value] })),
          ]}
        />
        <SelectField
          label="Owner"
          value={filters.assignee ?? ""}
          onChange={(next) => set({ assignee: next })}
          options={[
            { value: "", label: "Anyone" },
            { value: "mine", label: "Assigned to me" },
            { value: "unassigned", label: "Nobody yet" },
          ]}
        />

        <div>
          <label
            htmlFor="support-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="support-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Reference, name, email or title"
              aria-describedby="support-search-hint"
              className={cn(
                "h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground",
                "placeholder:text-muted-foreground/70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            />
          </div>
          <p id="support-search-hint" className="mt-1.5 text-xs text-muted-foreground">
            Searches titles and contact details, never the contents of what someone wrote.
          </p>
        </div>

        <fieldset className="self-end">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Narrow it down
          </legend>
          <label className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-input bg-background px-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={Boolean(filters.assisted)}
              onChange={(event) => set({ assisted: event.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Only people who asked for help setting up
          </label>
        </fieldset>
      </div>
    </div>
  );
}
