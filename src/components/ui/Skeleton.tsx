import { cn } from "@/lib/format";

/** Shimmering grey glass placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4", className)}
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-44 rounded-2xl" />
      ))}
    </div>
  );
}
