import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
      {/* Action button */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Table */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
