import { Lock } from 'lucide-react';
import { PAYROLL_RUN_FLOW, type PayrollRunStatus } from '@hrm/shared-types';
import { StatusPill } from '@/components/ui/StatusPill';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';

const copy = payrollRunsCopy;

/** Shades within a tone so neighbouring steps stay distinguishable in the bar. */
const SEGMENT_CLASS: Record<PayrollRunStatus, string> = {
  draft: 'bg-warning-300 dark:bg-warning-700',
  calculated: 'bg-warning-500',
  under_review: 'bg-accent-500',
  approved: 'bg-success-300 dark:bg-success-700',
  finalized: 'bg-success-500',
  paid: 'bg-success-700 dark:bg-success-400',
  cancelled: 'bg-[rgb(var(--border-strong))]',
};

export function RunStatusPill({ status, locked = false }: { status: PayrollRunStatus; locked?: boolean }) {
  return (
    <StatusPill tone={copy.statusTone[status]}>
      {locked ? <Lock className="h-3 w-3 -ml-0.5" aria-hidden /> : null}
      {copy.status[status]}
    </StatusPill>
  );
}

export function RunStatusDot({ status }: { status: PayrollRunStatus }) {
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${SEGMENT_CLASS[status]}`} />;
}

/** How many active runs sit in each step of the flow. */
export function PayrollStatusBar({
  counts,
  className = '',
}: {
  counts: Partial<Record<PayrollRunStatus, number>> | undefined;
  className?: string;
}) {
  const segments = PAYROLL_RUN_FLOW.map((status) => ({ status, n: counts?.[status] ?? 0 })).filter((s) => s.n > 0);
  const total = segments.reduce((sum, s) => sum + s.n, 0);
  if (total === 0) return null;
  const label = segments.map((s) => `${copy.status[s.status]}: ${s.n}`).join(', ');
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`flex h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-muted))] ${className}`}
    >
      {segments.map((s) => (
        <span key={s.status} className={SEGMENT_CLASS[s.status]} style={{ width: `${(s.n / total) * 100}%` }} />
      ))}
    </div>
  );
}
