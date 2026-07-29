import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminApi,
  adminKeys,
  downloadRegistrationsCsv,
  formatDateTime,
  SEGMENT_LABELS,
  type RegistrationFilters,
  type Vocabulary,
} from "@/lib/admin";
import { RegistrationDrawer } from "@/components/admin/RegistrationDrawer";

const PAGE_SIZE = 25;

/** Sentinel for "no filter" — a Radix SelectItem cannot have an empty value. */
const ANY = "__any__";

const SEGMENT_TONE: Record<string, string> = {
  employee: "border-primary/40 bg-primary/10 text-primary",
  employer: "border-gold/40 bg-gold/10 text-gold",
  capital_partner: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  general: "border-border bg-secondary/60 text-muted-foreground",
};

export function RegistrationsPanel({
  segment,
  onSegmentChange,
  vocabulary,
}: {
  segment: string;
  onSegmentChange: (segment: string) => void;
  vocabulary?: Vocabulary;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters: RegistrationFilters = {
    segment: segment || undefined,
    status: status || undefined,
    q: query || undefined,
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  };

  const { data, isPending, isFetching } = useQuery({
    queryKey: adminKeys.registrations(filters),
    queryFn: () => adminApi.registrations(filters),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  const runExport = async () => {
    setExporting(true);
    try {
      // Export what is on screen, not the whole table: the CSV carries personal
      // data, so the narrower the filter the smaller the copy leaving the system.
      await downloadRegistrationsCsv({ ...filters, take: undefined, skip: undefined });
      toast.success("Export downloaded");
    } catch {
      toast.error("We could not generate that export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(search.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, organisation or location"
            className="h-11 rounded-xl bg-secondary/40 pl-9"
            aria-label="Search registrations"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={segment || ANY}
            onValueChange={(value) => {
              setPage(0);
              onSegmentChange(value === ANY ? "" : value);
            }}
          >
            <SelectTrigger className="h-11 w-[190px] rounded-xl bg-secondary/40">
              <SelectValue placeholder="All segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All segments</SelectItem>
              {(vocabulary?.segments ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {SEGMENT_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status || ANY}
            onValueChange={(value) => {
              setPage(0);
              setStatus(value === ANY ? "" : value);
            }}
          >
            <SelectTrigger className="h-11 w-[180px] rounded-xl bg-secondary/40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All statuses</SelectItem>
              {(vocabulary?.statuses ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={runExport}
            disabled={exporting}
            className="h-11 rounded-xl"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Segment</TableHead>
              <TableHead className="hidden lg:table-cell">Organisation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Follow-up</TableHead>
              <TableHead className="hidden sm:table-cell">Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : data && data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                  No registrations match this filter yet.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  onClick={() => setOpenId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(row.id);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <p className="font-medium text-foreground">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant="outline"
                      className={SEGMENT_TONE[row.segment] ?? SEGMENT_TONE.general}
                    >
                      {row.communityName}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {row.organisation ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{row.status}</TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {row.followUpStatus ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {from}–{to} of {total}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={to >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <RegistrationDrawer
        registrationId={openId}
        vocabulary={vocabulary}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
