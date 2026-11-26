import { bn } from './dictionaries/bn';
import { en, type WebsiteDictionary } from './dictionaries/en';
import {
  DEFAULT_LOCALE,
  interpolate,
  isWebsiteLocale,
  type DeepPartial,
  type DictionaryKey,
  type TranslationParams,
  type WebsiteLocale,
} from './types';

export type { WebsiteDictionary, WebsiteLocale, DictionaryKey, TranslationParams };
export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_INTL_TAGS,
  LOCALE_NATIVE_NAMES,
  LOCALE_OG_TAGS,
  SUPPORTED_LOCALES,
  interpolate,
  isWebsiteLocale,
  localizePath,
  resolveWebsiteLocale,
  stripLocalePrefix,
} from './types';
export { formatDate, formatNumber } from './format';
export { getFallbackNoticeCopy, type FallbackNoticeCopy, type FallbackReason } from './fallback';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeDictionary<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  if (Array.isArray(base) && Array.isArray(override)) {
    return base.map((item, idx) => {
      const ov = (override as readonly unknown[])[idx];
      if (ov === undefined) return item;
      if (isPlainObject(item) && isPlainObject(ov)) {
        return deepMergeDictionary(item, ov as DeepPartial<typeof item>);
      }
      return ov;
    }) as unknown as T;
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, ovVal] of Object.entries(override)) {
      if (ovVal === undefined) continue;
      const baseVal = (base as Record<string, unknown>)[key];
      if (isPlainObject(baseVal) && isPlainObject(ovVal)) {
        out[key] = deepMergeDictionary(baseVal, ovVal);
      } else if (Array.isArray(baseVal) && Array.isArray(ovVal)) {
        out[key] = deepMergeDictionary(baseVal, ovVal as DeepPartial<typeof baseVal>);
      } else {
        out[key] = ovVal;
      }
    }
    return out as T;
  }
  return override as unknown as T;
}

const mergedBn: WebsiteDictionary = deepMergeDictionary(en, bn);

const dictionaries: Record<WebsiteLocale, WebsiteDictionary> = {
  en,
  bn: mergedBn,
};

export function getDictionary(locale: string | undefined = DEFAULT_LOCALE): WebsiteDictionary {
  if (isWebsiteLocale(locale)) {
    return dictionaries[locale];
  }
  return dictionaries[DEFAULT_LOCALE];
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

export function createTranslator(dict: WebsiteDictionary) {
  return function t(key: DictionaryKey<WebsiteDictionary>, params?: TranslationParams): string {
    const raw = getByPath(dict, key);
    if (typeof raw !== 'string') {
      return key;
    }
    return interpolate(raw, params);
  };
}
