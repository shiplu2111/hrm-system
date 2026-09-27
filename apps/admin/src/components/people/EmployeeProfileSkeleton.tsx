import { Skeleton } from '@/components/ui/Skeleton';

export function EmployeeProfileSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto animate-pulse">
      <Skeleton className="h-4 w-32" />
      <div className="surface rounded-xl border shadow-card p-5 flex gap-6">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="flex gap-2 border-b border-base pb-px">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-t-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
