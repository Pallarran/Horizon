import { Skeleton } from "@/components/ui/skeleton";

export default function RetirementLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-12 w-40 rounded-md" />
    </div>
  );
}
