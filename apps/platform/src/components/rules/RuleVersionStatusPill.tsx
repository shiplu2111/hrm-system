import type { RuleVersionStatus } from '@hrm/shared-types';
import {
  Archive,
  CheckCircle2,
  Clock,
  FileCheck2,
} from 'lucide-react';

interface RuleVersionStatusPillProps {
  status: RuleVersionStatus;
  className?: string;
  showIcon?: boolean;
}

/**
 * Status pill component matching docs/DESIGN_SYSTEM.md §5 status colour convention:
 * - Draft: Warning (amber)
 * - Pending Approval: Primary (blue) / Active in-review
 * - Published: Success (emerald/green)
 * - Superseded / Archived: Neutral / Secondary (slate)
 * - Corner radius: rounded-sm (DESIGN_SYSTEM.md §2.4)
 */
export function RuleVersionStatusPill({
  status,
  className = '',
  showIcon = true,
}: RuleVersionStatusPillProps) {
  switch (status) {
    case 'draft':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 ${className}`}
        >
          {showIcon && <Clock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span>Draft</span>
        </span>
      );

    case 'pending_approval':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 ${className}`}
        >
          {showIcon && <FileCheck2 className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />}
          <span>Pending Approval</span>
        </span>
      );

    case 'published':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 ${className}`}
        >
          {showIcon && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          <span>Published</span>
        </span>
      );

    case 'superseded':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 ${className}`}
        >
          {showIcon && <Archive className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" />}
          <span>Superseded</span>
        </span>
      );

    case 'archived':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 ${className}`}
        >
          {showIcon && <Archive className="h-3 w-3 shrink-0 text-slate-400" />}
          <span>Archived</span>
        </span>
      );
  }
}
