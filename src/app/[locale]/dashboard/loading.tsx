import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* 3-column body */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Col 1: Portfolio Portrait */}
        <div className="space-y-6">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>

        {/* Col 2: Income & Dividends */}
        <Skeleton className="h-[420px] rounded-xl" />

        {/* Col 3: Retirement & Projections */}
        <div className="space-y-6">
          <Skeleton className="h-[220px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
