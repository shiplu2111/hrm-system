import { computeShiftDuration } from '@hrm/shared-types';
import { formatMinutes, type ShiftColor } from '@/lib/shift-roster';

function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

const TICKS = [0, 6, 12, 18, 24];

/** 24-hour track showing the shift window; overnight shifts wrap past midnight. */
export function ShiftTimeline({
  startTime,
  endTime,
  breakMinutes,
  color,
}: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: ShiftColor;
}) {
  const duration = computeShiftDuration(startTime, endTime, breakMinutes);
  if (!duration || startTime === endTime) {
    return (
      <div className="rounded-lg border border-dashed border-base px-4 py-5 text-center text-xs text-muted">
        Enter a start and end time to preview the shift.
      </div>
    );
  }

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const segments = duration.crossesMidnight
    ? [
        { from: start, to: 1440 },
        { from: 0, to: end },
      ].filter((s) => s.to > s.from)
    : [{ from: start, to: end }];

  return (
    <div className="rounded-lg border border-base px-4 pt-3 pb-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <p className="text-sm text-primary">
          <span className="font-semibold tabular-nums">{formatMinutes(duration.netMinutes)}</span>{' '}
          <span className="text-secondary">working time</span>
        </p>
        <p className="text-xs text-muted tabular-nums">
          {formatMinutes(duration.grossMinutes)} on site
          {breakMinutes > 0 ? ` − ${formatMinutes(breakMinutes)} break` : ''}
          {duration.crossesMidnight ? ' · ends next day' : ''}
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-[rgb(var(--bg-muted))] overflow-hidden" aria-hidden>
        {segments.map((s) => (
          <div
            key={s.from}
            className={`absolute inset-y-0 ${color.dot} opacity-90`}
            style={{ left: `${(s.from / 1440) * 100}%`, width: `${((s.to - s.from) / 1440) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative h-4 mt-1 text-2xs text-muted tabular-nums" aria-hidden>
        {TICKS.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h % 24).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  );
}
