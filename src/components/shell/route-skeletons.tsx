import { Skeleton } from "@/components/ui/skeleton";

export function TablePageSkeleton({
  columns = 6,
  rows = 7,
  withKpis = true,
}: {
  columns?: number;
  rows?: number;
  withKpis?: boolean;
}) {
  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {withKpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-2 h-7 w-16" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <Skeleton className="h-8 min-w-[200px] flex-1" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="grid gap-3 border-b bg-muted/40 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-20" />
          ))}
        </div>
        <div className="divide-y dark:divide-zinc-800">
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="grid items-center gap-3 px-4 py-3.5"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((__, c) => (
                <Skeleton key={c} className={c === 0 ? "h-4 w-36" : "h-3.5 w-20"} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border bg-muted/35 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-6" />
            </div>
            {Array.from({ length: colIdx % 2 === 0 ? 3 : 2 }).map((__, cardIdx) => (
              <div
                key={cardIdx}
                className="space-y-2.5 rounded-lg border bg-background p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="size-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardWidgetsSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-xl border bg-card p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-5/6 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollaborationSkeleton() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>

      <div className="flex gap-2 border-b pb-3 dark:border-zinc-800">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <Skeleton className="h-16 w-full rounded-md" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="divide-y rounded-xl border bg-card dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/70">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
