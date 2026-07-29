import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Loading, empty and error presentation shared by every dashboard module. */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-secondary/70", className)} />;
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function LoadingPanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <h3 className="mt-4 font-display text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "We could not load this just now",
  body,
  onRetry,
  className,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    /* role="alert" so the failure is spoken when it replaces the loading state.
       Silence is otherwise indistinguishable from a slow connection, and the
       person waiting keeps waiting for something that has already failed. */
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {body ?? "Nothing was charged or changed. Please try again in a moment."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Wraps a React Query result with consistent loading / error handling. */
export function AsyncPanel<T>({
  query,
  children,
  loading,
  errorBody,
}: {
  query: { data?: T; isLoading: boolean; isError: boolean; error?: unknown; refetch: () => void };
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  errorBody?: string;
}) {
  if (query.isLoading) return <>{loading ?? <LoadingPanel />}</>;
  if (query.isError || !query.data)
    return (
      <ErrorState
        body={errorBody ?? (query.error instanceof Error ? query.error.message : undefined)}
        onRetry={query.refetch}
        className="rounded-2xl border border-border bg-card"
      />
    );
  return <>{children(query.data)}</>;
}
