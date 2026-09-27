import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

interface SortableHeaderProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  className?: string;
}

export function SortableHeader({
  label,
  active,
  direction,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const Icon = active
    ? direction === 'asc'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={onSort}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-secondary uppercase tracking-wide hover:text-primary transition-colors ${className}`}
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${active ? 'text-accent-600' : 'text-muted'}`} />
    </button>
  );
}

interface DataTableProps {
  children: ReactNode;
  className?: string;
}

export function DataTable({ children, className = '' }: DataTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-[rgb(var(--bg-muted))] border-b border-base shadow-[0_1px_0_rgb(var(--border-base))]">
      {children}
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[rgb(var(--border-base))]">{children}</tbody>;
}
