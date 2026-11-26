'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ApiClientError, apiClient } from '../../api/client';
import type { PublicSignupVerificationResponse } from '../../api/types';
import { getDictionary, localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { trackAnalyticsEvent } from '../../lib/analytics';
import { useCookieConsent } from '../legal/CookieConsentProvider';
import { Button, ButtonLink } from '../marketing';

const POLL_INTERVAL_MS = 900;
const REDIRECT_DELAY_SECONDS = 3;

export function SetupProgressClient() {
  const { locale, t } = useWebsiteI18n();
  const { consent, hydrated } = useCookieConsent();
  const setupCopy = getDictionary(locale).signup.setup;
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [statusData, setStatusData] = useState<PublicSignupVerificationResponse | null>(null);
  const [invalidTokenError, setInvalidTokenError] = useState<string | null>(
    token ? null : setupCopy.invalidTokenBody,
  );
  const [visualStepIndex, setVisualStepIndex] = useState<number>(1);
  const [retrying, setRetrying] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(REDIRECT_DELAY_SECONDS);
  const trackedTenantCreatedRef = useRef(false);

  const pollStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient.signup.getStatus(token);
      setStatusData(res);
      setInvalidTokenError(null);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && (err.status === 400 || err.status === 404)) {
        setInvalidTokenError(err.message || setupCopy.invalidTokenBody);
      }
    }
  }, [setupCopy.invalidTokenBody, token]);

  // Initial fetch & interval polling while status is 'provisioning'
  useEffect(() => {
    if (!token || invalidTokenError) return;
    if (statusData?.status === 'provisioned' || statusData?.status === 'failed') {
      return;
    }

    const initialTimer = setTimeout(() => {
      void pollStatus();
    }, 0);

    const intervalId = setInterval(() => {
      setVisualStepIndex((prev) => (prev < 3 ? prev + 1 : 3));
      void pollStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [invalidTokenError, pollStatus, statusData?.status, token]);

  // Emit Funnel Step 5 (tenant_created) once when workspace provisioning completes
  useEffect(() => {
    if (!hydrated || statusData?.status !== 'provisioned' || trackedTenantCreatedRef.current) {
      return;
    }
    trackedTenantCreatedRef.current = true;
    trackAnalyticsEvent('tenant_created', {
      path: localizePath('/signup/setup', locale),
      locale,
      consent,
      hydrated,
      dedupKey: 'funnel:tenant_created',
      useSessionDedup: true,
      props: {
        plan: 'trial',
        trialDays: statusData.trialDays ?? 0,
      },
    });
  }, [consent, hydrated, locale, statusData?.status, statusData?.trialDays]);

  // Auto-redirect countdown once workspace is provisioned
  useEffect(() => {
    if (statusData?.status !== 'provisioned' || !statusData.loginUrl) return;
    const targetLoginUrl = statusData.loginUrl;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.assign(targetLoginUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [statusData?.loginUrl, statusData?.status]);

  const handleRetrySetup = async () => {
    if (!token) return;
    setRetrying(true);
    setVisualStepIndex(1);
    setStatusData((prev) => ({
      status: 'provisioning',
      subdomain: prev?.subdomain,
      message: setupCopy.progressSubtitle,
    }));

    try {
      const res = await apiClient.signup.verify(token, { async: true });
      setStatusData(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status < 500 && err.code !== 'PROVISIONING_FAILED') {
        setInvalidTokenError(err.message);
      } else {
        setStatusData((prev) => ({
          status: 'failed',
          subdomain: prev?.subdomain,
          message: setupCopy.failedBody,
        }));
      }
    } finally {
      setRetrying(false);
    }
  };

  if (!token || invalidTokenError) {
    return (
      <div
        role="alert"
        data-testid="setup-invalid-card"
        className="max-w-lg mx-auto surface rounded-2xl border border-error-200 p-6 sm:p-10 text-center space-y-5"
      >
        <div className="mx-auto w-12 h-12 rounded-xl bg-error-50 border border-error-200 flex items-center justify-center text-error-600">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
            {t('signup.setup.invalidTokenTitle')}
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
            {invalidTokenError || t('signup.setup.invalidTokenBody')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <ButtonLink href="/signup" variant="primary" size="md">
            {t('signup.setup.failedStartOverCta')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Provisioning failed state — recoverable message + retry + platform alert notice
  if (statusData?.status === 'failed') {
    return (
      <div
        role="alert"
        data-testid="setup-failure-card"
        className="max-w-lg mx-auto surface rounded-2xl border border-warning-200 p-6 sm:p-10 space-y-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning-50 border border-warning-200 flex items-center justify-center text-warning-700 shrink-0">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-warning-50 text-warning-800 border border-warning-200">
              {t('signup.setup.failedBadge')}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))]">
              {t('signup.setup.failedTitle')}
            </h1>
            <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
              {t('signup.setup.failedBody')}
            </p>
          </div>
        </div>

        {statusData.subdomain && (
          <p className="text-xs font-mono text-[rgb(var(--text-muted))] bg-[rgb(var(--bg-muted))] rounded-lg px-3 py-2">
            {t('signup.setup.subdomainPrefix')}{' '}
            <strong className="text-[rgb(var(--text-primary))]">{statusData.subdomain}</strong>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={retrying}
            onClick={() => void handleRetrySetup()}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${retrying ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {retrying ? t('signup.setup.failedRetryingLabel') : t('signup.setup.failedRetryCta')}
          </Button>
          <ButtonLink href="/contact?topic=support" variant="secondary" size="md">
            {t('signup.setup.failedSupportCta')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Provisioned success state + redirect CTA
  if (statusData?.status === 'provisioned' && statusData.loginUrl) {
    return (
      <div
        data-testid="setup-ready-card"
        className="max-w-lg mx-auto surface rounded-2xl border border-success-200 p-6 sm:p-10 text-center space-y-6"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-success-50 border border-success-200 flex items-center justify-center text-success-700">
          <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-success-50 text-success-700 border border-success-200 text-xs font-semibold">
            {t('signup.setup.readyBadge')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--text-primary))]">
            {t('signup.setup.readyTitle')}
          </h1>
          <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
            {t('signup.setup.readySubtitle', {
              subdomain: statusData.subdomain ?? '',
              seconds: redirectCountdown,
            })}
          </p>
        </div>

        <div className="pt-2">
          <ButtonLink
            href={statusData.loginUrl}
            variant="primary"
            size="lg"
            trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
          >
            {t('signup.setup.readyCta')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Provisioning in progress + polling step tracker
  const steps = setupCopy.steps;
  const progressPercent = Math.min(90, 25 * (visualStepIndex + 1));

  return (
    <div
      data-testid="setup-progress-card"
      className="max-w-lg mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-10 space-y-6"
    >
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          {t('signup.setup.progressBadge')}
        </span>
        <h1 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
          {t('signup.setup.progressTitle')}
        </h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
          {t('signup.setup.progressSubtitle')}
        </p>
      </div>

      {/* Progress Bar */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="w-full h-2 rounded-full bg-[rgb(var(--bg-muted))] overflow-hidden"
      >
        <div
          className="h-full bg-primary-600 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {statusData?.subdomain && (
        <p className="text-center text-xs font-mono text-[rgb(var(--text-muted))]">
          {t('signup.setup.subdomainPrefix')}{' '}
          <strong className="text-[rgb(var(--text-primary))]">{statusData.subdomain}</strong>
        </p>
      )}

      {/* Step Checklist */}
      <ol className="space-y-3 pt-1">
        {steps.map((step, index) => {
          const isComplete = index < visualStepIndex;
          const isCurrent = index === visualStepIndex;
          return (
            <li
              key={step.id}
              className="flex items-center gap-3 text-sm"
            >
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 text-primary-600 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="w-4 h-4 text-secondary-300 shrink-0" aria-hidden="true" />
              )}
              <span
                className={
                  isComplete || isCurrent
                    ? 'font-medium text-[rgb(var(--text-primary))]'
                    : 'text-[rgb(var(--text-muted))]'
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
