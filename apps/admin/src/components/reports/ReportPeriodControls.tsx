import { CalendarClock } from 'lucide-react';
import type { ReportPeriod, ReportPeriodMode } from '@hrm/shared-types';
import { Input, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { reportsCopy as copy } from '@/lib/reports-copy';
import { matchPreset, presetRange, PRESETS_BY_MODE, type PeriodError, type PeriodPreset } from '@/lib/report-table';

interface Props {
  mode: ReportPeriodMode;
  period: ReportPeriod;
  error: PeriodError;
  onChange: (period: ReportPeriod) => void;
}

const CUSTOM = 'custom';

export function ReportPeriodControls({ mode, period, error, onChange }: Props) {
  if (mode === 'snapshot') {
    return (
      <p className="flex items-center gap-2 text-sm text-secondary">
        <CalendarClock className="h-4 w-4 text-muted" aria-hidden />
        {copy.period.snapshot}
      </p>
    );
  }

  const preset = matchPreset(mode, period);
  const invalid = error !== null;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-xs font-medium text-secondary mb-1">{copy.period.label}</span>
          <Select
            value={preset ?? CUSTOM}
            onChange={(e) => {
              if (e.target.value !== CUSTOM) onChange(presetRange(e.target.value as PeriodPreset));
            }}
            className="h-9 py-1 w-40"
          >
            {PRESETS_BY_MODE[mode].map((key) => (
              <option key={key} value={key}>
                {copy.period.presets[key]}
              </option>
            ))}
            <option value={CUSTOM} disabled={preset !== null}>
              {copy.period.custom}
            </option>
          </Select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-secondary mb-1">{copy.period.from}</span>
          <Input
            type="date"
            value={period.from}
            max={period.to || undefined}
            onChange={(e) => onChange({ ...period, from: e.target.value })}
            aria-invalid={invalid}
            className="h-9 py-1 w-40"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-secondary mb-1">{copy.period.to}</span>
          <Input
            type="date"
            value={period.to}
            min={period.from || undefined}
            onChange={(e) => onChange({ ...period, to: e.target.value })}
            aria-invalid={invalid}
            className="h-9 py-1 w-40"
          />
        </label>
      </div>
      {error ? (
        <FieldError message={copy.period[error]} />
      ) : mode === 'upcoming' ? (
        <p className="mt-1 text-xs text-muted">{copy.period.upcomingHint}</p>
      ) : null}
    </div>
  );
}
