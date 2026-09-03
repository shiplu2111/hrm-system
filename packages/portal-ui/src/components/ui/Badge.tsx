import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-[rgb(var(--bg-muted))] text-secondary border-base',
  accent: 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-950/50 dark:text-accent-300 dark:border-accent-800',
  success: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-950/40 dark:text-success-300 dark:border-success-800/60',
  warning: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-950/40 dark:text-warning-300 dark:border-warning-800/60',
  error: 'bg-error-50 text-error-700 border-error-200 dark:bg-error-950/40 dark:text-error-300 dark:border-error-800/60',
  info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
};

const dotColors: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-sky-500',
};

export function Badge({ tone = 'neutral', dot = false, className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[tone]}`} />}
      {children}
    </span>
  );
}
