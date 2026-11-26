'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import type { AvailableTenantLanguage } from '../../api/types';
import {
  DEFAULT_LOCALE,
  isWebsiteLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_NATIVE_NAMES,
  localizePath,
  stripLocalePrefix,
  SUPPORTED_LOCALES,
  type WebsiteLocale,
} from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';

interface LanguageSwitcherProps {
  variant?: 'header' | 'footer';
  availableLanguages?: readonly AvailableTenantLanguage[];
}

export function LanguageSwitcher({
  variant = 'footer',
  availableLanguages,
}: LanguageSwitcherProps) {
  const { locale, t } = useWebsiteI18n();
  const pathname = usePathname() || '/';
  const router = useRouter();

  // Intersect Super Admin M.3 tenant-available languages with built website dictionaries
  const activeCodes: WebsiteLocale[] =
    availableLanguages && availableLanguages.length > 0
      ? availableLanguages
          .map((item) => item.code)
          .filter((code): code is WebsiteLocale => isWebsiteLocale(code))
      : [...SUPPORTED_LOCALES];

  const locales: WebsiteLocale[] =
    activeCodes.length > 0 ? activeCodes : [DEFAULT_LOCALE];

  const switchTo = (nextLocale: WebsiteLocale) => {
    if (nextLocale === locale) return;
    try {
      document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore storage failures in restricted contexts
    }
    const { basePath } = stripLocalePrefix(pathname);
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const target = localizePath(`${basePath}${search}${hash}`, nextLocale);
    router.push(target);
  };

  if (variant === 'header') {
    const nextLocale: WebsiteLocale = locale === 'bn' ? 'en' : 'bn';
    if (!locales.includes(nextLocale)) {
      return null;
    }

    return (
      <button
        type="button"
        data-testid="header-lang-switcher"
        aria-label={`${t('a11y.selectLanguage')}: ${LOCALE_NATIVE_NAMES[nextLocale]}`}
        onClick={() => switchTo(nextLocale)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-semibold text-[rgb(var(--text-primary))] hover:border-primary-400 hover:bg-primary-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Globe className="w-3.5 h-3.5 text-primary-600 shrink-0" aria-hidden="true" />
        <span>{LOCALE_NATIVE_NAMES[nextLocale]}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-[rgb(var(--text-muted))]" aria-hidden="true" />
      <label htmlFor="footer-lang-select" className="sr-only">
        {t('a11y.selectLanguage')}
      </label>
      <select
        id="footer-lang-select"
        data-testid="footer-lang-select"
        aria-label={t('a11y.selectLanguage')}
        value={locale}
        onChange={(e) => {
          const val = e.target.value;
          if (isWebsiteLocale(val)) {
            switchTo(val);
          }
        }}
        className="min-h-[36px] rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-primary))] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        {locales.map((loc) => {
          const meta = availableLanguages?.find((l) => l.code === loc);
          const label = meta?.nativeName || t(`footer.languages.${loc}`);
          return (
            <option key={loc} value={loc}>
              {label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
