import { Skeleton } from "@/components/ui/skeleton";

export default function ContributionsLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      {/* Savings Goal Hero */}
      <Skeleton className="h-40 rounded-xl" />

      {/* 3 account cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>

      {/* Chart */}
      <Skeleton className="h-80 rounded-xl" />

      {/* History table */}
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}
