import type { ReactNode } from 'react';

export type StatusPillTone = 'neutral' | 'warning' | 'accent' | 'success' | 'error';

/** Semantic tints per DESIGN_SYSTEM.md §5: 50 background, 700 text. */
const tones: Record<StatusPillTone, { pill: string; dot: string }> = {
  neutral: {
    pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  warning: {
    pill: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
    dot: 'bg-warning-500',
  },
  accent: {
    pill: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
    dot: 'bg-accent-500',
  },
  success: {
    pill: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    dot: 'bg-success-500',
  },
  error: {
    pill: 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300',
    dot: 'bg-error-500',
  },
};

export function StatusPill({
  tone,
  children,
  className = '',
}: {
  tone: StatusPillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone].pill} ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tones[tone].dot}`} />
      {children}
    </span>
  );
}
