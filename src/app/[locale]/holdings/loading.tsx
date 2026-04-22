import { Skeleton } from "@/components/ui/skeleton";

export default function HoldingsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Title + button */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-10 w-80" />

      {/* Account summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>

      {/* Table */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
