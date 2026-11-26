'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { ApiClientError, apiClient } from '../../api/client';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { useCookieConsent } from '../legal/CookieConsentProvider';
import { ButtonLink } from '../marketing';

export function VerifyEmailClient() {
  const { locale, t } = useWebsiteI18n();
  const { consent, hydrated } = useCookieConsent();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMissingToken] = useState(!token);

  useEffect(() => {
    if (!token || !hydrated) return;

    let cancelled = false;
    async function verify() {
      try {
        const res = await apiClient.signup.verify(token, { async: true });
        if (cancelled) return;

        if (res.status === 'provisioned' || res.status === 'provisioning') {
          trackAnalyticsEvent('email_verified', {
            path: localizePath('/signup/verify', locale),
            locale,
            consent,
            hydrated,
            dedupKey: 'funnel:email_verified',
            useSessionDedup: true,
          });
        }

        const targetUrl = localizePath(`/signup/setup?token=${encodeURIComponent(token)}`, locale);
        if (res.status === 'provisioned' || res.status === 'provisioning' || res.status === 'failed') {
          router.replace(targetUrl);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          if (err.status >= 500 || err.code === 'PROVISIONING_FAILED') {
            router.replace(localizePath(`/signup/setup?token=${encodeURIComponent(token)}`, locale));
            return;
          }
          setErrorMessage(err.message || t('signup.verify.expiredTitle'));
        } else {
          setErrorMessage(t('signup.verify.expiredTitle'));
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [consent, hydrated, locale, router, t, token]);

  if (isMissingToken) {
    return (
      <div
        data-testid="verify-missing-card"
        className="max-w-lg mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-10 text-center space-y-5"
      >
        <div className="mx-auto w-12 h-12 rounded-xl bg-warning-50 border border-warning-200 flex items-center justify-center text-warning-700">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
            {t('signup.verify.missingTitle')}
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
            {t('signup.verify.missingBody')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <ButtonLink href="/signup" variant="primary" size="md">
            {t('signup.verify.expiredCta')}
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="md">
            {t('signup.verify.backHomeCta')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        data-testid="verify-invalid-card"
        className="max-w-lg mx-auto surface rounded-2xl border border-error-200 p-6 sm:p-10 text-center space-y-5"
      >
        <div className="mx-auto w-12 h-12 rounded-xl bg-error-50 border border-error-200 flex items-center justify-center text-error-600">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
            {t('signup.verify.expiredTitle')}
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
            {errorMessage}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <ButtonLink href="/signup" variant="primary" size="md">
            {t('signup.verify.expiredCta')}
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="md">
            {t('signup.verify.backHomeCta')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="verify-loading-card"
      className="max-w-lg mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-10 text-center space-y-5"
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600">
        <MailCheck className="w-7 h-7" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          {t('signup.verify.verifyingBadge')}
        </span>
        <h1 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
          {t('signup.verify.verifyingTitle')}
        </h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
          {t('signup.verify.verifyingSubtitle')}
        </p>
      </div>
    </div>
  );
}
