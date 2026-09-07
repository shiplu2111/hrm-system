/** Locale / timezone context for branch-aware display (MODULES.md §46) */

export interface LocaleContext {
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  currency: string;
  /** BCP 47 tag for Intl formatters */
  locale: string;
}

export interface AttendanceDisplayFields {
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInServerAt: string | null;
  clockOutServerAt: string | null;
  shiftStartTime: string;
  shiftEndTime: string;
  breaks: Array<{ startAt: string; endAt: string | null }>;
}

export interface RosterDisplayFields {
  date: string;
  shiftStartTime: string;
  shiftEndTime: string;
}

const ISO_LOCALE_MAP: Record<string, string> = {
  AUS: 'en-AU',
  USA: 'en-US',
  GBR: 'en-GB',
  SGP: 'en-SG',
  NZL: 'en-NZ',
  CAN: 'en-CA',
  IND: 'en-IN',
  DEU: 'de-DE',
  FRA: 'fr-FR',
  JPN: 'ja-JP',
};

/** Resolve a BCP 47 locale tag from a country ISO code. */
export function resolveIntlLocale(isoCode: string): string {
  const normalized = isoCode.trim().toUpperCase();
  return ISO_LOCALE_MAP[normalized] ?? 'en-US';
}

/** Calendar date (YYYY-MM-DD) for an instant in a branch timezone. */
export function localDateKey(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** UTC midnight Date for a local calendar date key (stored as attendance `date`). */
export function utcDateFromLocalKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid local date key: ${key}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/** Local calendar date for "today" in a branch timezone, as a UTC Date row key. */
export function startOfLocalCalendarDay(
  instant: Date = new Date(),
  timezone: string,
): Date {
  return utcDateFromLocalKey(localDateKey(instant, timezone));
}

/** Parse YYYY-MM-DD input as a local branch calendar date (UTC row key). */
export function parseLocalDateInput(dateInput: string): Date {
  return utcDateFromLocalKey(dateInput);
}

export function formatLocalTime(
  iso: string | null | undefined,
  locale: LocaleContext,
  options?: { hour12?: boolean },
): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale.locale, {
    timeZone: locale.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: options?.hour12 ?? false,
  }).format(new Date(iso));
}

export function formatLocalDateFromKey(
  dateKey: string,
  locale: LocaleContext,
): string {
  return formatLocalDate(utcDateFromLocalKey(dateKey), locale);
}

export function formatLocalDate(instant: Date, locale: LocaleContext): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: locale.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';

  return applyDateFormatPattern(locale.dateFormat, { year, month, day });
}

function applyDateFormatPattern(
  pattern: string,
  parts: { year: string; month: string; day: string },
): string {
  return pattern
    .replace(/YYYY/g, parts.year)
    .replace(/YY/g, parts.year.slice(-2))
    .replace(/MM/g, parts.month)
    .replace(/DD/g, parts.day);
}

export function formatCurrencyAmount(
  amount: number,
  locale: LocaleContext,
): string {
  return new Intl.NumberFormat(locale.locale, {
    style: 'currency',
    currency: locale.currency,
  }).format(amount);
}

export function formatLocalizedNumber(
  value: number,
  locale: LocaleContext,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale.locale, options).format(value);
}

export function buildAttendanceDisplay(input: {
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInServerAt: string | null;
  clockOutServerAt: string | null;
  shift: { startTime: string; endTime: string };
  breaks: Array<{ startAt: string; endAt: string | null }>;
}, locale: LocaleContext): AttendanceDisplayFields {
  return {
    date: formatLocalDateFromKey(input.date, locale),
    clockInAt: formatLocalTime(input.clockInAt, locale),
    clockOutAt: formatLocalTime(input.clockOutAt, locale),
    clockInServerAt: formatLocalTime(input.clockInServerAt, locale),
    clockOutServerAt: formatLocalTime(input.clockOutServerAt, locale),
    shiftStartTime: input.shift.startTime,
    shiftEndTime: input.shift.endTime,
    breaks: input.breaks.map((br) => ({
      startAt: formatLocalTime(br.startAt, locale) ?? '—',
      endAt: formatLocalTime(br.endAt, locale),
    })),
  };
}

export function buildRosterDisplay(input: {
  date: string;
  shift?: { startTime: string; endTime: string } | null;
}, locale: LocaleContext): RosterDisplayFields {
  return {
    date: formatLocalDateFromKey(input.date, locale),
    shiftStartTime: input.shift?.startTime ?? '—',
    shiftEndTime: input.shift?.endTime ?? '—',
  };
}
