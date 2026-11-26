export const SUPPORTED_LOCALES = ['en', 'bn'] as const;
export type WebsiteLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: WebsiteLocale = 'en';

export const LOCALE_COOKIE_NAME = 'cmsn_locale';

export const LOCALE_INTL_TAGS: Record<WebsiteLocale, string> = {
  en: 'en-US',
  bn: 'bn-BD',
};

export const LOCALE_OG_TAGS: Record<WebsiteLocale, string> = {
  en: 'en_US',
  bn: 'bn_BD',
};

export const LOCALE_NATIVE_NAMES: Record<WebsiteLocale, string> = {
  en: 'English',
  bn: 'বাংলা',
};

export function isWebsiteLocale(value: string | undefined | null): value is WebsiteLocale {
  return SUPPORTED_LOCALES.includes(value as WebsiteLocale);
}

export function resolveWebsiteLocale(value: string | undefined | null): WebsiteLocale {
  return isWebsiteLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Extracts locale and unprefixed base path from a pathname like `/bn/pricing` -> `{ locale: 'bn', basePath: '/pricing' }`.
 */
export function stripLocalePrefix(pathname: string): {
  locale: WebsiteLocale;
  basePath: string;
} {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = clean.split('/');
  const maybeLocale = segments[1];

  if (maybeLocale && isWebsiteLocale(maybeLocale)) {
    const rest = `/${segments.slice(2).join('/')}`;
    return {
      locale: maybeLocale,
      basePath: rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/',
    };
  }

  return {
    locale: DEFAULT_LOCALE,
    basePath: clean === '/' ? '/' : clean.replace(/\/+$/, '') || '/',
  };
}

/**
 * Prefixes an internal path with `/bn` when `locale === 'bn'`, preserving query strings and hashes.
 * Leaves external URLs, anchors, API endpoints, RSS feeds, and static asset paths untouched.
 */
export function localizePath(href: string, locale: WebsiteLocale = DEFAULT_LOCALE): string {
  if (!href) return locale === DEFAULT_LOCALE ? '/' : `/${locale}`;
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#')
  ) {
    return href;
  }

  const hashIdx = href.indexOf('#');
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;

  const queryIdx = withoutHash.indexOf('?');
  const query = queryIdx >= 0 ? withoutHash.slice(queryIdx) : '';
  const rawPath = queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;

  if (
    rawPath.startsWith('/api/') ||
    rawPath.startsWith('/_next/') ||
    rawPath.startsWith('/images/') ||
    rawPath === '/robots.txt' ||
    rawPath === '/sitemap.xml' ||
    rawPath === '/opengraph-image' ||
    rawPath === '/icon.svg' ||
    rawPath.endsWith('.xml')
  ) {
    return href;
  }

  const { basePath } = stripLocalePrefix(rawPath || '/');

  if (locale === DEFAULT_LOCALE) {
    return `${basePath}${query}${hash}`;
  }

  const localized = basePath === '/' ? `/${locale}` : `/${locale}${basePath}`;
  return `${localized}${query}${hash}`;
}

export type TranslationParams = Record<string, string | number>;

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export type DeepPartialValue<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? readonly DeepPartialValue<U>[]
        : T extends Record<string, unknown>
          ? { [K in keyof T]?: DeepPartialValue<T[K]> }
          : T;

export type DeepPartial<T> = {
  [K in keyof T]?: DeepPartialValue<T[K]>;
};

type NestedPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? NestedPaths<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type DictionaryKey<TDict> = NestedPaths<TDict>;
