import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
      <Skeleton className="mx-auto h-80 max-w-lg rounded-xl" />
    </div>
  );
}
