import type { HTMLAttributes } from 'react';

export type StatusPillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusPillTone;
}

const tones: Record<StatusPillTone, string> = {
  neutral: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  error: 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-300',
};

const dots: Record<StatusPillTone, string> = {
  neutral: 'bg-secondary-400',
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

export function StatusPill({ tone = 'neutral', className = '', children, ...props }: StatusPillProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} aria-hidden />
      {children}
    </span>
  );
}
