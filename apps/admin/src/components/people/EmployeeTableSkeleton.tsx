import { Skeleton } from '@/components/ui/Skeleton';

export function EmployeeTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
          <tr>
            {Array.from({ length: 6 }, (_, index) => (
              <th key={index} className="px-5 py-2.5">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--border-base))]">
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              <td className="px-5 py-3">
                <Skeleton className="h-4 w-4 rounded" />
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </td>
              <td className="px-5 py-3">
                <Skeleton className="h-3.5 w-24" />
              </td>
              <td className="px-5 py-3 hidden md:table-cell">
                <Skeleton className="h-3.5 w-28" />
              </td>
              <td className="px-5 py-3">
                <Skeleton className="h-5 w-16 rounded-md" />
              </td>
              <td className="px-5 py-3">
                <Skeleton className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
