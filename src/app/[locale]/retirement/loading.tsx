import { Skeleton } from "@/components/ui/skeleton";

export default function RetirementLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Skeleton className="h-8 w-52" />

      {/* Tabs */}
      <Skeleton className="h-10 w-80" />

      {/* Scenario cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>

      {/* Pension card */}
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
