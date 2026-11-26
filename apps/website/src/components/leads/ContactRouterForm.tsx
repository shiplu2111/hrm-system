'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Handshake,
  HelpCircle,
  LifeBuoy,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { ApiClientError, apiClient } from '../../api/client';
import type { PublicCaptchaChallengeResponse, PublicCountryView } from '../../api/types';
import { env } from '../../env';
import { getDictionary } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { detectBrowserCountryCode } from '../../i18n/currency';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { getEffectiveAttribution } from '../../lib/attribution';
import { useCookieConsent } from '../legal/CookieConsentProvider';
import { Button, ButtonLink, LocaleLink } from '../marketing';

export type ContactTopicId = 'sales' | 'support' | 'partnership' | 'other';

interface ContactRouterFormProps {
  countries: readonly PublicCountryView[];
}

const VALID_TOPICS: readonly ContactTopicId[] = ['sales', 'support', 'partnership', 'other'];
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

function parseTopicParam(raw: string | null, roleParam: string | null): ContactTopicId {
  const normalized = raw?.trim().toLowerCase();
  if (normalized && VALID_TOPICS.includes(normalized as ContactTopicId)) {
    return normalized as ContactTopicId;
  }
  if (roleParam && roleParam.trim().length > 0) {
    return 'other';
  }
  return 'sales';
}

function mapEmployeeCountToBand(raw: string | null): string {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return '';
  if (num <= 10) return '1-10';
  if (num <= 50) return '11-50';
  if (num <= 250) return '51-250';
  if (num <= 1000) return '251-1000';
  return '1000+';
}

