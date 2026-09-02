import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Sparkline } from '@/components/ui/Progress';

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; up: boolean };
  sparkData?: number[];
  tone?: 'accent' | 'success' | 'warning' | 'error' | 'neutral';
}

const toneClasses: Record<string, { bg: string; text: string; spark: string }> = {
  accent: { bg: 'bg-accent-50 dark:bg-accent-950/40', text: 'text-accent-600 dark:text-accent-400', spark: 'rgb(37 99 235)' },
  success: { bg: 'bg-success-50 dark:bg-success-950/40', text: 'text-success-600 dark:text-success-400', spark: 'rgb(22 163 74)' },
  warning: { bg: 'bg-warning-50 dark:bg-warning-950/40', text: 'text-warning-600 dark:text-warning-400', spark: 'rgb(217 119 6)' },
  error: { bg: 'bg-error-50 dark:bg-error-950/40', text: 'text-error-600 dark:text-error-400', spark: 'rgb(220 38 38)' },
  neutral: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', spark: 'rgb(100 116 139)' },
};

export function KpiCard({ label, value, icon: Icon, trend, sparkData, tone = 'accent' }: KpiCardProps) {
  const t = toneClasses[tone];
  return (
    <div className="surface rounded-xl border shadow-card p-4 hover:shadow-card-hover transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-9 w-9 rounded-lg ${t.bg} flex items-center justify-center`}>
          <Icon className={`h-[18px] w-[18px] ${t.text}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-success-600' : 'text-error-600'}`}>
            {trend.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-primary tracking-tight">{value}</div>
      <div className="text-xs text-secondary mt-0.5">{label}</div>
      {sparkData && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparkData} color={t.spark} />
        </div>
      )}
    </div>
  );
}
