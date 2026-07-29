import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi, adminKeys, formatDateTime } from "@/lib/admin";

/**
 * Who opened the demonstration, when, and how.
 *
 * Failed attempts are shown alongside successful ones — a run of refusals
 * against one address is the signal that a link has been forwarded somewhere it
 * should not have been.
 */
export function AccessLogPanel() {
  const { data, isPending } = useQuery({
    queryKey: adminKeys.demoAccess,
    queryFn: adminApi.demoAccess,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead className="hidden md:table-cell">Method</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="hidden lg:table-cell">Page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableCell colSpan={5} className="py-14 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : !data || data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-14 text-center text-sm text-muted-foreground">
                Nobody has attempted access yet.
              </TableCell>
            </TableRow>
          ) : (
            data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-foreground">{entry.email ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {entry.method}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      entry.outcome === "granted" || entry.outcome === "success"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }
                  >
                    {entry.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {entry.path ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
