import { DEFAULT_LOCALE, LOCALE_INTL_TAGS, type WebsiteLocale } from './types';

export function formatNumber(
  value: number,
  locale: WebsiteLocale = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(LOCALE_INTL_TAGS[locale] ?? 'en-US', options).format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(
  value: string | Date,
  locale: WebsiteLocale = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  try {
    return new Intl.DateTimeFormat(LOCALE_INTL_TAGS[locale] ?? 'en-US', options).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
