'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { ApiClientError, apiClient } from '../../api/client';
import type { PublicCaptchaChallengeResponse, PublicCountryView } from '../../api/types';
import { getDictionary, localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { detectBrowserCountryCode } from '../../i18n/currency';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { getEffectiveAttribution } from '../../lib/attribution';
import { useCookieConsent } from '../legal/CookieConsentProvider';
import { Button, LocaleLink } from '../marketing';

interface BookDemoFormProps {
  countries: readonly PublicCountryView[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBaseClass =
  'w-full rounded-lg border bg-[rgb(var(--bg-surface))] px-3.5 py-2.5 text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors';

type FieldName =
  | 'name'
  | 'workEmail'
  | 'company'
  | 'country'
  | 'employeeCountBand'
  | 'message'
  | 'captchaAnswer'
  | 'privacyConsent';

export function BookDemoForm({ countries }: BookDemoFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useWebsiteI18n();
  const { consent, hydrated } = useCookieConsent();
  const demoDict = useMemo(() => getDictionary(locale).leads.demo, [locale]);

  const initialCountryParam = searchParams.get('country')?.trim().toUpperCase() ?? '';
  const initialPlanParam = searchParams.get('plan')?.trim() ?? '';

  const [name, setName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState(initialCountryParam);
  const [employeeCountBand, setEmployeeCountBand] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [notes, setNotes] = useState(() =>
    initialPlanParam ? `Interested in: ${initialPlanParam}` : '',
  );
  const [website, setWebsite] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [captcha, setCaptcha] = useState<PublicCaptchaChallengeResponse | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [captchaLoadFailed, setCaptchaLoadFailed] = useState(false);

  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Suggest visitor country from browser hint if not explicitly provided in query string
  useEffect(() => {
    if (country || countries.length === 0) return;
    const hint = detectBrowserCountryCode();
    if (!hint) return;
    const match = countries.find((c) => c.isoCode.toUpperCase() === hint.toUpperCase());
    if (match) {
      setCountry(match.isoCode.toUpperCase());
    }
  }, [countries, country]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaLoadFailed(false);
    setCaptchaAnswer('');
    try {
      const challenge = await apiClient.leads.getCaptcha();
      setCaptcha(challenge);
    } catch {
      setCaptcha(null);
      setCaptchaLoadFailed(true);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const combinedMessage = useMemo(() => {
    const parts: string[] = [];
    if (selectedTopics.length > 0) {
      parts.push(`Focus areas: ${selectedTopics.join(', ')}`);
    }
    if (notes.trim()) {
      parts.push(notes.trim());
    }
    return parts.join('\n\n');
  }, [notes, selectedTopics]);

  const errors = useMemo<Partial<Record<FieldName, string>>>(() => {
    const errs: Partial<Record<FieldName, string>> = {};

    if (!name.trim()) {
      errs.name = t('leads.demo.validation.nameRequired');
    }

    const emailTrimmed = workEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      errs.workEmail = t('leads.demo.validation.emailRequired');
    } else if (!EMAIL_REGEX.test(emailTrimmed)) {
      errs.workEmail = t('leads.demo.validation.emailInvalid');
    }

    if (!company.trim()) {
      errs.company = t('leads.demo.validation.companyRequired');
    }

    if (!country.trim()) {
      errs.country = t('leads.demo.validation.countryRequired');
    }

    if (!employeeCountBand.trim()) {
      errs.employeeCountBand = t('leads.demo.validation.employeeBandRequired');
    }

    if (!combinedMessage.trim()) {
      errs.message = t('leads.demo.validation.messageRequired');
    }

    if (!captchaAnswer.trim()) {
      errs.captchaAnswer = t('leads.demo.validation.captchaRequired');
    }

    if (!privacyConsent) {
      errs.privacyConsent = t('leads.demo.validation.privacyRequired');
    }

    return errs;
  }, [
    captchaAnswer,
    combinedMessage,
    company,
    country,
    employeeCountBand,
    name,
    privacyConsent,
    t,
    workEmail,
  ]);

  const showError = (field: FieldName): string | undefined => {
    if (submitAttempted || touched[field]) {
      return errors[field];
    }
    return undefined;
  };

  const handleBlur = (field: FieldName) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const toggleTopic = (topicLabel: string) => {
    setTouched((prev) => ({ ...prev, message: true }));
    setSelectedTopics((prev) =>
      prev.includes(topicLabel) ? prev.filter((item) => item !== topicLabel) : [...prev, topicLabel],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setRateLimitError(null);
    setFormError(null);

    if (Object.keys(errors).length > 0 || !captcha) {
      return;
    }

    setSubmitting(true);
    try {
      const allowAttribution = Boolean(marketingConsent || consent.marketing);
      const attribution = getEffectiveAttribution(
        searchParams.toString(),
        Boolean(consent.marketing || consent.analytics || marketingConsent),
      );

      await apiClient.leads.submitDemoRequest({
        name: name.trim(),
        workEmail: workEmail.trim().toLowerCase(),
        company: company.trim(),
        country: country.trim().toUpperCase(),
        employeeCountBand: employeeCountBand.trim(),
        topic: selectedTopics.length > 0 ? selectedTopics.join(', ') : undefined,
        message: combinedMessage,
        sourcePage: pathname || '/demo',
        privacyConsent,
        marketingConsent,
        attributionConsent: allowAttribution,
        captchaToken: `${captcha.challengeId}:${captchaAnswer.trim()}`,
        website,
        ...(allowAttribution ? attribution : {}),
      });

      trackAnalyticsEvent('demo_request', {
        path: pathname || '/demo',
        locale,
        consent,
        hydrated,
        props: {
          country: country.trim().toUpperCase(),
          employeeCountBand: employeeCountBand.trim(),
          topicCount: selectedTopics.length,
        },
      });

      const nextUrl = company.trim()
        ? `/demo/thank-you?company=${encodeURIComponent(company.trim())}`
        : '/demo/thank-you';
      router.push(localizePath(nextUrl, locale));
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
          setRateLimitError(err.message || t('leads.demo.form.rateLimitBody'));
        } else {
          setFormError(err.message || t('leads.demo.form.genericError'));
        }
      } else {
        setFormError(t('leads.demo.form.genericError'));
      }
      void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      data-testid="book-demo-form"
      className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 space-y-5 shadow-card"
    >
      <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">
        {t('leads.demo.form.heading')}
      </h2>

      {rateLimitError && (
        <div
          role="alert"
          data-testid="demo-rate-limit-alert"
          className="rounded-xl border border-error-200 bg-error-50 p-4 flex items-start gap-3 text-sm text-error-800"
        >
          <AlertCircle className="w-5 h-5 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">{t('leads.demo.form.rateLimitTitle')}</p>
            <p className="text-xs sm:text-sm leading-relaxed">{rateLimitError}</p>
          </div>
        </div>
      )}

      {formError && !rateLimitError && (
        <div
          role="alert"
          data-testid="demo-form-error"
          className="rounded-xl border border-error-200 bg-error-50 p-4 flex items-start gap-2.5 text-sm text-error-800"
        >
          <AlertCircle className="w-4 h-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      {/* Hidden Honeypot Anti-Spam Field */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="demo-website">{t('leads.demo.form.honeypotLabel')}</label>
        <input
          id="demo-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {/* Name & Work Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 min-w-0">
          <label
            htmlFor="demo-name"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('leads.demo.form.nameLabel')}
          </label>
          <input
            id="demo-name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            placeholder={t('leads.demo.form.namePlaceholder')}
            aria-invalid={Boolean(showError('name'))}
            aria-describedby={showError('name') ? 'err-demo-name' : undefined}
            onBlur={() => handleBlur('name')}
            onChange={(e) => setName(e.target.value)}
            className={`${inputBaseClass} ${showError('name') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
              }`}
          />
          {showError('name') && (
            <p id="err-demo-name" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('name')}
            </p>
          )}
        </div>

        <div className="space-y-1.5 min-w-0">
          <label
            htmlFor="demo-work-email"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('leads.demo.form.workEmailLabel')}
          </label>
          <input
            id="demo-work-email"
            name="workEmail"
            type="email"
            autoComplete="email"
            value={workEmail}
            placeholder={t('leads.demo.form.workEmailPlaceholder')}
            aria-invalid={Boolean(showError('workEmail'))}
            aria-describedby={showError('workEmail') ? 'err-demo-email' : undefined}
            onBlur={() => handleBlur('workEmail')}
            onChange={(e) => setWorkEmail(e.target.value)}
            className={`${inputBaseClass} ${showError('workEmail') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
              }`}
          />
          {showError('workEmail') && (
            <p id="err-demo-email" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('workEmail')}
            </p>
          )}
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="demo-company"
          className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
        >
          {t('leads.demo.form.companyLabel')}
        </label>
        <input
          id="demo-company"
          name="company"
          type="text"
          autoComplete="organization"
          value={company}
          placeholder={t('leads.demo.form.companyPlaceholder')}
          aria-invalid={Boolean(showError('company'))}
          aria-describedby={showError('company') ? 'err-demo-company' : undefined}
          onBlur={() => handleBlur('company')}
          onChange={(e) => setCompany(e.target.value)}
          className={`${inputBaseClass} ${showError('company') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
            }`}
        />
        {showError('company') && (
          <p id="err-demo-company" className="text-xs font-medium text-error-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {showError('company')}
          </p>
        )}
      </div>

      {/* Country & Employee Count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 min-w-0">
          <label
            htmlFor="demo-country"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('leads.demo.form.countryLabel')}
          </label>
          <select
            id="demo-country"
            name="country"
            value={country}
            aria-invalid={Boolean(showError('country'))}
            aria-describedby={showError('country') ? 'err-demo-country' : undefined}
            onBlur={() => handleBlur('country')}
            onChange={(e) => {
              setCountry(e.target.value);
              setTouched((prev) => ({ ...prev, country: true }));
            }}
            className={`${inputBaseClass} ${showError('country') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
              }`}
          >
            <option value="">{t('leads.demo.form.countryPlaceholder')}</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.name} ({c.isoCode})
              </option>
            ))}
          </select>
          {showError('country') && (
            <p id="err-demo-country" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('country')}
            </p>
          )}
        </div>

        <div className="space-y-1.5 min-w-0">
          <label
            htmlFor="demo-employee-band"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('leads.demo.form.employeeBandLabel')}
          </label>
          <select
            id="demo-employee-band"
            name="employeeCountBand"
            value={employeeCountBand}
            aria-invalid={Boolean(showError('employeeCountBand'))}
            aria-describedby={showError('employeeCountBand') ? 'err-demo-employees' : undefined}
            onBlur={() => handleBlur('employeeCountBand')}
            onChange={(e) => {
              setEmployeeCountBand(e.target.value);
              setTouched((prev) => ({ ...prev, employeeCountBand: true }));
            }}
            className={`${inputBaseClass} ${showError('employeeCountBand')
              ? 'border-error-500'
              : 'border-[rgb(var(--border-strong))]'
              }`}
          >
            <option value="">{t('leads.demo.form.employeeBandPlaceholder')}</option>
            {demoDict.form.employeeBands.map((band) => (
              <option key={band.value} value={band.value}>
                {band.label}
              </option>
            ))}
          </select>
          {showError('employeeCountBand') && (
            <p
              id="err-demo-employees"
              className="text-xs font-medium text-error-700 flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('employeeCountBand')}
            </p>
          )}
        </div>
      </div>

      {/* What they want to see: Interactive topic toggles + notes */}
      <div className="space-y-2.5">
        <span className="block text-sm font-semibold text-[rgb(var(--text-primary))]">
          {t('leads.demo.form.focusTopicsLabel')}
        </span>
        <div className="flex flex-wrap gap-2">
          {demoDict.form.focusTopics.map((topic) => {
            const active = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTopic(topic)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${active
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] hover:border-primary-400'
                  }`}
              >
                {active && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                <span>{topic}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 pt-1">
          <label
            htmlFor="demo-message"
            className="block text-xs font-medium text-[rgb(var(--text-secondary))]"
          >
            {t('leads.demo.form.messageLabel')}
          </label>
          <textarea
            id="demo-message"
            name="message"
            rows={4}
            value={notes}
            placeholder={t('leads.demo.form.messagePlaceholder')}
            aria-invalid={Boolean(showError('message'))}
            aria-describedby={showError('message') ? 'err-demo-message' : undefined}
            onBlur={() => handleBlur('message')}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputBaseClass} resize-y ${showError('message') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
              }`}
          />
          {showError('message') && (
            <p
              id="err-demo-message"
              className="text-xs font-medium text-error-700 flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('message')}
            </p>
          )}
        </div>
      </div>

      {/* Accessible Human Verification CAPTCHA */}
      <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="demo-captcha-answer"
            className="text-sm font-semibold text-[rgb(var(--text-primary))] inline-flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
            {t('leads.demo.form.captchaLabel')}
          </label>
          <button
            type="button"
            onClick={() => void loadCaptcha()}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            {t('leads.demo.form.captchaRefreshText')}
          </button>
        </div>

        {captchaLoading ? (
          <p className="text-xs text-[rgb(var(--text-muted))] inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            {t('leads.demo.form.captchaLoading')}
          </p>
        ) : captchaLoadFailed || !captcha ? (
          <p className="text-xs text-error-700">{t('leads.demo.form.captchaLoadError')}</p>
        ) : (
          <div className="space-y-2">
            <p
              data-testid="demo-captcha-prompt"
              className="text-sm font-mono font-semibold text-[rgb(var(--text-primary))]"
            >
              {captcha.prompt}
            </p>
            <input
              id="demo-captcha-answer"
              name="captchaAnswer"
              type="text"
              inputMode="numeric"
              value={captchaAnswer}
              placeholder={t('leads.demo.form.captchaPlaceholder')}
              aria-invalid={Boolean(showError('captchaAnswer'))}
              aria-describedby={showError('captchaAnswer') ? 'err-demo-captcha' : undefined}
              onBlur={() => handleBlur('captchaAnswer')}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              className={`${inputBaseClass} ${showError('captchaAnswer')
                ? 'border-error-500'
                : 'border-[rgb(var(--border-strong))]'
                }`}
            />
          </div>
        )}

        {showError('captchaAnswer') && (
          <p id="err-demo-captcha" className="text-xs font-medium text-error-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {showError('captchaAnswer')}
          </p>
        )}
      </div>

      {/* Privacy & Marketing Attribution Consent */}
      <div className="space-y-3 pt-1">
        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
            <input
              id="demo-privacy-consent"
              type="checkbox"
              checked={privacyConsent}
              aria-invalid={Boolean(showError('privacyConsent'))}
              aria-describedby={showError('privacyConsent') ? 'err-demo-privacy' : undefined}
              onChange={(e) => {
                setPrivacyConsent(e.target.checked);
                setTouched((prev) => ({ ...prev, privacyConsent: true }));
              }}
              className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
            />
            <span>
              {t('leads.demo.form.privacyConsentPrefix')}{' '}
              <LocaleLink
                href="/privacy"
                className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t('leads.demo.form.privacyLinkLabel')}
              </LocaleLink>
              .
            </span>
          </label>
          {showError('privacyConsent') && (
            <p
              id="err-demo-privacy"
              className="text-xs font-medium text-error-700 flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('privacyConsent')}
            </p>
          )}
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[rgb(var(--text-muted))]">
          <input
            id="demo-marketing-consent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
          />
          <span>{t('leads.demo.form.marketingConsentLabel')}</span>
        </label>
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t('leads.demo.form.submittingLabel')}
          </span>
        ) : (
          t('leads.demo.form.submitLabel')
        )}
      </Button>
    </form>
  );
}
