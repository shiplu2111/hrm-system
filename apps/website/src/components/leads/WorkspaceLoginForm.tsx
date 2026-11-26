'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  HelpCircle,
  Loader2,
  MailCheck,
  Smartphone,
} from 'lucide-react';
import { ApiClientError, apiClient } from '../../api/client';
import type { PublicPortalTarget } from '../../api/types';
import { getDictionary } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { Button, LocaleLink } from '../marketing';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBaseClass =
  'w-full rounded-lg border bg-[rgb(var(--bg-surface))] px-3.5 py-2.5 text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors';

export function WorkspaceLoginForm() {
  const { locale, t } = useWebsiteI18n();
  const loginDict = useMemo(() => getDictionary(locale).login, [locale]);

  const [portal, setPortal] = useState<PublicPortalTarget>('portal');
  const [identifier, setIdentifier] = useState('');
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    kind: 'check_address' | 'email_sent' | 'redirect' | 'error';
    message: string;
    redirectUrl?: string;
  } | null>(null);

  // Forgot company address state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotWebsite, setForgotWebsite] = useState('');
  const [forgotTouched, setForgotTouched] = useState(false);
  const [forgotSubmitAttempted, setForgotSubmitAttempted] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotConfirmation, setForgotConfirmation] = useState<string | null>(null);

  const identifierError =
    (submitAttempted || identifierTouched) && !identifier.trim()
      ? t('login.validation.identifierRequired')
      : undefined;

  const forgotEmailError = useMemo(() => {
    if (!forgotSubmitAttempted && !forgotTouched) return undefined;
    const trimmed = forgotEmail.trim().toLowerCase();
    if (!trimmed) return t('login.validation.forgotEmailRequired');
    if (!EMAIL_REGEX.test(trimmed)) return t('login.validation.forgotEmailInvalid');
    return undefined;
  }, [forgotEmail, forgotSubmitAttempted, forgotTouched, t]);

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setLookupResult(null);

    if (!identifier.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.login.discover({
        identifier: identifier.trim(),
        portal,
      });

      if (res.action === 'redirect' && res.redirectUrl) {
        setLookupResult({
          kind: 'redirect',
          message: t('login.redirectingMessage'),
          redirectUrl: res.redirectUrl,
        });
        window.location.assign(res.redirectUrl);
        return;
      }

      if (res.action === 'email_sent') {
        setLookupResult({
          kind: 'email_sent',
          message: res.message || t('login.emailSentBody'),
        });
        return;
      }

      setLookupResult({
        kind: 'check_address',
        message: res.message || t('login.neutralUnknownBody'),
      });
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 429) {
        setLookupResult({ kind: 'error', message: t('login.rateLimitError') });
      } else {
        setLookupResult({
          kind: 'error',
          message: err instanceof Error ? err.message : t('login.genericError'),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitAttempted(true);
    setForgotError(null);
    setForgotConfirmation(null);

    const emailTrimmed = forgotEmail.trim().toLowerCase();
    if (!emailTrimmed || !EMAIL_REGEX.test(emailTrimmed)) {
      return;
    }

    setForgotSubmitting(true);
    try {
      const res = await apiClient.login.forgotCompany({
        workEmail: emailTrimmed,
        website: forgotWebsite,
      });
      setForgotConfirmation(res.message || t('login.forgotPanel.confirmationBody'));
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 429) {
        setForgotError(t('login.rateLimitError'));
      } else {
        setForgotError(err instanceof Error ? err.message : t('login.genericError'));
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card space-y-6">
        {!forgotOpen ? (
          <form noValidate onSubmit={handleDiscover} data-testid="workspace-login-form" className="space-y-5">
            {/* Portal vs Employee App Selector */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                {t('login.destinationLabel')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label={t('login.destinationLabel')}>
                {loginDict.destinations.map((dest) => {
                  const id = dest.id as PublicPortalTarget;
                  const active = portal === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`login-target-${id}`}
                      onClick={() => setPortal(id)}
                      className={`text-left rounded-xl border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus min-w-0 ${
                        active
                          ? 'border-primary-600 bg-primary-50/70 ring-1 ring-primary-600/20'
                          : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:border-primary-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-[rgb(var(--text-primary))]">
                        {id === 'portal' ? (
                          <Building2
                            className={`w-4 h-4 shrink-0 ${active ? 'text-primary-600' : 'text-[rgb(var(--text-muted))]'}`}
                            aria-hidden="true"
                          />
                        ) : (
                          <Smartphone
                            className={`w-4 h-4 shrink-0 ${active ? 'text-primary-600' : 'text-[rgb(var(--text-muted))]'}`}
                            aria-hidden="true"
                          />
                        )}
                        <span>{dest.label}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[rgb(var(--text-secondary))] leading-snug">
                        {dest.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subdomain or Work Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-identifier"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {t('login.identifierLabel')}
              </label>
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                placeholder={t('login.identifierPlaceholder')}
                aria-invalid={Boolean(identifierError)}
                aria-describedby={identifierError ? 'err-login-identifier' : 'hint-login-identifier'}
                onBlur={() => setIdentifierTouched(true)}
                onChange={(e) => setIdentifier(e.target.value)}
                className={`${inputBaseClass} ${
                  identifierError ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                }`}
              />
              {identifierError ? (
                <p
                  id="err-login-identifier"
                  className="text-xs font-medium text-error-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {identifierError}
                </p>
              ) : (
                <p id="hint-login-identifier" className="text-xs text-[rgb(var(--text-muted))]">
                  {t('login.identifierHint')}
                </p>
              )}
            </div>

            {/* Neutral Result Feedback */}
            {lookupResult && (
              <div
                role="status"
                data-testid={`login-result-${lookupResult.kind}`}
                className={`rounded-xl border p-4 flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed ${
                  lookupResult.kind === 'redirect'
                    ? 'border-success-200 bg-success-50 text-success-800'
                    : lookupResult.kind === 'email_sent'
                      ? 'border-primary-200 bg-primary-50/70 text-[rgb(var(--text-primary))]'
                      : 'border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-muted))]/60 text-[rgb(var(--text-secondary))]'
                }`}
              >
                {lookupResult.kind === 'redirect' ? (
                  <CheckCircle2 className="w-4 h-4 text-success-700 shrink-0 mt-0.5" aria-hidden="true" />
                ) : lookupResult.kind === 'email_sent' ? (
                  <MailCheck className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <HelpCircle className="w-4 h-4 text-[rgb(var(--text-muted))] shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-[rgb(var(--text-primary))]">
                    {lookupResult.kind === 'redirect'
                      ? lookupResult.message
                      : lookupResult.kind === 'email_sent'
                        ? t('login.emailSentTitle')
                        : t('login.neutralUnknownTitle')}
                  </p>
                  {lookupResult.kind !== 'redirect' && <p>{lookupResult.message}</p>}
                  {lookupResult.redirectUrl && (
                    <a
                      href={lookupResult.redirectUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                    >
                      {lookupResult.redirectUrl}
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {t('login.submittingLabel')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {t('login.submitLabel')}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                data-testid="forgot-company-toggle"
                onClick={() => {
                  setForgotOpen(true);
                  setLookupResult(null);
                  setForgotConfirmation(null);
                  setForgotError(null);
                  if (identifier.includes('@')) {
                    setForgotEmail(identifier.trim());
                  }
                }}
                className="text-xs sm:text-sm font-semibold text-primary-600 hover:underline rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t('login.forgotLinkLabel')}
              </button>
            </div>
          </form>
        ) : (
          <form
            noValidate
            onSubmit={handleForgotSubmit}
            data-testid="forgot-company-form"
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">
                {t('login.forgotPanel.title')}
              </h2>
              <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                {t('login.forgotPanel.description')}
              </p>
            </div>

            {/* Hidden honeypot field */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="forgot-website">{t('login.forgotPanel.honeypotLabel')}</label>
              <input
                id="forgot-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={forgotWebsite}
                onChange={(e) => setForgotWebsite(e.target.value)}
              />
            </div>

            {forgotError && (
              <div
                role="alert"
                className="rounded-xl border border-error-200 bg-error-50 p-3.5 text-xs sm:text-sm text-error-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotConfirmation ? (
              <div
                role="status"
                data-testid="forgot-company-confirmation"
                className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 space-y-1.5 text-xs sm:text-sm text-[rgb(var(--text-secondary))]"
              >
                <div className="flex items-center gap-2 font-semibold text-[rgb(var(--text-primary))]">
                  <MailCheck className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
                  <span>{t('login.forgotPanel.confirmationTitle')}</span>
                </div>
                <p className="leading-relaxed">{forgotConfirmation}</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-work-email"
                    className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
                  >
                    {t('login.forgotPanel.emailLabel')}
                  </label>
                  <input
                    id="forgot-work-email"
                    name="workEmail"
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    placeholder={t('login.forgotPanel.emailPlaceholder')}
                    aria-invalid={Boolean(forgotEmailError)}
                    aria-describedby={forgotEmailError ? 'err-forgot-email' : undefined}
                    onBlur={() => setForgotTouched(true)}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={`${inputBaseClass} ${
                      forgotEmailError ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                    }`}
                  />
                  {forgotEmailError && (
                    <p
                      id="err-forgot-email"
                      className="text-xs font-medium text-error-700 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {forgotEmailError}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={forgotSubmitting}
                  className="w-full"
                >
                  {forgotSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {t('login.forgotPanel.submittingLabel')}
                    </span>
                  ) : (
                    t('login.forgotPanel.submitLabel')
                  )}
                </Button>
              </>
            )}

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(false);
                  setForgotSubmitAttempted(false);
                  setForgotTouched(false);
                  setForgotError(null);
                }}
                className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:underline rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t('login.forgotPanel.cancelLabel')}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
        {t('login.noAccountPrefix')}{' '}
        <LocaleLink
          href="/signup"
          className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t('login.startTrialLinkLabel')}
        </LocaleLink>
      </p>
    </div>
  );
}
