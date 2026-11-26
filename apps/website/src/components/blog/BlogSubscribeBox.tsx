'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useWebsiteI18n } from '../../i18n/client';
import { Button, LocaleLink } from '../marketing';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBaseClass =
  'w-full rounded-lg border bg-[rgb(var(--bg-surface))] px-3.5 py-2.5 text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors';

interface BlogSubscribeBoxProps {
  channel?: 'blog' | 'changelog' | 'subprocessors';
  headingOverride?: string;
  descriptionOverride?: string;
  consentPrefixOverride?: string;
}

export function BlogSubscribeBox({
  channel = 'blog',
  headingOverride,
  descriptionOverride,
  consentPrefixOverride,
}: BlogSubscribeBoxProps) {
  const pathname = usePathname();
  const { t } = useWebsiteI18n();

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedConsent, setTouchedConsent] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const emailError = useMemo(() => {
    if (!submitAttempted && !touchedEmail) return undefined;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return t('blog.subscribe.validation.emailRequired');
    if (!EMAIL_REGEX.test(trimmed)) return t('blog.subscribe.validation.emailInvalid');
    return undefined;
  }, [email, submitAttempted, touchedEmail, t]);

  const consentError =
    (submitAttempted || touchedConsent) && !consent
      ? t('blog.subscribe.validation.consentRequired')
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setServerError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail) || !consent) {
      return;
    }

    setSubmitting(true);
    try {
      const consentPrefix = consentPrefixOverride || t('blog.subscribe.consentPrefix');
      const consentText = `${consentPrefix} ${t('blog.subscribe.privacyLinkLabel')}.`;
      const res = await apiClient.newsletter.subscribe({
        email: trimmedEmail,
        channel,
        consentGranted: true,
        consentText,
        consentVersion: '2026-11',
        sourcePage: pathname || '/blog',
        website,
      });
      setConfirmationMessage(res.message || t('blog.subscribe.confirmationBody'));
      setEmail('');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : t('blog.subscribe.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="blog-subscribe-box"
      className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 shrink-0">
          <Mail className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))]">
            {headingOverride || t('blog.subscribe.heading')}
          </h2>
          <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
            {descriptionOverride || t('blog.subscribe.description')}
          </p>
        </div>
      </div>

      {confirmationMessage ? (
        <div
          role="status"
          data-testid="blog-subscribe-confirmation"
          className="rounded-xl border border-success-200 bg-success-50 p-4 flex items-start gap-2.5 text-xs sm:text-sm text-success-800"
        >
          <CheckCircle2 className="w-4 h-4 text-success-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold">{t('blog.subscribe.confirmationTitle')}</p>
            <p>{confirmationMessage}</p>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="space-y-3.5">
          {/* Hidden Honeypot */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="blog-sub-website">{t('blog.subscribe.honeypotLabel')}</label>
            <input
              id="blog-sub-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 p-3 text-xs sm:text-sm text-error-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 min-w-0 space-y-1">
              <label htmlFor="blog-subscribe-email" className="sr-only">
                {t('blog.subscribe.emailLabel')}
              </label>
              <input
                id="blog-subscribe-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                placeholder={t('blog.subscribe.emailPlaceholder')}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'err-blog-email' : undefined}
                onBlur={() => setTouchedEmail(true)}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputBaseClass} ${
                  emailError ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                }`}
              />
              {emailError && (
                <p id="err-blog-email" className="text-xs font-medium text-error-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {emailError}
                </p>
              )}
            </div>

            <Button type="submit" variant="primary" size="md" disabled={submitting} className="shrink-0">
              {submitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {t('blog.subscribe.submittingLabel')}
                </span>
              ) : (
                t('blog.subscribe.submitLabel')
              )}
            </Button>
          </div>

          <div className="space-y-1">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-[rgb(var(--text-secondary))]">
              <input
                id="blog-subscribe-consent"
                type="checkbox"
                checked={consent}
                aria-invalid={Boolean(consentError)}
                aria-describedby={consentError ? 'err-blog-consent' : undefined}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setTouchedConsent(true);
                }}
                className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
              />
              <span>
                {t('blog.subscribe.consentPrefix')}{' '}
                <LocaleLink href="/privacy" className="font-semibold text-primary-600 hover:underline">
                  {t('blog.subscribe.privacyLinkLabel')}
                </LocaleLink>
                .
              </span>
            </label>
            {consentError && (
              <p id="err-blog-consent" className="text-xs font-medium text-error-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {consentError}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
