import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 lg:px-8" aria-busy="true">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
        <Skeleton className="h-6 w-64 rounded-full" />
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-12 w-4/5 max-w-xl" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <div className="mt-3 flex gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-48" />
        </div>
      </div>
      <Skeleton className="mx-auto mt-16 h-[380px] max-w-5xl rounded-xl" />
    </div>
  );
}
