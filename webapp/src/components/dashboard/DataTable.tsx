import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingRows } from "./states";
import { downloadCsv } from "@/lib/platform/format";

/**
 * Generic table with search, filters, date range, sorting, pagination and
 * loading / empty / error states. Every list view in the platform uses it so
 * behaviour is identical across portals.
 */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Hide on small screens to keep mobile readable. */
  hideBelow?: "sm" | "md" | "lg";
  width?: string;
}

export interface TableFilter<T> {
  key: string;
  label: string;
  options: readonly string[];
  accessor: (row: T) => string;
}

const DATE_RANGES = [
  { label: "All time", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const;

const HIDE_CLASS = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  search,
  searchPlaceholder = "Search",
  filters,
  dateAccessor,
  pageSize = 8,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyTitle = "Nothing here yet",
  emptyBody = "Records will appear here as activity happens.",
  emptyAction,
  onRowClick,
  caption,
  toolbar,
  exportName,
  exportRow,
  className,
  initialSort,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  dateAccessor?: (row: T) => string;
  pageSize?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  exportName?: string;
  exportRow?: (row: T) => Record<string, unknown>;
  className?: string;
  initialSort?: { key: string; direction: "asc" | "desc" };
  /**
   * What this table lists, in a few words. Rendered as a visually hidden
   * <caption>: sighted people already have the panel heading above the table,
   * but a screen reader announces "table, 6 columns, 8 rows" with no idea what
   * of, and a caption is the only element it reads first (WCAG 1.3.1).
   */
  caption?: string;
}) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [range, setRange] = useState<number>(0);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  /** Describes what pressing a focused row does. See the note above <tbody>. */
  const rowHintId = useId();

  const filtered = useMemo(() => {
    let out = rows;
    if (term.trim() && search) {
      const needle = term.trim().toLowerCase();
      out = out.filter((row) => search(row).toLowerCase().includes(needle));
    }
    if (filters) {
      for (const filter of filters) {
        const value = selected[filter.key];
        if (value && value !== "All") out = out.filter((row) => filter.accessor(row) === value);
      }
    }
    if (range && dateAccessor) {
      const cutoff = Date.now() - range * 86_400_000;
      out = out.filter((row) => +new Date(dateAccessor(row)) >= cutoff);
    }
    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column?.sortValue) {
        const factor = sort.direction === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = column.sortValue!(a);
          const bv = column.sortValue!(b);
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
          return String(av).localeCompare(String(bv)) * factor;
        });
      }
    }
    return out;
  }, [rows, term, search, filters, selected, range, dateAccessor, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const hasControls = Boolean(search || filters?.length || dateAccessor || toolbar || exportRow);

  const toggleSort = (key: string) => {
    const column = columns.find((c) => c.key === key);
    if (!column?.sortValue) return;
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
    setPage(0);
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      {hasControls ? (
        <div className="border-b border-border/70 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            {search ? (
              /* The label used to contain nothing but the magnifying-glass icon, so
                 this box had no accessible name at all — a screen reader announced
                 "edit text, blank" on 22 tables. The placeholder is not a substitute:
                 it is not reliably read as a name and it vanishes on the first
                 keystroke, exactly when somebody might want to re-check what they are
                 searching. The visible name stays the icon; the spoken name is here. */
              <label className="relative min-w-0 flex-1 sm:max-w-xs">
                <span className="sr-only">{searchPlaceholder ?? "Search this table"}</span>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    setPage(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-11 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
                />
              </label>
            ) : null}

            {filters?.length || dateAccessor ? (
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-colors",
                  showFilters
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                Filters
              </button>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              {toolbar}
              {exportRow ? (
                <button
                  type="button"
                  onClick={() => downloadCsv(`${exportName ?? "paybridge-export"}.csv`, filtered.map(exportRow))}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {/* Below `sm` the label is hidden, so the button becomes icon-only
                      and needs a name that is never hidden. */}
                  <span className="sr-only sm:hidden">Export CSV</span>
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              ) : null}
            </div>
          </div>

          {showFilters ? (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border/60 pt-3">
              {filters?.map((filter) => (
                <label key={filter.key} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {filter.label}
                  </span>
                  <select
                    value={selected[filter.key] ?? "All"}
                    onChange={(e) => {
                      setSelected((prev) => ({ ...prev, [filter.key]: e.target.value }));
                      setPage(0);
                    }}
                    className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  >
                    <option value="All">All</option>
                    {filter.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {dateAccessor ? (
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Date range
                  </span>
                  <select
                    value={range}
                    onChange={(e) => {
                      setRange(Number(e.target.value));
                      setPage(0);
                    }}
                    className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  >
                    {DATE_RANGES.map((option) => (
                      <option key={option.label} value={option.days}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSelected({});
                  setRange(0);
                  setTerm("");
                  setPage(0);
                }}
                className="self-end text-xs font-semibold text-primary hover:underline"
              >
                Reset
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingRows rows={pageSize > 6 ? 6 : pageSize} />
      ) : isError ? (
        <ErrorState body={errorMessage} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? emptyTitle : "No matches"}
          body={
            rows.length === 0
              ? emptyBody
              : "Try a different search term, or reset the filters to see everything again."
          }
          action={rows.length === 0 ? emptyAction : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              {caption ? <caption className="sr-only">{caption}</caption> : null}
              <thead>
                <tr className="border-b border-border/70">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      style={column.width ? { width: column.width } : undefined}
                      /* aria-sort, not just an arrow icon: the direction is
                         otherwise conveyed by shape alone. */
                      aria-sort={
                        !column.sortValue
                          ? undefined
                          : sort?.key !== column.key
                            ? "none"
                            : sort.direction === "asc"
                              ? "ascending"
                              : "descending"
                      }
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                        column.align === "right" && "text-right",
                        column.hideBelow && HIDE_CLASS[column.hideBelow],
                      )}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className={cn(
                            "inline-flex min-h-[44px] items-center gap-1 transition-colors hover:text-foreground",
                            sort?.key === column.key && "text-primary",
                          )}
                        >
                          {column.header}
                          {/* Says what the press will do, rather than leaving the
                              user to infer it from an arrow. */}
                          <span className="sr-only">
                            {sort?.key === column.key && sort.direction === "asc"
                              ? " — sorted lowest first. Press to reverse."
                              : sort?.key === column.key
                                ? " — sorted highest first. Press to reverse."
                                : " — press to sort by this column."}
                          </span>
                          {sort?.key === column.key ? (
                            sort.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden />
                            )
                          ) : null}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              {/*
                A clickable row must also be an operable row. Before this, the only
                way to open a record was a mouse click on a <tr> — no tab stop, no
                Enter, nothing for anybody navigating by keyboard, which is most
                people using a screen reader and everybody using a switch or a head
                pointer (WCAG 2.1.1).

                A focusable <tr> is still announced as "row", which does not tell
                anybody that it can be opened, so each row points at the one hint
                below. It stays a <tr> rather than becoming role="button": that would
                buy an announcement and lose the row/column position that makes a
                table navigable in the first place.
              */}
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={getRowId(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-describedby={onRowClick ? rowHintId : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            // Space would otherwise scroll the page out from under them.
                            event.preventDefault();
                            onRowClick(row);
                          }
                        : undefined
                    }
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      onRowClick &&
                        "cursor-pointer transition-colors hover:bg-secondary/45 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3.5 align-middle text-foreground",
                          column.align === "right" && "text-right tnum",
                          column.hideBelow && HIDE_CLASS[column.hideBelow],
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {onRowClick ? (
            <p id={rowHintId} className="sr-only">
              Press Enter to open the full record for this row.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
            {/* aria-live so the count is spoken after paging or filtering. Without it
                the table silently changes under a screen reader and the only way to
                tell whether anything happened is to re-read the whole thing. */}
            <p aria-live="polite" className="text-xs text-muted-foreground tnum">
              Showing {filtered.length === 0 ? 0 : safePage * pageSize + 1}–
              {Math.min(filtered.length, (safePage + 1) * pageSize)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1 text-xs font-semibold text-foreground tnum">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                aria-label="Next page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact two-line cell: primary label with a quieter second line. */
export function CellStack({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-foreground">{primary}</p>
      {secondary ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}
