import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-t border-base text-sm">
      <div className="text-secondary">
        {totalItems === 0
          ? 'No results'
          : `Showing ${start}–${end} of ${totalItems.toLocaleString()}`}
      </div>
      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs">Rows</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-auto text-xs"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-secondary min-w-[4.5rem] text-center">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
