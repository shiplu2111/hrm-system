import { Skeleton } from '@/components/ui/Skeleton';

export function KpiCardSkeleton() {
  return (
    <div className="surface rounded-xl border shadow-card p-4">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3.5 w-28" />
    </div>
  );
}
