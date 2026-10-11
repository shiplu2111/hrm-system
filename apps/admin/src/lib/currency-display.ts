import type { ExchangeRatePairStatus } from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export const RATE_INPUT_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

export const PAIR_STATUS_DISPLAY: Record<
  ExchangeRatePairStatus,
  { label: string; tone: StatusPillTone }
> = {
  ok: { label: 'Rate in force', tone: 'success' },
  missing: { label: 'No rate today', tone: 'error' },
  ending_soon: { label: 'Ending soon', tone: 'warning' },
  unused: { label: 'Not in use', tone: 'neutral' },
};

/** `YYYY-MM-DD` → `1 Jul 2026`, without shifting the day for the viewer's timezone. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatPeriod(from: string, to: string | null): string {
  return to ? `${formatDateOnly(from)} – ${formatDateOnly(to)}` : `${formatDateOnly(from)} onwards`;
}

/** Display-only: up to 6 significant digits without trailing zeros. */
export function formatRateValue(value: string | number): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return '—';
  const text = number >= 1e6 ? number.toFixed(2) : number.toPrecision(6);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

export function inverseRate(value: string): string {
  const number = Number(value);
  return number > 0 ? formatRateValue(1 / number) : '—';
}

/** Converts a "1 base = x quote" figure into the stored "1 quote = y base" rate (8 dp). */
export function invertForStorage(value: string): string {
  const number = Number(value);
  if (!(number > 0)) return '';
  return (1 / number).toFixed(8).replace(/\.?0+$/, '');
}

export function percentChange(previous: string, next: string): number | null {
  const before = Number(previous);
  const after = Number(next);
  if (!(before > 0) || !(after > 0)) return null;
  return ((after - before) / before) * 100;
}

export function formatPercent(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}
