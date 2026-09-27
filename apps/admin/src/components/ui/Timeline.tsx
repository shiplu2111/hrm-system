import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type TimelineTone = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

export interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  date: string;
  tone?: TimelineTone;
  icon?: LucideIcon;
}

const dotToneClasses: Record<TimelineTone, string> = {
  accent: 'border-accent-300 bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:border-accent-800 dark:text-accent-400',
  success: 'border-success-300 bg-success-50 text-success-600 dark:bg-success-950/40 dark:border-success-800 dark:text-success-400',
  warning: 'border-warning-300 bg-warning-50 text-warning-600 dark:bg-warning-950/40 dark:border-warning-800 dark:text-warning-400',
  error: 'border-error-300 bg-error-50 text-error-600 dark:bg-error-950/40 dark:border-error-800 dark:text-error-400',
  neutral: 'border-base bg-[rgb(var(--bg-muted))] text-secondary',
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="relative space-y-0">
      <div
        className="absolute left-[10px] top-3 bottom-3 w-px bg-[rgb(var(--border-base))]"
        aria-hidden
      />
      <ul className="space-y-6">
        {items.map((item, index) => {
          const tone = item.tone ?? 'accent';
          const Icon = item.icon;
          return (
            <li key={item.id} className="relative flex gap-4 pl-8">
              <div
                className={`absolute left-0 top-0.5 h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center shrink-0 ${dotToneClasses[tone]}`}
              >
                {Icon ? <Icon className="h-3 w-3" /> : null}
              </div>
              <div className={`flex-1 min-w-0 ${index < items.length - 1 ? 'pb-1' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-primary">{item.title}</span>
                  <time className="text-xs text-muted">{item.date}</time>
                </div>
                {item.subtitle ? (
                  <p className="text-sm text-secondary mt-1 leading-snug">{item.subtitle}</p>
                ) : null}
                {item.meta ? (
                  <p className="text-xs text-muted mt-1">{item.meta}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TimelineSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
