import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditFilters } from "@/lib/admin/audit";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_GROUPS,
  AUDIT_OUTCOMES,
  AUDIT_OUTCOME_LABELS,
  auditActionLabel,
  type AuditAction,
  type AuditActionGroupKey,
  type AuditOutcome,
} from "../../../../../../backend/src/types";

/**
 * Filters for the audit trail. Every value here is sent to the server, which is
 * what makes the section usable on a table that only grows.
 *
 * The group pills and the action list are generated from AUDIT_ACTIONS in the
 * shared contract file — the same array the server enforces on write. An action
 * that can be recorded is therefore always findable, without anyone remembering
 * to add it to a dropdown.
 */
const GROUP_PILLS: { value: "" | AuditActionGroupKey; label: string }[] = [
  { value: "", label: "Everything" },
  ...AUDIT_ACTION_GROUPS.map((group) => ({ value: group.key, label: group.label })),
];

const selectClass =
  "h-9 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground focus:border-primary/60 focus:outline-none";

export function AuditFilterBar({
  filters,
  onChange,
  search,
  onSearchChange,
}: {
  filters: AuditFilters;
  onChange: (next: AuditFilters) => void;
  /** Raw search text, held by the page so it can debounce before filtering. */
  search: string;
  onSearchChange: (value: string) => void;
}) {
  /*
   * Choosing a group clears a specific action. WHY: the two can contradict each
   * other ("Administrators" + "KYC approved" matches nothing), and an empty
   * result caused by a stale dropdown reads as "no such activity" — the single
   * most misleading thing an audit log can say.
   */
  const setGroup = (group: "" | AuditActionGroupKey) => onChange({ ...filters, group, action: "" });

  const actionsInGroup = filters.group
    ? AUDIT_ACTIONS.filter((action) =>
        action.startsWith(AUDIT_ACTION_GROUPS.find((g) => g.key === filters.group)?.prefix ?? ""),
      )
    : AUDIT_ACTIONS;

  const dirty = Boolean(
    filters.group || filters.action || filters.outcome || filters.from || filters.to || search,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {GROUP_PILLS.map((pill) => (
          <button
            key={pill.value || "all"}
            type="button"
            onClick={() => setGroup(pill.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              (filters.group ?? "") === pill.value
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Action"
          value={filters.action ?? ""}
          onChange={(event) => onChange({ ...filters, action: event.target.value as AuditAction | "" })}
          className={cn(selectClass, "max-w-[15rem]")}
        >
          <option value="">Any action</option>
          {actionsInGroup.map((action) => (
            <option key={action} value={action}>
              {auditActionLabel(action)}
            </option>
          ))}
        </select>

        <select
          aria-label="Outcome"
          value={filters.outcome ?? ""}
          onChange={(event) => onChange({ ...filters, outcome: event.target.value as AuditOutcome | "" })}
          className={selectClass}
        >
          <option value="">Any outcome</option>
          {AUDIT_OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {AUDIT_OUTCOME_LABELS[outcome]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          From
          <input
            type="date"
            value={filters.from ?? ""}
            max={filters.to || undefined}
            onChange={(event) => onChange({ ...filters, from: event.target.value })}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          To
          <input
            type="date"
            value={filters.to ?? ""}
            min={filters.from || undefined}
            onChange={(event) => onChange({ ...filters, to: event.target.value })}
            className={selectClass}
          />
        </label>

        <label className="relative min-w-[13rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Actor, target id, IP or request id"
            className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
          />
        </label>

        {dirty ? (
          <button
            type="button"
            onClick={() => {
              onChange({ group: "", action: "", outcome: "", from: "", to: "" });
              onSearchChange("");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
