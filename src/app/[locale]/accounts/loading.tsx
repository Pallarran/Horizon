import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Action button */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Account cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
