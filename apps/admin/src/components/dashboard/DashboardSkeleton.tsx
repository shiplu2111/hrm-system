import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCardSkeleton } from '@/components/dashboard/KpiCardSkeleton';

export function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-7 w-24 rounded-lg" />
          </CardHeader>
          <CardBody>
            <Skeleton className="h-[220px] w-full rounded-lg" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-44" />
          </CardHeader>
          <CardBody className="flex flex-col items-center">
            <Skeleton className="h-[180px] w-[180px] rounded-full" />
            <div className="mt-4 w-full space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-sm shrink-0" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-6" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="flex items-center justify-between">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[rgb(var(--border-base))]">
                {Array.from({ length: 4 }, (_, row) => (
                  <div key={row} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/5" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                    <Skeleton className="h-3 w-12 hidden sm:block" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
