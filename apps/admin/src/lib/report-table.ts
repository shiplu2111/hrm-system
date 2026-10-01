import type { ReportColumn, ReportPeriod, ReportPeriodMode, ReportResult } from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export type ReportRow = ReportResult['rows'][number];
export type ReportCellValue = ReportRow[string];
export type ColumnKind = 'status' | 'number' | 'date' | 'text';

export interface AnalyzedColumn extends ReportColumn {
  kind: ColumnKind;
  /** Fraction digits to display for number columns (fixed-point strings keep their precision). */
  decimals: number;
  /** Whether a column total is meaningful (counts, amounts, hours — not rates or identifiers). */
  summable: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC = /^-?\d+(\.\d+)?$/;
const IDENTIFIER_KEY = /(id|number|code|reference)$/i;
const NON_SUMMABLE_KEY = /(rate|percent|ratio|average|avg)/i;

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

export type PeriodPreset =
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'yearToDate'
  | 'lastYear'
  | 'next30'
  | 'next90'
  | 'next12Months';

export const PRESETS_BY_MODE: Record<Exclude<ReportPeriodMode, 'snapshot'>, PeriodPreset[]> = {
  historical: ['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'yearToDate', 'lastYear'],
  upcoming: ['next30', 'next90', 'next12Months'],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (the user picks dates in their own timezone). */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function presetRange(preset: PeriodPreset, today = new Date()): ReportPeriod {
  const y = today.getFullYear();
  const m = today.getMonth();
  const quarterStart = m - (m % 3);
  const range = (from: Date, to: Date) => ({ from: toIsoDate(from), to: toIsoDate(to) });
  switch (preset) {
    case 'thisMonth':
      return range(new Date(y, m, 1), today);
    case 'lastMonth':
      return range(new Date(y, m - 1, 1), new Date(y, m, 0));
    case 'thisQuarter':
      return range(new Date(y, quarterStart, 1), today);
    case 'lastQuarter':
      return range(new Date(y, quarterStart - 3, 1), new Date(y, quarterStart, 0));
    case 'yearToDate':
      return range(new Date(y, 0, 1), today);
    case 'lastYear':
      return range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
    case 'next30':
      return range(today, addDays(today, 30));
    case 'next90':
      return range(today, addDays(today, 90));
    case 'next12Months':
      return range(today, new Date(y + 1, m, today.getDate()));
  }
}

export function defaultPeriod(mode: ReportPeriodMode, today = new Date()): ReportPeriod {
  return presetRange(mode === 'upcoming' ? 'next90' : 'thisMonth', today);
}

export function matchPreset(mode: ReportPeriodMode, period: ReportPeriod, today = new Date()): PeriodPreset | null {
  if (mode === 'snapshot') return null;
  return (
    PRESETS_BY_MODE[mode].find((preset) => {
      const candidate = presetRange(preset, today);
      return candidate.from === period.from && candidate.to === period.to;
    }) ?? null
  );
}

export type PeriodError = 'invalidDate' | 'invalidRange' | null;

export function validatePeriod(period: ReportPeriod): PeriodError {
  const valid = (value: string) => ISO_DATE.test(value) && Number(value.slice(0, 4)) >= 1900;
  if (!valid(period.from) || !valid(period.to)) return 'invalidDate';
  return period.from > period.to ? 'invalidRange' : null;
}

// ---------------------------------------------------------------------------
// Columns and cells
// ---------------------------------------------------------------------------

export function isStatusKey(key: string): boolean {
  return key === 'status' || /Status$/.test(key);
}

function fractionDigits(value: ReportCellValue): number {
  if (typeof value === 'number') return Number.isInteger(value) ? 0 : 2;
  const dot = String(value).indexOf('.');
  return dot === -1 ? 0 : String(value).length - dot - 1;
}

export function analyzeColumns(result: ReportResult): AnalyzedColumn[] {
  return result.columns.map((column) => {
    const values = result.rows
      .map((row) => row[column.key])
      .filter((value) => value !== null && value !== undefined && value !== '');
    let kind: ColumnKind = 'text';
    if (isStatusKey(column.key)) kind = 'status';
    else if (values.length > 0 && values.every((value) => typeof value === 'string' && ISO_DATE.test(value))) {
      kind = 'date';
    } else if (
      values.length > 0 &&
      !IDENTIFIER_KEY.test(column.key) &&
      values.every((value) => typeof value === 'number' || NUMERIC.test(value as string))
    ) {
      kind = 'number';
    }
    const decimals = kind === 'number' ? Math.max(0, ...values.map(fractionDigits)) : 0;
    return { ...column, kind, decimals, summable: kind === 'number' && !NON_SUMMABLE_KEY.test(column.key) };
  });
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, decimals: number): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
}

export function formatReportDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

export function humanize(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value;
}

export function isEmptyCell(value: ReportCellValue | undefined): boolean {
  return value === null || value === undefined || value === '';
}

export function formatCell(column: AnalyzedColumn, value: ReportCellValue | undefined): string {
  if (isEmptyCell(value)) return '';
  if (column.kind === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? formatNumber(n, column.decimals) : String(value);
  }
  if (column.kind === 'date') return formatReportDate(String(value));
  if (column.kind === 'status') return humanize(String(value));
  return String(value);
}

const STATUS_TONES: Array<[StatusPillTone, string[]]> = [
  ['success', ['present', 'approved', 'finalized', 'paid', 'completed', 'processed', 'resolved', 'active', 'success', 'sent']],
  ['warning', ['late', 'early_leave', 'half_day', 'pending', 'under_review', 'calculated', 'processing', 'partial', 'review', 'flagged']],
  ['error', ['absent', 'failed', 'rejected', 'cancelled', 'canceled', 'overdue', 'error', 'missing']],
  ['accent', ['on_leave', 'leave', 'holiday', 'submitted']],
];

export function statusTone(value: ReportCellValue | undefined): StatusPillTone {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_TONES.find(([, values]) => values.includes(normalized))?.[0] ?? 'neutral';
}

// ---------------------------------------------------------------------------
// Filtering, sorting, totals
// ---------------------------------------------------------------------------

export function filterRows(rows: ReportRow[], columns: AnalyzedColumn[], query: string): ReportRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    columns.some((column) => {
      const value = row[column.key];
      if (isEmptyCell(value)) return false;
      return String(value).toLowerCase().includes(q) || formatCell(column, value).toLowerCase().includes(q);
    }),
  );
}

const textCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortRows(rows: ReportRow[], column: AnalyzedColumn, dir: 'asc' | 'desc'): ReportRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[column.key];
    const bv = b[column.key];
    // Blank cells sink to the bottom regardless of direction.
    if (isEmptyCell(av) || isEmptyCell(bv)) return isEmptyCell(av) === isEmptyCell(bv) ? 0 : isEmptyCell(av) ? 1 : -1;
    const cmp = column.kind === 'number' ? Number(av) - Number(bv) : textCollator.compare(String(av), String(bv));
    return cmp * sign;
  });
}

export function columnTotals(rows: ReportRow[], columns: AnalyzedColumn[]): Record<string, string> {
  const totals: Record<string, string> = {};
  for (const column of columns) {
    if (!column.summable) continue;
    const scale = 10 ** column.decimals;
    const sum = rows.reduce((acc, row) => {
      const n = Number(row[column.key]);
      return Number.isFinite(n) ? acc + Math.round(n * scale) : acc;
    }, 0);
    totals[column.key] = formatNumber(sum / scale, column.decimals);
  }
  return totals;
}
