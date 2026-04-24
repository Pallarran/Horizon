import { Skeleton } from "@/components/ui/skeleton";

export default function WatchlistLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
