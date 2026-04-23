import { Skeleton } from "@/components/ui/skeleton";

export default function HoldingsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-8">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-[180px]" />
        <Skeleton className="h-9 w-[180px]" />
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="h-9 w-[180px]" />
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Skeleton className="h-[72px] rounded-lg" />
        <Skeleton className="h-[72px] rounded-lg" />
        <Skeleton className="h-[72px] rounded-lg" />
        <Skeleton className="h-[72px] rounded-lg" />
        <Skeleton className="h-[72px] rounded-lg" />
      </div>

      {/* Table */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
