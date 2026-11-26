'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ApiClientError, apiClient } from '../../api/client';
import type {
  PublicCaptchaChallengeResponse,
  PublicCountryView,
  PublicSignupAcceptedResponse,
  PublicSubdomainAvailabilityResponse,
  PublicTrialConfigResponse,
} from '../../api/types';
import { useWebsiteI18n } from '../../i18n/client';
import { detectBrowserCountryCode } from '../../i18n/currency';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { getEffectiveAttribution } from '../../lib/attribution';
import { useCookieConsent } from '../legal/CookieConsentProvider';
import { Button, ButtonLink, LocaleLink } from '../marketing';

interface StartFreeTrialFormProps {
  countries: readonly PublicCountryView[];
  trialConfig: PublicTrialConfigResponse | null;
  legalTermsVersion?: string;
}

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESERVED_SUBDOMAINS = new Set<string>([
  'admin',
  'platform',
  'www',
  'api',
  'app',
  'portal',
  'mail',
  'smtp',
  'cdn',
  'status',
  'docs',
  'help',
  'billing',
  'support',
  'assets',
  'static',
  'root',
  'localhost',
  'staging',
  'prod',
  'production',
  'demo',
  'test',
  'auth',
  'oauth',
  'sso',
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.email',
  'trashmail.com',
  'getnada.com',
  'sharklasers.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mintemail.com',
  'burnermail.io',
  'mohmal.com',
  'tempail.com',
  'emailondeck.com',
]);

type FieldName =
  | 'companyName'
  | 'country'
  | 'ownerName'
  | 'workEmail'
  | 'password'
  | 'desiredSubdomain'
  | 'captchaAnswer'
  | 'acceptedTerms';

