import { Skeleton } from "@/components/ui/skeleton";

export default function ContributionsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Skeleton className="h-8 w-40" />

      {/* Tabs */}
      <Skeleton className="h-10 w-64" />

      {/* Grid table */}
      <Skeleton className="h-[500px] rounded-xl" />

      {/* Summary */}
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