export function ContactRouterForm({ countries }: ContactRouterFormProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, t } = useWebsiteI18n();
  const { consent, hydrated } = useCookieConsent();
  const leadsDict = useMemo(() => getDictionary(locale).leads, [locale]);
  const contactDict = leadsDict.contact;
  const employeeBands = leadsDict.demo.form.employeeBands;

  const roleParam = searchParams.get('role');
  const planParam = searchParams.get('plan')?.trim() ?? '';
  const employeesParam = searchParams.get('employees')?.trim() ?? '';
  const initialTopic = parseTopicParam(searchParams.get('topic'), roleParam);

  const [topic, setTopic] = useState<ContactTopicId>(initialTopic);

  useEffect(() => {
    setTopic(parseTopicParam(searchParams.get('topic'), searchParams.get('role')));
  }, [searchParams]);

  const [name, setName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [employeeCountBand, setEmployeeCountBand] = useState(() =>
    mapEmployeeCountToBand(employeesParam),
  );
  const [salesInterest, setSalesInterest] = useState<string>(contactDict.forms.salesInterests[0]);
  const [partnerType, setPartnerType] = useState<string>(contactDict.forms.partnerTypes[0]);
  const [subject, setSubject] = useState(() =>
    roleParam?.trim() ? `Careers inquiry: ${roleParam.trim()}` : '',
  );
  const [message, setMessage] = useState(() => {
    if (planParam) {
      const empNote = employeesParam ? ` (~${employeesParam} employees)` : '';
      return `Interested in plan: ${planParam}${empNote}`;
    }
    return '';
  });

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
  const [submittedTopic, setSubmittedTopic] = useState<ContactTopicId | null>(null);

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

  const handleSelectTopic = (nextTopic: ContactTopicId) => {
    setTopic(nextTopic);
    setSubmittedTopic(null);
    setSubmitAttempted(false);
    setTouched({});
    setRateLimitError(null);
    setFormError(null);
  };

  const errors = useMemo<Partial<Record<FieldName, string>>>(() => {
    if (topic === 'support') return {};
    const errs: Partial<Record<FieldName, string>> = {};

    if (!name.trim()) {
      errs.name = t('leads.contact.validation.nameRequired');
    }

    const emailTrimmed = workEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      errs.workEmail = t('leads.contact.validation.emailRequired');
    } else if (!EMAIL_REGEX.test(emailTrimmed)) {
      errs.workEmail = t('leads.contact.validation.emailInvalid');
    }

    if ((topic === 'sales' || topic === 'partnership') && !company.trim()) {
      errs.company = t('leads.contact.validation.companyRequired');
    }

    if (topic === 'sales' && !country.trim()) {
      errs.country = t('leads.contact.validation.countryRequired');
    }

    if (topic === 'sales' && !employeeCountBand.trim()) {
      errs.employeeCountBand = t('leads.contact.validation.employeeBandRequired');
    }

    if (!message.trim()) {
      errs.message = t('leads.contact.validation.messageRequired');
    }

    if (!captchaAnswer.trim()) {
      errs.captchaAnswer = t('leads.contact.validation.captchaRequired');
    }

    if (!privacyConsent) {
      errs.privacyConsent = t('leads.contact.validation.privacyRequired');
    }

    return errs;
  }, [
    captchaAnswer,
    company,
    country,
    employeeCountBand,
    message,
    name,
    privacyConsent,
    t,
    topic,
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
    if (topic === 'support') return;

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

      const composedMessage =
        topic === 'sales'
          ? `[Sales focus: ${salesInterest}]\n\n${message.trim()}`
          : topic === 'partnership'
            ? `[Partnership type: ${partnerType}]\n\n${message.trim()}`
            : subject.trim()
              ? `[Subject: ${subject.trim()}]\n\n${message.trim()}`
              : message.trim();

      const commonPayload = {
        name: name.trim(),
        workEmail: workEmail.trim().toLowerCase(),
        company: company.trim() || undefined,
        country: country.trim().toUpperCase() || undefined,
        employeeCountBand:
          topic === 'sales' ? employeeCountBand.trim() || undefined : undefined,
        message: composedMessage,
        sourcePage: pathname || '/contact',
        privacyConsent,
        marketingConsent,
        attributionConsent: allowAttribution,
        captchaToken: `${captcha.challengeId}:${captchaAnswer.trim()}`,
        website,
        ...(allowAttribution ? attribution : {}),
      };

      if (topic === 'sales') {
        await apiClient.leads.submitLead(commonPayload);
      } else {
        await apiClient.leads.submitContactMessage({
          ...commonPayload,
          topic,
        });
      }

      trackAnalyticsEvent('contact_submit', {
        path: pathname || '/contact',
        locale,
        consent,
        hydrated,
        props: {
          topic,
          country: country.trim().toUpperCase() || 'unspecified',
        },
      });

      setSubmittedTopic(topic);
      setMessage('');
      setCaptchaAnswer('');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 429 || err.code === 'RATE_LIMIT_EXCEEDED') {
          setRateLimitError(err.message || t('leads.contact.forms.rateLimitBody'));
        } else {
          setFormError(err.message || t('leads.contact.forms.genericError'));
        }
      } else {
        setFormError(t('leads.contact.forms.genericError'));
      }
      void loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const renderTopicIcon = (id: ContactTopicId) => {
    switch (id) {
      case 'sales':
        return <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'support':
        return <LifeBuoy className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'partnership':
        return <Handshake className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'other':
        return <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />;
    }
  };

  const formHeading =
    topic === 'sales'
      ? t('leads.contact.forms.salesHeading')
      : topic === 'partnership'
        ? t('leads.contact.forms.partnershipHeading')
        : t('leads.contact.forms.otherHeading');

  const formSubtitle =
    topic === 'sales'
      ? t('leads.contact.forms.salesSubtitle')
      : topic === 'partnership'
        ? t('leads.contact.forms.partnershipSubtitle')
        : t('leads.contact.forms.otherSubtitle');

  return (
    <div className="space-y-6">
      {/* 1. Topic Selector */}
      <div className="space-y-2.5">
        <span className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
          {t('leads.contact.topicHeading')}
        </span>
        <div
          role="radiogroup"
          aria-label={t('leads.contact.topicHeading')}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {contactDict.topics.map((item) => {
            const active = topic === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`contact-topic-${item.id}`}
                onClick={() => handleSelectTopic(item.id)}
                className={`text-left rounded-xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus min-w-0 ${active
                  ? 'border-primary-600 bg-primary-50/70 shadow-sm ring-1 ring-primary-600/20'
                  : 'surface border-[rgb(var(--border-base))] hover:border-primary-400'
                  }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-[rgb(var(--text-primary))]">
                  <span className={active ? 'text-primary-600' : 'text-[rgb(var(--text-muted))]'}>
                    {renderTopicIcon(item.id)}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--text-secondary))] leading-snug">
                  {item.shortDescription}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Topic View: Existing-Customer Support Guidance OR Active Form OR Confirmation */}
      {topic === 'support' ? (
        <div
          data-testid="contact-support-guidance"
          className="surface rounded-2xl border border-primary-200 bg-[rgb(var(--bg-surface))] p-6 sm:p-8 space-y-6 shadow-card"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 shrink-0">
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                {t('leads.contact.supportGuidance.badge')}
              </span>
              <h2 className="text-xl font-bold text-[rgb(var(--text-primary))]">
                {t('leads.contact.supportGuidance.title')}
              </h2>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                {t('leads.contact.supportGuidance.body')}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/40 p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-primary))]">
              {t('leads.contact.supportGuidance.reasonsTitle')}
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
              {contactDict.supportGuidance.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <CheckCircle2
                    className="w-4 h-4 text-primary-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/help" variant="primary" size="md">
              {t('leads.contact.supportGuidance.helpCenterCta')}
            </ButtonLink>
            <ButtonLink
              href={`${env.NEXT_PUBLIC_PORTAL_URL}/login`}
              external
              variant="secondary"
              size="md"
            >
              {t('leads.contact.supportGuidance.portalLoginCta')}
            </ButtonLink>
            <LocaleLink
              href="/status"
              className="text-xs sm:text-sm font-semibold text-primary-600 hover:underline px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('leads.contact.supportGuidance.statusCta')}
            </LocaleLink>
          </div>

          <div className="border-t border-[rgb(var(--border-base))] pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--text-muted))]">
            <span>{t('leads.contact.supportGuidance.salesSwitchNote')}</span>
            <button
              type="button"
              onClick={() => handleSelectTopic('sales')}
              className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('leads.contact.supportGuidance.salesSwitchLink')}
            </button>
          </div>
        </div>
      ) : submittedTopic ? (
        <div
          data-testid="contact-submission-confirmation"
          className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 text-center space-y-5 shadow-card"
        >
          <div className="mx-auto w-12 h-12 rounded-2xl bg-success-50 border border-success-200 flex items-center justify-center text-success-700">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
              {t('leads.contact.confirmation.badge')}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))]">
              {submittedTopic === 'sales'
                ? t('leads.contact.confirmation.salesTitle')
                : t('leads.contact.confirmation.defaultTitle')}
            </h2>
            <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed max-w-md mx-auto">
              {t('leads.contact.confirmation.body')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <ButtonLink href="/demo" variant="primary" size="md">
              {t('leads.contact.confirmation.bookDemoCta')}
            </ButtonLink>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setSubmittedTopic(null);
                void loadCaptcha();
              }}
            >
              {t('leads.contact.confirmation.anotherInquiryCta')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={handleSubmit}
          data-testid={`contact-form-${topic}`}
          className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 space-y-5 shadow-card"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">{formHeading}</h2>
            <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
              {formSubtitle}
            </p>
          </div>

          {rateLimitError && (
            <div
              role="alert"
              data-testid="contact-rate-limit-alert"
              className="rounded-xl border border-error-200 bg-error-50 p-4 flex items-start gap-3 text-sm text-error-800"
            >
              <AlertCircle className="w-5 h-5 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">{t('leads.contact.forms.rateLimitTitle')}</p>
                <p className="text-xs sm:text-sm leading-relaxed">{rateLimitError}</p>
              </div>
            </div>
          )}

          {formError && !rateLimitError && (
            <div
              role="alert"
              data-testid="contact-form-error"
              className="rounded-xl border border-error-200 bg-error-50 p-4 flex items-start gap-2.5 text-sm text-error-800"
            >
              <AlertCircle className="w-4 h-4 text-error-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {/* Hidden Honeypot Trap */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="contact-website">{t('leads.contact.forms.honeypotLabel')}</label>
            <input
              id="contact-website"
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
                htmlFor="contact-name"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {t('leads.contact.forms.nameLabel')}
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                placeholder={t('leads.contact.forms.namePlaceholder')}
                aria-invalid={Boolean(showError('name'))}
                aria-describedby={showError('name') ? 'err-contact-name' : undefined}
                onBlur={() => handleBlur('name')}
                onChange={(e) => setName(e.target.value)}
                className={`${inputBaseClass} ${showError('name') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                  }`}
              />
              {showError('name') && (
                <p
                  id="err-contact-name"
                  className="text-xs font-medium text-error-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {showError('name')}
                </p>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <label
                htmlFor="contact-work-email"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {t('leads.contact.forms.workEmailLabel')}
              </label>
              <input
                id="contact-work-email"
                name="workEmail"
                type="email"
                autoComplete="email"
                value={workEmail}
                placeholder={t('leads.contact.forms.workEmailPlaceholder')}
                aria-invalid={Boolean(showError('workEmail'))}
                aria-describedby={showError('workEmail') ? 'err-contact-email' : undefined}
                onBlur={() => handleBlur('workEmail')}
                onChange={(e) => setWorkEmail(e.target.value)}
                className={`${inputBaseClass} ${showError('workEmail')
                  ? 'border-error-500'
                  : 'border-[rgb(var(--border-strong))]'
                  }`}
              />
              {showError('workEmail') && (
                <p
                  id="err-contact-email"
                  className="text-xs font-medium text-error-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {showError('workEmail')}
                </p>
              )}
            </div>
          </div>

          {/* Company & Country (per topic requirements) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 min-w-0">
              <label
                htmlFor="contact-company"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {topic === 'other'
                  ? t('leads.contact.forms.companyOptionalLabel')
                  : t('leads.contact.forms.companyRequiredLabel')}
              </label>
              <input
                id="contact-company"
                name="company"
                type="text"
                autoComplete="organization"
                value={company}
                placeholder={t('leads.contact.forms.companyPlaceholder')}
                aria-invalid={Boolean(showError('company'))}
                aria-describedby={showError('company') ? 'err-contact-company' : undefined}
                onBlur={() => handleBlur('company')}
                onChange={(e) => setCompany(e.target.value)}
                className={`${inputBaseClass} ${showError('company') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                  }`}
              />
              {showError('company') && (
                <p
                  id="err-contact-company"
                  className="text-xs font-medium text-error-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {showError('company')}
                </p>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <label
                htmlFor="contact-country"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {topic === 'sales'
                  ? t('leads.contact.forms.countryRequiredLabel')
                  : t('leads.contact.forms.countryOptionalLabel')}
              </label>
              <select
                id="contact-country"
                name="country"
                value={country}
                aria-invalid={Boolean(showError('country'))}
                aria-describedby={showError('country') ? 'err-contact-country' : undefined}
                onBlur={() => handleBlur('country')}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setTouched((prev) => ({ ...prev, country: true }));
                }}
                className={`${inputBaseClass} ${showError('country') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                  }`}
              >
                <option value="">{t('leads.contact.forms.countryPlaceholder')}</option>
                {countries.map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.name} ({c.isoCode})
                  </option>
                ))}
              </select>
              {showError('country') && (
                <p
                  id="err-contact-country"
                  className="text-xs font-medium text-error-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {showError('country')}
                </p>
              )}
            </div>
          </div>

          {/* Topic-specific fields */}
          {topic === 'sales' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="contact-employee-band"
                  className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
                >
                  {t('leads.contact.forms.employeeBandLabel')}
                </label>
                <select
                  id="contact-employee-band"
                  name="employeeCountBand"
                  value={employeeCountBand}
                  aria-invalid={Boolean(showError('employeeCountBand'))}
                  aria-describedby={
                    showError('employeeCountBand') ? 'err-contact-employees' : undefined
                  }
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
                  <option value="">{t('leads.contact.forms.employeeBandPlaceholder')}</option>
                  {employeeBands.map((band) => (
                    <option key={band.value} value={band.value}>
                      {band.label}
                    </option>
                  ))}
                </select>
                {showError('employeeCountBand') && (
                  <p
                    id="err-contact-employees"
                    className="text-xs font-medium text-error-700 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {showError('employeeCountBand')}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="contact-sales-interest"
                  className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
                >
                  {t('leads.contact.forms.salesInterestLabel')}
                </label>
                <select
                  id="contact-sales-interest"
                  name="salesInterest"
                  value={salesInterest}
                  onChange={(e) => setSalesInterest(e.target.value)}
                  className={`${inputBaseClass} border-[rgb(var(--border-strong))]`}
                >
                  {contactDict.forms.salesInterests.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {topic === 'partnership' && (
            <div className="space-y-1.5">
              <label
                htmlFor="contact-partner-type"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {t('leads.contact.forms.partnerTypeLabel')}
              </label>
              <select
                id="contact-partner-type"
                name="partnerType"
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value)}
                className={`${inputBaseClass} border-[rgb(var(--border-strong))]`}
              >
                {contactDict.forms.partnerTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          )}

          {topic === 'other' && (
            <div className="space-y-1.5">
              <label
                htmlFor="contact-subject"
                className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {t('leads.contact.forms.subjectLabel')}
              </label>
              <div className="relative">
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  value={subject}
                  placeholder={t('leads.contact.forms.subjectPlaceholder')}
                  onChange={(e) => setSubject(e.target.value)}
                  className={`${inputBaseClass} border-[rgb(var(--border-strong))]`}
                />
                {roleParam && (
                  <Briefcase
                    className="w-4 h-4 text-primary-600 absolute right-3 top-3 pointer-events-none"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="space-y-1.5">
            <label
              htmlFor="contact-message"
              className="block text-sm font-semibold text-[rgb(var(--text-primary))]"
            >
              {topic === 'sales'
                ? t('leads.contact.forms.salesMessageLabel')
                : topic === 'partnership'
                  ? t('leads.contact.forms.partnershipMessageLabel')
                  : t('leads.contact.forms.otherMessageLabel')}
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={4}
              value={message}
              placeholder={
                topic === 'sales'
                  ? t('leads.contact.forms.salesMessagePlaceholder')
                  : topic === 'partnership'
                    ? t('leads.contact.forms.partnershipMessagePlaceholder')
                    : t('leads.contact.forms.otherMessagePlaceholder')
              }
              aria-invalid={Boolean(showError('message'))}
              aria-describedby={showError('message') ? 'err-contact-message' : undefined}
              onBlur={() => handleBlur('message')}
              onChange={(e) => setMessage(e.target.value)}
              className={`${inputBaseClass} resize-y ${showError('message') ? 'border-error-500' : 'border-[rgb(var(--border-strong))]'
                }`}
            />
            {showError('message') && (
              <p
                id="err-contact-message"
                className="text-xs font-medium text-error-700 flex items-center gap-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {showError('message')}
              </p>
            )}
          </div>

          {/* CAPTCHA */}
          <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="contact-captcha-answer"
                className="text-sm font-semibold text-[rgb(var(--text-primary))] inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                {t('leads.contact.forms.captchaLabel')}
              </label>
              <button
                type="button"
                onClick={() => void loadCaptcha()}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                {t('leads.contact.forms.captchaRefreshText')}
              </button>
            </div>

            {captchaLoading ? (
              <p className="text-xs text-[rgb(var(--text-muted))] inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                {t('leads.contact.forms.captchaLoading')}
              </p>
            ) : captchaLoadFailed || !captcha ? (
              <p className="text-xs text-error-700">{t('leads.contact.forms.captchaLoadError')}</p>
            ) : (
              <div className="space-y-2">
                <p
                  data-testid="contact-captcha-prompt"
                  className="text-sm font-mono font-semibold text-[rgb(var(--text-primary))]"
                >
                  {captcha.prompt}
                </p>
                <input
                  id="contact-captcha-answer"
                  name="captchaAnswer"
                  type="text"
                  inputMode="numeric"
                  value={captchaAnswer}
                  placeholder={t('leads.contact.forms.captchaPlaceholder')}
                  aria-invalid={Boolean(showError('captchaAnswer'))}
                  aria-describedby={showError('captchaAnswer') ? 'err-contact-captcha' : undefined}
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
              <p
                id="err-contact-captcha"
                className="text-xs font-medium text-error-700 flex items-center gap-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {showError('captchaAnswer')}
              </p>
            )}
          </div>

          {/* Consents */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
                <input
                  id="contact-privacy-consent"
                  type="checkbox"
                  checked={privacyConsent}
                  aria-invalid={Boolean(showError('privacyConsent'))}
                  aria-describedby={
                    showError('privacyConsent') ? 'err-contact-privacy' : undefined
                  }
                  onChange={(e) => {
                    setPrivacyConsent(e.target.checked);
                    setTouched((prev) => ({ ...prev, privacyConsent: true }));
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
                />
                <span>
                  {t('leads.contact.forms.privacyConsentPrefix')}{' '}
                  <LocaleLink
                    href="/privacy"
                    className="font-semibold text-primary-600 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {t('leads.contact.forms.privacyLinkLabel')}
                  </LocaleLink>
                  .
                </span>
              </label>
              {showError('privacyConsent') && (
                <p
                  id="err-contact-privacy"
                  className="text-xs font-medium text-error-700 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {showError('privacyConsent')}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[rgb(var(--text-muted))]">
              <input
                id="contact-marketing-consent"
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border-strong))] text-primary-600 focus-visible:ring-2 focus-visible:ring-focus"
              />
              <span>{t('leads.contact.forms.marketingConsentLabel')}</span>
            </label>
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full">
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('leads.contact.forms.submittingLabel')}
              </span>
            ) : topic === 'sales' ? (
              t('leads.contact.forms.submitSalesLabel')
            ) : (
              t('leads.contact.forms.submitMessageLabel')
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