function slugifySubdomain(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function StartFreeTrialForm({
  countries,
  trialConfig,
  legalTermsVersion = '2026-11',
}: StartFreeTrialFormProps) {
  const { locale, t } = useWebsiteI18n();
  const { consent, hydrated } = useCookieConsent();
  const searchParams = useSearchParams();

  // Resolve initial country from query (?country=AU) -> browser hint -> first active country
  const initialCountry = useMemo(() => {
    const queryCountry = searchParams.get('country')?.trim().toLowerCase();
    if (queryCountry) {
      const match = countries.find(
        (c) =>
          c.isoCode.toLowerCase() === queryCountry ||
          c.slug.toLowerCase() === queryCountry,
      );
      if (match) return match.isoCode;
    }

    const browserHint = detectBrowserCountryCode()?.toLowerCase();
    if (browserHint) {
      const match = countries.find((c) => c.isoCode.toLowerCase().startsWith(browserHint));
      if (match) return match.isoCode;
    }

    return countries[0]?.isoCode ?? '';
  }, [countries, searchParams]);

  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState(initialCountry);
  const [ownerName, setOwnerName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [desiredSubdomain, setDesiredSubdomain] = useState('');
  const [subdomainEditedManually, setSubdomainEditedManually] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [captcha, setCaptcha] = useState<PublicCaptchaChallengeResponse | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [captchaLoadFailed, setCaptchaLoadFailed] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [subdomainState, setSubdomainState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'reserved' | 'taken' | 'invalid';
    checkedFor: string;
    serverMessage?: string;
  }>({ status: 'idle', checkedFor: '' });

  const [submitting, setSubmitting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<PublicSignupAcceptedResponse | null>(
    null,
  );

  // Sync country default when query/countries hydrate
  useEffect(() => {
    if (!country && initialCountry) {
      setCountry(initialCountry);
    }
  }, [country, initialCountry]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaLoadFailed(false);
    setCaptchaAnswer('');
    try {
      const challenge = await apiClient.signup.getCaptcha();
      setCaptcha(challenge);
    } catch {
      setCaptchaLoadFailed(true);
      setCaptcha(null);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  // Debounced live subdomain check as user types
  const checkSeqRef = useRef(0);
  useEffect(() => {
    const clean = desiredSubdomain.trim().toLowerCase();
    if (!clean) {
      setSubdomainState({ status: 'idle', checkedFor: '' });
      return;
    }

    if (RESERVED_SUBDOMAINS.has(clean)) {
      setSubdomainState({ status: 'reserved', checkedFor: clean });
      return;
    }

    if (!SUBDOMAIN_REGEX.test(clean)) {
      setSubdomainState({ status: 'invalid', checkedFor: clean });
      return;
    }

    const seq = ++checkSeqRef.current;
    setSubdomainState({ status: 'checking', checkedFor: clean });

    const timer = setTimeout(async () => {
      try {
        const res: PublicSubdomainAvailabilityResponse =
          await apiClient.signup.checkSubdomain(clean);
        if (checkSeqRef.current !== seq) return;
        if (res.available) {
          setSubdomainState({
            status: 'available',
            checkedFor: clean,
            serverMessage: res.message,
          });
        } else if (res.reason === 'reserved') {
          setSubdomainState({
            status: 'reserved',
            checkedFor: clean,
            serverMessage: res.message,
          });
        } else if (res.reason === 'taken') {
          setSubdomainState({
            status: 'taken',
            checkedFor: clean,
            serverMessage: res.message,
          });
        } else {
          setSubdomainState({
            status: 'invalid',
            checkedFor: clean,
            serverMessage: res.message,
          });
        }
      } catch {
        if (checkSeqRef.current !== seq) return;
        setSubdomainState({ status: 'idle', checkedFor: clean });
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [desiredSubdomain]);

  // Inline field validation errors per UI_GUIDELINES.md §4
  const errors = useMemo<Partial<Record<FieldName, string>>>(() => {
    const errs: Partial<Record<FieldName, string>> = {};

    const trimCompany = companyName.trim();
    if (!trimCompany) {
      errs.companyName = t('signup.validation.companyRequired');
    } else if (trimCompany.length < 2) {
      errs.companyName = t('signup.validation.companyTooShort');
    }

    if (!country.trim()) {
      errs.country = t('signup.validation.countryRequired');
    }

    if (!ownerName.trim()) {
      errs.ownerName = t('signup.validation.ownerNameRequired');
    }

    const cleanEmail = workEmail.trim().toLowerCase();
    if (!cleanEmail) {
      errs.workEmail = t('signup.validation.emailRequired');
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      errs.workEmail = t('signup.validation.emailInvalid');
    } else {
      const domain = cleanEmail.split('@')[1] ?? '';
      for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
        if (domain === blocked || domain.endsWith(`.${blocked}`)) {
          errs.workEmail = t('signup.validation.emailDisposable');
          break;
        }
      }
    }

    if (!password) {
      errs.password = t('signup.validation.passwordRequired');
    } else if (password.length < 8) {
      errs.password = t('signup.validation.passwordTooShort');
    } else if (!(/[a-zA-Z]/.test(password) && /\d/.test(password))) {
      errs.password = t('signup.validation.passwordComplexity');
    }

    const cleanSub = desiredSubdomain.trim().toLowerCase();
    if (!cleanSub) {
      errs.desiredSubdomain = t('signup.validation.subdomainRequired');
    } else if (RESERVED_SUBDOMAINS.has(cleanSub) || subdomainState.status === 'reserved') {
      errs.desiredSubdomain = t('signup.validation.subdomainReserved');
    } else if (!SUBDOMAIN_REGEX.test(cleanSub) || subdomainState.status === 'invalid') {
      errs.desiredSubdomain = t('signup.validation.subdomainInvalid');
    } else if (subdomainState.status === 'taken') {
      errs.desiredSubdomain = t('signup.validation.subdomainTaken');
    }

    if (!captchaAnswer.trim()) {
      errs.captchaAnswer = t('signup.validation.captchaRequired');
    }

    if (!acceptedTerms) {
      errs.acceptedTerms = t('signup.validation.termsRequired');
    }

    return errs;
  }, [
    acceptedTerms,
    captchaAnswer,
    companyName,
    country,
    desiredSubdomain,
    ownerName,
    password,
    subdomainState.status,
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

      const response = await apiClient.signup.submit({
        companyName: companyName.trim(),
        country: country.trim(),
        workEmail: workEmail.trim().toLowerCase(),
        ownerName: ownerName.trim(),
        authMethod: 'password',
        password,
        desiredSubdomain: desiredSubdomain.trim().toLowerCase(),
        acceptedTerms,
        termsVersion: trialConfig?.termsVersion ?? legalTermsVersion,
        captchaToken: `${captcha.challengeId}:${captchaAnswer.trim()}`,
        marketingConsent,
        attributionConsent: allowAttribution,
        ...(allowAttribution ? attribution : {}),
      });

      trackAnalyticsEvent('signup_start', {
        locale,
        consent,
        hydrated,
        dedupKey: 'funnel:signup_start',
        useSessionDedup: true,
        props: {
          country: country.trim().toUpperCase(),
          authMethod: 'password',
          hasUtm: Boolean(allowAttribution && (attribution.utmSource || attribution.utmCampaign)),
        },
      });

      setSubmittedResult(response);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
          setRateLimitError(err.message || t('signup.form.rateLimitBody'));
        } else {
          setFormError(err.message || t('signup.form.genericSubmitError'));
        }
      } else {
        setFormError(t('signup.form.genericSubmitError'));
      }
      // Single-use CAPTCHA token needs a fresh challenge after a failed server submission
      void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const includedFeatures = useMemo(
    () => (trialConfig?.features ?? []).filter((f) => f.included),
    [trialConfig],
  );

  // Confirmation card after successful verification-email dispatch
  if (submittedResult) {
    return (
      <div
        data-testid="signup-confirmation"
        className="max-w-xl mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-10 space-y-6 text-center"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-success-50 border border-success-200 flex items-center justify-center text-success-700">
          <MailCheck className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
            {t('signup.submitted.badge')}
          </span>
          <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
            {t('signup.submitted.title')}
          </h2>
          <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
            {t('signup.submitted.body', {
              email: workEmail.trim().toLowerCase(),
              hours: submittedResult.expiresInHours,
              company: companyName.trim(),
            })}
          </p>
        </div>

        <p className="text-xs text-[rgb(var(--text-muted))] rounded-lg bg-[rgb(var(--bg-muted))] p-3">
          {t('signup.submitted.note')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <ButtonLink href="/" variant="primary" size="md">
            {t('signup.submitted.backHomeLabel')}
          </ButtonLink>
          <ButtonLink href="/features" variant="secondary" size="md">
            {t('signup.submitted.exploreFeaturesLabel')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const termsVersion = trialConfig?.termsVersion ?? legalTermsVersion;
  const inputBaseClass =
    'w-full rounded-lg border bg-[rgb(var(--bg-surface))] px-3.5 py-2.5 text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors';

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* 1. Data-driven Trial Inclusions Card (read from trial plan / PlatformSetting, never typed) */}
      <div
        data-testid="trial-includes-card"
        className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
            {trialConfig
              ? t('signup.trialCard.headingWithDays', {
                trialDays: trialConfig.trialDays,
                planName: trialConfig.planName,
              })
              : t('signup.trialCard.headingDefault', { planName: 'Trial' })}
          </h2>
          {trialConfig && !trialConfig.requirePaymentCard && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              {t('signup.trialCard.noCardBadge')}
            </span>
          )}
        </div>

        {trialConfig?.requirePaymentCard && (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs font-medium text-warning-800">
            {t('signup.trialCard.cardRequiredNotice')}
          </div>
        )}

        {trialConfig && includedFeatures.length > 0 ? (
          <div className="space-y-3">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
              {includedFeatures.map((feat) => (
                <li key={feat.key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{feat.label}</span>
                </li>
              ))}
            </ul>

            {trialConfig.limits.length > 0 && (
              <div className="pt-3 border-t border-[rgb(var(--border-subtle))] flex flex-wrap gap-2">
                {trialConfig.limits
                  .filter((l) => l.value === null || l.value > 0)
                  .map((l) => (
                    <span
                      key={l.key}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-secondary))]"
                    >
                      {l.label}:{' '}
                      <strong className="ml-1 text-[rgb(var(--text-primary))]">
                        {l.value === null
                          ? t('signup.trialCard.unlimitedText')
                          : t('signup.trialCard.upToText', { value: l.value })}
                      </strong>
                    </span>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
            {t('signup.trialCard.unavailableNotice')}
          </p>
        )}
      </div>

      {/* 2. Single-Column Self-Service Signup Form */}
      <form
        noValidate
        onSubmit={handleSubmit}
        className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 space-y-5 shadow-card"
      >
        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">
          {t('signup.form.heading')}
        </h2>

        {rateLimitError && (
          <div
            role="alert"
            data-testid="signup-rate-limit-alert"
            className="rounded-xl border border-error-200 bg-error-50 p-4 flex items-start gap-3 text-sm text-error-800"
          >
            <AlertCircle className="w-5 h-5 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">{t('signup.form.rateLimitTitle')}</p>
              <p className="text-xs sm:text-sm leading-relaxed">{rateLimitError}</p>
            </div>
          </div>
        )}

        {formError && !rateLimitError && (
          <div
            role="alert"
            data-testid="signup-form-error"
            className="rounded-xl border border-error-200 bg-error-50 p-4 flex items-start gap-2.5 text-sm text-error-800"
          >
            <AlertCircle className="w-4 h-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {/* Company Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-company-name"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('signup.form.companyNameLabel')}
          </label>
          <input
            id="signup-company-name"
            name="companyName"
            type="text"
            autoComplete="organization"
            value={companyName}
            placeholder={t('signup.form.companyNamePlaceholder')}
            aria-invalid={Boolean(showError('companyName'))}
            aria-describedby={showError('companyName') ? 'err-companyName' : undefined}
            onBlur={() => handleBlur('companyName')}
            onChange={(e) => {
              const val = e.target.value;
              setCompanyName(val);
              if (!subdomainEditedManually) {
                setDesiredSubdomain(slugifySubdomain(val));
              }
            }}
            className={`${inputBaseClass} ${showError('companyName')
              ? 'border-error-500'
              : 'border-[rgb(var(--border-strong))]'
              }`}
          />
          {showError('companyName') && (
            <p id="err-companyName" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('companyName')}
            </p>
          )}
        </div>

        {/* Country */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-country"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('signup.form.countryLabel')}
          </label>
          <select
            id="signup-country"
            name="country"
            value={country}
            aria-invalid={Boolean(showError('country'))}
            aria-describedby={showError('country') ? 'err-country' : undefined}
            onBlur={() => handleBlur('country')}
            onChange={(e) => {
              setCountry(e.target.value);
              setTouched((prev) => ({ ...prev, country: true }));
            }}
            className={`${inputBaseClass} ${showError('country')
              ? 'border-error-500'
              : 'border-[rgb(var(--border-strong))]'
              }`}
          >
            <option value="">
              {countries.length > 0
                ? t('signup.form.countryPlaceholder')
                : t('signup.form.countryEmptyFallback')}
            </option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.name} ({c.currency})
              </option>
            ))}
          </select>
          {showError('country') && (
            <p id="err-country" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('country')}
            </p>
          )}
        </div>

        {/* Owner Full Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-owner-name"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('signup.form.ownerNameLabel')}
          </label>
          <input
            id="signup-owner-name"
            name="ownerName"
            type="text"
            autoComplete="name"
            value={ownerName}
            placeholder={t('signup.form.ownerNamePlaceholder')}
            aria-invalid={Boolean(showError('ownerName'))}
            aria-describedby={showError('ownerName') ? 'err-ownerName' : undefined}
            onBlur={() => handleBlur('ownerName')}
            onChange={(e) => setOwnerName(e.target.value)}
            className={`${inputBaseClass} ${showError('ownerName')
              ? 'border-error-500'
              : 'border-[rgb(var(--border-strong))]'
              }`}
          />
          {showError('ownerName') && (
            <p id="err-ownerName" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('ownerName')}
            </p>
          )}
        </div>

        {/* Work Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-work-email"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('signup.form.workEmailLabel')}
          </label>
          <input
            id="signup-work-email"
            name="workEmail"
            type="email"
            autoComplete="email"
            value={workEmail}
            placeholder={t('signup.form.workEmailPlaceholder')}
            aria-invalid={Boolean(showError('workEmail'))}
            aria-describedby={showError('workEmail') ? 'err-workEmail' : undefined}
            onBlur={() => handleBlur('workEmail')}
            onChange={(e) => setWorkEmail(e.target.value)}
            className={`${inputBaseClass} ${showError('workEmail')
              ? 'border-error-500'
              : 'border-[rgb(var(--border-strong))]'
              }`}
          />
          {showError('workEmail') && (
            <p id="err-workEmail" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('workEmail')}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-password"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('signup.form.passwordLabel')}
          </label>
          <div className="relative">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              placeholder={t('signup.form.passwordPlaceholder')}
              aria-invalid={Boolean(showError('password'))}
              aria-describedby={
                showError('password') ? 'err-password hint-password' : 'hint-password'
              }
              onBlur={() => handleBlur('password')}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputBaseClass} pr-11 ${showError('password')
                ? 'border-error-500'
                : 'border-[rgb(var(--border-strong))]'
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword
                  ? t('signup.form.passwordHideAria')
                  : t('signup.form.passwordShowAria')
              }
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p id="hint-password" className="text-xs text-[rgb(var(--text-muted))]">
            {t('signup.form.passwordHint')}
          </p>
          {showError('password') && (
            <p id="err-password" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('password')}
            </p>
          )}
        </div>

        {/* Desired Subdomain with Live Availability Check */}
        <div className="space-y-1.5">
          <label
            htmlFor="signup-subdomain"
            className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
          >
            {t('signup.form.subdomainLabel')}
          </label>
          <div className="flex items-stretch rounded-lg border border-[rgb(var(--border-strong))] overflow-hidden focus-within:ring-2 focus-within:ring-focus bg-[rgb(var(--bg-surface))]">
            <input
              id="signup-subdomain"
              name="desiredSubdomain"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={desiredSubdomain}
              placeholder={t('signup.form.subdomainPlaceholder')}
              aria-invalid={Boolean(showError('desiredSubdomain'))}
              aria-describedby="hint-subdomain subdomain-status"
              onBlur={() => handleBlur('desiredSubdomain')}
              onChange={(e) => {
                setSubdomainEditedManually(true);
                setTouched((prev) => ({ ...prev, desiredSubdomain: true }));
                setDesiredSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              }}
              className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm font-mono text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none"
            />
            <span className="inline-flex items-center px-3 bg-[rgb(var(--bg-muted))] border-l border-[rgb(var(--border-base))] text-xs font-mono text-[rgb(var(--text-muted))] shrink-0">
              {t('signup.form.subdomainSuffix')}
            </span>
          </div>

          <div id="subdomain-status" aria-live="polite" className="min-h-[20px]">
            {subdomainState.status === 'checking' && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                {t('signup.form.subdomainStatusChecking')}
              </span>
            )}
            {subdomainState.status === 'available' && (
              <span
                data-testid="subdomain-available-badge"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t('signup.form.subdomainStatusAvailable')}
              </span>
            )}
            {subdomainState.status === 'reserved' && (
              <span
                data-testid="subdomain-reserved-badge"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-error-700"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {t('signup.form.subdomainStatusReserved')}
              </span>
            )}
            {subdomainState.status === 'taken' && (
              <span
                data-testid="subdomain-taken-badge"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-error-700"
              >
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {t('signup.form.subdomainStatusTaken')}
              </span>
            )}
            {subdomainState.status === 'invalid' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-800">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {t('signup.form.subdomainStatusInvalid')}
              </span>
            )}
          </div>

          <p id="hint-subdomain" className="text-xs text-[rgb(var(--text-muted))]">
            {t('signup.form.subdomainHint')}
          </p>
        </div>

        {/* Accessible Human Verification CAPTCHA */}
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="signup-captcha-answer"
              className="text-sm font-semibold text-[rgb(var(--text-primary))] inline-flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              {t('signup.form.captchaLabel')}
            </label>
            <button
              type="button"
              onClick={() => void loadCaptcha()}
              aria-label={t('signup.form.captchaRefreshAria')}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              {t('signup.form.captchaRefreshText')}
            </button>
          </div>

          {captchaLoading ? (
            <p className="text-xs text-[rgb(var(--text-muted))] inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              {t('signup.form.captchaLoading')}
            </p>
          ) : captchaLoadFailed || !captcha ? (
            <p className="text-xs text-error-700">{t('signup.form.captchaLoadError')}</p>
          ) : (
            <div className="space-y-2">
              <p
                data-testid="signup-captcha-prompt"
                className="text-sm font-mono font-semibold text-[rgb(var(--text-primary))]"
              >
                {captcha.prompt}
              </p>
              <input
                id="signup-captcha-answer"
                name="captchaAnswer"
                type="text"
                inputMode="numeric"
                value={captchaAnswer}
                placeholder={t('signup.form.captchaPlaceholder')}
                aria-invalid={Boolean(showError('captchaAnswer'))}
                aria-describedby={showError('captchaAnswer') ? 'err-captcha' : undefined}
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
            <p id="err-captcha" className="text-xs font-medium text-error-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {showError('captchaAnswer')}
            </p>
          )}
        </div>

        {/* Terms & Privacy Checkbox + Optional Marketing Attribution */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
              <input
                id="signup-accepted-terms"
                type="checkbox"
                checked={acceptedTerms}
                aria-invalid={Boolean(showError('acceptedTerms'))}
                aria-describedby={showError('acceptedTerms') ? 'err-terms' : undefined}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  setTouched((prev) => ({ ...prev, acceptedTerms: true }));
                }}
                className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
              />
              <span>
                {t('signup.form.termsPrefix')}{' '}
                <LocaleLink
                  href="/terms"
                  className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('signup.form.termsLinkLabel')}
                </LocaleLink>{' '}
                {t('signup.form.termsAndText')}{' '}
                <LocaleLink
                  href="/privacy"
                  className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('signup.form.privacyLinkLabel')}
                </LocaleLink>{' '}
                <span className="text-[rgb(var(--text-muted))]">
                  {t('signup.form.termsVersionNote', { version: termsVersion })}
                </span>
              </span>
            </label>
            {showError('acceptedTerms') && (
              <p id="err-terms" className="text-xs font-medium text-error-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {showError('acceptedTerms')}
              </p>
            )}
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[rgb(var(--text-muted))]">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
            />
            <span>{t('signup.form.marketingConsentLabel')}</span>
          </label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting}
          className="w-full"
        >
          {submitting ? t('signup.form.submittingLabel') : t('signup.form.submitLabel')}
        </Button>

        <p className="text-center text-xs text-[rgb(var(--text-muted))] pt-1">
          {t('signup.form.alreadyHaveAccountPrefix')}{' '}
          <LocaleLink
            href="/login"
            className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t('signup.form.alreadyHaveAccountLink')}
          </LocaleLink>
        </p>
      </form>
    </div>
  );
}
