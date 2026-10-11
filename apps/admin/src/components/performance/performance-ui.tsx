import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  PERFORMANCE_RATING_SCALE,
  type EmployeePerformanceReviewStatus,
  type Performance360Summary,
  type PromotionRecommendationStatus,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';
import { ApiError } from '@/lib/tenant-api-client';

export const REVIEW_TONE: Record<EmployeePerformanceReviewStatus, StatusPillTone> = {
  not_started: 'neutral',
  self_assessment_draft: 'accent',
  self_submitted: 'warning',
  manager_review: 'accent',
  pending_approval: 'warning',
  approved: 'success',
  returned: 'error',
  cancelled: 'neutral',
};

export const PROMOTION_TONE: Record<PromotionRecommendationStatus, StatusPillTone> = {
  none: 'neutral',
  draft: 'neutral',
  submitted: 'warning',
  approved: 'accent',
  rejected: 'error',
  executed: 'success',
};

export const COMPETENCY_DETAILS: Record<string, string> = {
  impact: 'Prioritises work that creates measurable customer and company value.',
  ownership: 'Takes accountability and resolves ambiguity proactively.',
  collaboration: 'Builds trust across functions and shares context effectively.',
  craft: 'Shows deep expertise and raises the quality bar.',
};

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

export function formatDay(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function ratingText(value: number | null | undefined): string | null {
  return PERFORMANCE_RATING_SCALE.find((step) => step.value === value)?.label ?? null;
}

export function formatScore(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(2);
}

export function Banner({
  icon: Icon,
  tone = 'neutral',
  children,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'warning' | 'error';
  children: ReactNode;
}) {
  const classes = {
    neutral: 'border-base bg-[rgb(var(--bg-muted))] text-secondary',
    warning:
      'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200',
    error: 'border-error-200 bg-error-50 text-error-700 dark:border-error-900 dark:bg-error-950/30 dark:text-error-300',
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function RatingScale({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="shrink-0 md:text-right">
      <div className="flex gap-1 md:justify-end" role="radiogroup" aria-label={label}>
        {PERFORMANCE_RATING_SCALE.map((step) => (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={value === step.value}
            title={`${step.value} · ${step.label}`}
            disabled={disabled}
            onClick={() => onChange(step.value)}
            className={`h-8 w-8 rounded-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
              value === step.value
                ? 'border-accent-600 bg-accent-600 text-white'
                : 'border-base surface text-secondary enabled:hover:border-accent-400 enabled:hover:text-accent-600'
            } ${disabled && value !== step.value ? 'opacity-50' : ''}`}
          >
            {step.value}
          </button>
        ))}
      </div>
      <p className={`mt-1 text-xs ${value ? 'text-secondary' : 'text-warning-700 dark:text-warning-300'}`}>
        {ratingText(value) ?? 'Not rated'}
      </p>
    </div>
  );
}

const RADAR_SHORT_LABELS: Record<string, string> = {
  impact: 'Impact',
  craft: 'Craft',
};

/** Competency radar for up to three series rated 1–5. */
export function CompetencyRadar({
  axes,
  series,
}: {
  axes: Array<{ key: string; label: string }>;
  series: Array<{ name: string; color: string; values: Array<number | null> }>;
}) {
  const center = 130;
  const radius = 84;
  const count = Math.max(axes.length, 3);
  const angleAt = (index: number) => -Math.PI / 2 + (index * Math.PI * 2) / count;
  const point = (index: number, value: number): [number, number] => {
    const distance = (radius * value) / 5;
    return [center + Math.cos(angleAt(index)) * distance, center + Math.sin(angleAt(index)) * distance];
  };
  const polygon = (valueAt: (index: number) => number) =>
    axes.map((_, index) => point(index, valueAt(index)).join(',')).join(' ');

  return (
    <svg viewBox="-50 0 360 260" className="mx-auto h-60 w-full max-w-[340px]" role="img" aria-label="Competency ratings radar chart">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={polygon(() => level)}
          fill={level % 2 ? 'rgb(var(--bg-muted))' : 'none'}
          fillOpacity=".35"
          stroke="rgb(var(--border-strong))"
          strokeWidth="1"
        />
      ))}
      {axes.map((axis, index) => {
        const [x, y] = point(index, 5);
        const [lx, ly] = point(index, 5.7);
        const cos = Math.cos(angleAt(index));
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
        return (
          <g key={axis.key}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="rgb(var(--border-base))" />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-[rgb(var(--text-secondary))] text-[11px] font-medium"
            >
              {RADAR_SHORT_LABELS[axis.key] ?? axis.label}
            </text>
          </g>
        );
      })}
      {series
        .filter((item) => item.values.some((value) => value != null))
        .map((item) => (
          <g key={item.name}>
            <polygon
              points={polygon((index) => item.values[index] ?? 0)}
              fill={item.color}
              fillOpacity=".12"
              stroke={item.color}
              strokeWidth="2"
            />
            {item.values.map((value, index) => {
              if (value == null) return null;
              const [x, y] = point(index, value);
              return <circle key={axes[index].key} cx={x} cy={y} r="3" fill={item.color} />;
            })}
          </g>
        ))}
    </svg>
  );
}

export function anonymityNote(summary: Performance360Summary): string | null {
  if (summary.responseCount === 0) return 'No responses yet.';
  if (!summary.visible) {
    return `Results appear once ${summary.minResponses} people have responded, so no single answer can be identified.`;
  }
  return null;
}
