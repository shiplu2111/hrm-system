'use client';

import { Cookie } from 'lucide-react';
import { useWebsiteI18n } from '../../i18n/client';
import { useCookieConsent } from './CookieConsentProvider';

interface CookieSettingsButtonProps {
  variant?: 'footer' | 'inline';
}

export function CookieSettingsButton({ variant = 'inline' }: CookieSettingsButtonProps) {
  const { t } = useWebsiteI18n();
  const { openPreferences } = useCookieConsent();

  if (variant === 'footer') {
    return (
      <button
        type="button"
        data-testid="footer-cookie-settings"
        onClick={openPreferences}
        className="hover:text-[rgb(var(--text-primary))] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        {t('footer.legal.cookieSettings')}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="cookies-page-settings-btn"
      onClick={openPreferences}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-xs sm:text-sm font-semibold hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Cookie className="w-4 h-4" aria-hidden="true" />
      <span>{t('legal.consent.openSettingsCta')}</span>
    </button>
  );
}
