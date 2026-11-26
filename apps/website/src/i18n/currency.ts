import type { PublicCurrencyView } from '../api/types';
import { DEFAULT_LOCALE, LOCALE_INTL_TAGS, type WebsiteLocale } from './types';

export const CURRENCY_STORAGE_KEY = 'cmsn_currency';

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Asia/Dhaka': 'BD',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Los_Angeles': 'US',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Asia/Singapore': 'SG',
};

const COUNTRY_TO_FALLBACK_CURRENCY: Record<string, string> = {
  AU: 'AUD',
  BD: 'BDT',
  GB: 'GBP',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  IE: 'EUR',
  US: 'USD',
};

export function detectBrowserCountryCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
  } catch {
    // Ignore Intl errors in constrained environments
  }

  const languages = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const lang of languages) {
    const match = lang.match(/[-_]([A-Za-z]{2})$/);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

export function resolveVisitorCurrency(params: {
  manualCurrency?: string | null;
  countryHint?: string | null;
  currencies: readonly PublicCurrencyView[];
  fallbackDefault?: string;
}): string {
  const { manualCurrency, countryHint, currencies, fallbackDefault = 'USD' } = params;
  const supportedCodes = new Set(currencies.map((c) => c.code.toUpperCase()));

  if (manualCurrency) {
    const normalizedManual = manualCurrency.trim().toUpperCase();
    if (supportedCodes.size === 0 || supportedCodes.has(normalizedManual)) {
      return normalizedManual;
    }
  }

  if (countryHint) {
    const normalizedCountry = countryHint.trim().toUpperCase();
    const slugHint = countryHint.trim().toLowerCase();

    const byConfiguredCountry = currencies.find((currency) =>
      currency.countries.some(
        (c) =>
          c.isoCode.toUpperCase() === normalizedCountry ||
          c.slug === slugHint ||
          c.name.toUpperCase() === normalizedCountry,
      ),
    );
    if (byConfiguredCountry) {
      return byConfiguredCountry.code;
    }

    const fallbackCode = COUNTRY_TO_FALLBACK_CURRENCY[normalizedCountry];
    if (fallbackCode && supportedCodes.has(fallbackCode)) {
      return fallbackCode;
    }
  }

  const flaggedDefault = currencies.find((c) => c.isDefault)?.code;
  return flaggedDefault ?? currencies[0]?.code ?? fallbackDefault;
}

export function formatMoney(
  amount: number,
  currencyCode: string,
  locale: WebsiteLocale = DEFAULT_LOCALE,
): string {
  try {
    const intlLocale = LOCALE_INTL_TAGS[locale] ?? 'en-US';
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
