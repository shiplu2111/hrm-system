import type { ReactNode } from 'react';

const TILE_TONES = {
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-400',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-950/40 dark:text-warning-400',
  error: 'bg-error-50 text-error-600 dark:bg-error-950/40 dark:text-error-400',
  neutral: 'bg-[rgb(var(--bg-muted))] text-secondary',
} as const;

export type SummaryTileTone = keyof typeof TILE_TONES;

/** Headline figure for list pages; clickable when `onClick` applies a filter. */
export function SummaryTile({
  icon,
  tone,
  value,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  tone: SummaryTileTone;
  value: string;
  label: string;
  hint: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-primary truncate">{value}</div>
        <div className="text-sm text-secondary mt-0.5">{label}</div>
        <div className="text-xs text-muted mt-0.5">{hint}</div>
      </div>
      <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${TILE_TONES[tone]}`}>{icon}</div>
    </>
  );
  const className = 'surface rounded-xl border border-base shadow-card p-4 flex items-start justify-between gap-3 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:border-strong transition-colors`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
