import {
  countryDefaultLanguage,
  formatDateKeyWithPattern,
  formatInstantWithPattern,
  formatLocalDateFromKey,
  formatNumberWithPattern,
  isValidTimezone,
  resolveLocalization,
} from '@hrm/shared-types';

const AUS = { isoCode: 'AUS', timezone: 'Australia/Sydney', dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56' };

describe('localization inheritance', () => {
  it('uses country defaults when nothing is overridden', () => {
    const { effective, sources } = resolveLocalization({ country: AUS });
    expect(effective).toEqual({
      language: 'en',
      timezone: 'Australia/Sydney',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: '1,234.56',
    });
    expect(new Set(Object.values(sources))).toEqual(new Set(['country']));
  });

  it('lets the branch override the company field by field', () => {
    const { effective, sources } = resolveLocalization({
      country: AUS,
      company: { language: 'bn', timezone: 'Asia/Dhaka', dateFormat: null, numberFormat: null },
      branch: { language: null, timezone: 'Australia/Perth', dateFormat: 'YYYY-MM-DD', numberFormat: null },
    });
    expect(effective).toEqual({
      language: 'bn',
      timezone: 'Australia/Perth',
      dateFormat: 'YYYY-MM-DD',
      numberFormat: '1,234.56',
    });
    expect(sources).toEqual({
      language: 'company',
      timezone: 'branch',
      dateFormat: 'branch',
      numberFormat: 'country',
    });
  });

  it('derives the country language from the ISO code', () => {
    expect(countryDefaultLanguage('BGD')).toBe('bn');
    expect(countryDefaultLanguage('aus')).toBe('en');
  });
});

describe('localization formatting', () => {
  it('formats dates with every supported pattern', () => {
    expect(formatDateKeyWithPattern('2026-03-05', 'DD/MM/YYYY')).toBe('05/03/2026');
    expect(formatDateKeyWithPattern('2026-03-05', 'MM/DD/YYYY')).toBe('03/05/2026');
    expect(formatDateKeyWithPattern('2026-03-05', 'YYYY-MM-DD')).toBe('2026-03-05');
    expect(formatDateKeyWithPattern('2026-03-05', 'DD.MM.YYYY')).toBe('05.03.2026');
    expect(formatDateKeyWithPattern('2026-03-05', 'DD MMM YYYY')).toBe('05 Mar 2026');
    expect(formatDateKeyWithPattern('2026-03-05', 'MMM DD, YYYY')).toBe('Mar 05, 2026');
  });

  it('uses the timezone to pick the calendar date', () => {
    const instant = new Date('2026-09-07T20:00:00.000Z');
    expect(formatInstantWithPattern(instant, 'YYYY-MM-DD', 'Asia/Dhaka')).toBe('2026-09-08');
    expect(formatInstantWithPattern(instant, 'YYYY-MM-DD', 'America/New_York')).toBe('2026-09-07');
  });

  it('applies company date formats through the locale context', () => {
    const locale = {
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      numberFormat: '12,34,567.89',
      currency: 'BDT',
      locale: 'en-US',
      language: 'en' as const,
    };
    expect(formatLocalDateFromKey('2026-12-25', locale)).toBe('25 Dec 2026');
  });

  it('groups and separates numbers per pattern', () => {
    expect(formatNumberWithPattern(1234567.891, '1,234.56')).toBe('1,234,567.89');
    expect(formatNumberWithPattern(1234567.891, '1.234,56')).toBe('1.234.567,89');
    expect(formatNumberWithPattern(1234567.891, '1 234,56')).toBe('1\u00a0234\u00a0567,89');
    expect(formatNumberWithPattern(1234567.891, "1'234.56")).toBe("1'234'567.89");
    expect(formatNumberWithPattern(1234567.891, '12,34,567.89')).toBe('12,34,567.89');
    expect(formatNumberWithPattern(-950, '12,34,567.89', { min: 2 })).toBe('-950.00');
    expect(formatNumberWithPattern(0.004, '1,234.56')).toBe('0');
  });

  it('validates IANA timezones', () => {
    expect(isValidTimezone('Asia/Dhaka')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('EST')).toBe(false);
  });
});
