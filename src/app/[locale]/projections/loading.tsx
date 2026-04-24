import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectionsLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
      <Skeleton className="h-8 w-48" />
      {/* Input controls */}
      <Skeleton className="h-24 rounded-xl" />
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      {/* Charts */}
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
