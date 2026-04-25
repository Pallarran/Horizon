import { Skeleton } from "@/components/ui/skeleton";

export default function RetirementLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      {/* Tab bar */}
      <Skeleton className="h-10 w-72 rounded-lg" />

      {/* Slider card */}
      <Skeleton className="h-32 rounded-xl" />

      {/* Income breakdown card */}
      <Skeleton className="h-64 rounded-xl" />

      {/* Key stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Comparison table */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
