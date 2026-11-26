'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import type { CmsSiteSettingsBundleDto } from '@hrm/shared-types';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { useWebsiteI18n } from '../../i18n/client';
import { localizePath } from '../../i18n';
import {
  DEFAULT_COOKIE_CONSENT,
  persistConsent,
  readStoredConsent,
  type CookieConsentState,
} from '../../lib/consent';
import { clearAnalyticsDedup } from '../../lib/analytics';
import { clearStoredAttribution } from '../../lib/attribution';

interface CookieConsentContextValue {
  consent: CookieConsentState;
  hydrated: boolean;
  isPreferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => void;
  declineAll: () => void;
  savePreferences: (prefs: { analytics: boolean; marketing: boolean }) => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return ctx;
}

export function CookieConsentProvider({
  children,
  bannerWording,
}: {
  children: ReactNode;
  bannerWording?: CmsSiteSettingsBundleDto['cookieBanner'];
}) {
  const { locale, t } = useWebsiteI18n();
  const resolveWording = (
    override: { en?: string; bn?: string } | undefined,
    fallbackKey: Parameters<typeof t>[0],
  ): string => {
    const val = locale === 'bn' ? override?.bn || override?.en : override?.en;
    return val && val.trim() ? val : t(fallbackKey);
  };
  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState>(DEFAULT_COOKIE_CONSENT);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [draftMarketing, setDraftMarketing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const stored = readStoredConsent();
    setConsent(stored);
    setDraftAnalytics(stored.analytics);
    setDraftMarketing(stored.marketing);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!isPreferencesOpen) {
      if (previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    const focusTimer = requestAnimationFrame(() => {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsPreferencesOpen(false);
        return;
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPreferencesOpen]);

  const openPreferences = useCallback(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraftAnalytics(consent.analytics);
    setDraftMarketing(consent.marketing);
    setIsPreferencesOpen(true);
  }, [consent.analytics, consent.marketing]);

  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    const next = persistConsent({ analytics: true, marketing: true });
    setConsent(next);
    setDraftAnalytics(true);
    setDraftMarketing(true);
    setIsPreferencesOpen(false);
  }, []);

  const declineAll = useCallback(() => {
    const next = persistConsent({ analytics: false, marketing: false });
    clearStoredAttribution();
    clearAnalyticsDedup();
    setConsent(next);
    setDraftAnalytics(false);
    setDraftMarketing(false);
    setIsPreferencesOpen(false);
  }, []);

  const savePreferences = useCallback((prefs: { analytics: boolean; marketing: boolean }) => {
    const next = persistConsent({
      analytics: prefs.analytics,
      marketing: prefs.marketing,
    });
    if (!next.analytics && !next.marketing) {
      clearStoredAttribution();
    }
    if (!next.analytics) {
      clearAnalyticsDedup();
    }
    setConsent(next);
    setDraftAnalytics(next.analytics);
    setDraftMarketing(next.marketing);
    setIsPreferencesOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      consent,
      hydrated,
      isPreferencesOpen,
      openPreferences,
      closePreferences,
      acceptAll,
      declineAll,
      savePreferences,
    }),
    [
      consent,
      hydrated,
      isPreferencesOpen,
      openPreferences,
      closePreferences,
      acceptAll,
      declineAll,
      savePreferences,
    ],
  );

  const showBanner = hydrated && !consent.decided && !isPreferencesOpen;

  return (
    <CookieConsentContext.Provider value={value}>
      {children}

      {/* Initial Cookie Consent Banner */}
      {showBanner && (
        <aside
          data-testid="cookie-consent-banner"
          role="region"
          aria-label={resolveWording(bannerWording?.title, 'legal.consent.bannerTitle')}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-lg z-40 rounded-2xl border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] p-5 shadow-xl space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-600 shrink-0">
              <Cookie className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2
                id="cookie-banner-title"
                className="text-sm font-bold text-[rgb(var(--text-primary))]"
              >
                {resolveWording(bannerWording?.title, 'legal.consent.bannerTitle')}
              </h2>
              <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
                {resolveWording(bannerWording?.body, 'legal.consent.bannerBody')}{' '}
                <Link
                  href={localizePath('/cookies', locale)}
                  className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {resolveWording(bannerWording?.policyLinkText, 'legal.consent.policyLink')}
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              data-testid="cookie-customize-btn"
              onClick={openPreferences}
              className="px-3 py-2 rounded-lg border border-[rgb(var(--border-base))] text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {resolveWording(bannerWording?.customizeLabel, 'legal.consent.customize')}
            </button>
            <button
              type="button"
              data-testid="cookie-decline-btn"
              onClick={declineAll}
              className="px-3.5 py-2 rounded-lg border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-subtle))] text-xs font-semibold text-[rgb(var(--text-primary))] hover:bg-slate-200/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {resolveWording(bannerWording?.declineAllLabel, 'legal.consent.declineAll')}
            </button>
            <button
              type="button"
              data-testid="cookie-accept-btn"
              onClick={acceptAll}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {resolveWording(bannerWording?.acceptAllLabel, 'legal.consent.acceptAll')}
            </button>
          </div>
        </aside>
      )}

      {/* Cookie Preferences Modal */}
      {isPreferencesOpen && (
        <div
          ref={modalRef}
          data-testid="cookie-preferences-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border-base))] pb-4">
              <div className="space-y-1">
                <h2
                  id="cookie-modal-title"
                  className="text-lg font-bold text-[rgb(var(--text-primary))] flex items-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5 text-primary-600" aria-hidden="true" />
                  {t('legal.consent.modalTitle')}
                </h2>
                <p className="text-xs text-[rgb(var(--text-secondary))]">
                  {t('legal.consent.modalSubtitle')}
                </p>
              </div>
              <button
                type="button"
                aria-label={t('legal.consent.closeModal')}
                onClick={closePreferences}
                className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Necessary */}
              <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-subtle))] p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                    {t('legal.consent.categories.necessary.title')}
                  </div>
                  <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
                    {t('legal.consent.categories.necessary.description')}
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-success-50 border border-success-200 text-2xs font-semibold text-success-700 shrink-0">
                  {t('legal.consent.alwaysActive')}
                </span>
              </div>

              {/* Analytics */}
              <label
                htmlFor="cookie-toggle-analytics"
                className="rounded-xl border border-[rgb(var(--border-base))] p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-primary-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                    {t('legal.consent.categories.analytics.title')}
                  </div>
                  <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
                    {t('legal.consent.categories.analytics.description')}
                  </p>
                </div>
                <input
                  id="cookie-toggle-analytics"
                  data-testid="cookie-toggle-analytics"
                  type="checkbox"
                  checked={draftAnalytics}
                  onChange={(e) => setDraftAnalytics(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus shrink-0"
                />
              </label>

              {/* Marketing */}
              <label
                htmlFor="cookie-toggle-marketing"
                className="rounded-xl border border-[rgb(var(--border-base))] p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-primary-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                    {t('legal.consent.categories.marketing.title')}
                  </div>
                  <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
                    {t('legal.consent.categories.marketing.description')}
                  </p>
                </div>
                <input
                  id="cookie-toggle-marketing"
                  data-testid="cookie-toggle-marketing"
                  type="checkbox"
                  checked={draftMarketing}
                  onChange={(e) => setDraftMarketing(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus shrink-0"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[rgb(var(--border-base))]">
              <button
                type="button"
                data-testid="cookie-modal-decline-btn"
                onClick={declineAll}
                className="px-3.5 py-2 rounded-lg border border-[rgb(var(--border-base))] text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t('legal.consent.declineAll')}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="cookie-save-btn"
                  onClick={() =>
                    savePreferences({ analytics: draftAnalytics, marketing: draftMarketing })
                  }
                  className="px-4 py-2 rounded-lg border border-primary-600 text-primary-600 text-xs font-semibold hover:bg-primary-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('legal.consent.savePreferences')}
                </button>
                <button
                  type="button"
                  data-testid="cookie-modal-accept-btn"
                  onClick={acceptAll}
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('legal.consent.acceptAll')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CookieConsentContext.Provider>
  );
}
