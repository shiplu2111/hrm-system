import {
  buildAttendanceDisplay,
  formatLocalDateFromKey,
  formatLocalTime,
  localDateKey,
  parseLocalDateInput,
  resolveIntlLocale,
  startOfLocalCalendarDay,
  utcDateFromLocalKey,
} from '@hrm/shared-types';

describe('locale formatting', () => {
  const locale = {
    timezone: 'Australia/Sydney',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '1,234.56',
    currency: 'AUD',
    locale: resolveIntlLocale('AUS'),
  };

  it('derives local calendar date from UTC instant', () => {
    // 2026-09-07 14:00 UTC = 2026-09-08 00:00 Sydney (AEST, UTC+10)
    const instant = new Date('2026-09-07T14:00:00.000Z');
    expect(localDateKey(instant, locale.timezone)).toBe('2026-09-08');
    expect(startOfLocalCalendarDay(instant, locale.timezone).toISOString()).toBe(
      '2026-09-08T00:00:00.000Z',
    );
  });

  it('formats clock times in branch timezone', () => {
    const iso = '2026-09-07T23:30:00.000Z';
    expect(formatLocalTime(iso, locale)).toBe('09:30');
  });

  it('formats dates using country dateFormat pattern', () => {
    expect(formatLocalDateFromKey('2026-09-08', locale)).toBe('08/09/2026');
  });

  it('parses local date input to UTC row key', () => {
    expect(parseLocalDateInput('2026-09-08').toISOString()).toBe(
      '2026-09-08T00:00:00.000Z',
    );
    expect(utcDateFromLocalKey('2026-09-08').toISOString()).toBe(
      '2026-09-08T00:00:00.000Z',
    );
  });

  it('builds attendance display fields', () => {
    const display = buildAttendanceDisplay(
      {
        date: '2026-09-08',
        clockInAt: '2026-09-07T23:05:00.000Z',
        clockOutAt: null,
        clockInServerAt: null,
        clockOutServerAt: null,
        shift: { startTime: '09:00', endTime: '17:00' },
        breaks: [],
      },
      locale,
    );
    expect(display.date).toBe('08/09/2026');
    expect(display.clockInAt).toBe('09:05');
    expect(display.shiftStartTime).toBe('09:00');
  });
});
